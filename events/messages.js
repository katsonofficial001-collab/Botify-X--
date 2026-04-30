'use strict';

const { downloadMediaMessage, jidNormalizedUser } = require('@whiskeysockets/baileys');

const config = require('../utils/config');
const logger = require('../utils/logger');
const users = require('../utils/users');
const groups = require('../utils/groups');
const commands = require('../commands');
const {
  getMessageText,
  getQuotedMessage,
  getContextInfo,
  isUrl,
  isGroupJid,
  jidToPhone,
  getViewOnceMessage,
  getMediaTypeFromMessage,
  senderJid,
  isEmojiOnly,
  findParticipant,
  findBotParticipant,
  isParticipantAdmin,
} = require('../utils/helpers');

const WARN_THRESHOLD = 5;

async function handleMessages({ session, payload }) {
  const { sock, isOwner: sessionIsOwner } = session;
  const messages = payload.messages || [];

  for (const msg of messages) {
    if (!msg.message) continue;
    if (msg.key?.fromMe && !sessionIsOwner) continue;

    const remoteJid = msg.key.remoteJid;
    if (!remoteJid) continue;

    const isOwnerSender = sessionIsOwner && !!msg.key?.fromMe;
    const text = (getMessageText(msg) || '').trim();

    if (sessionIsOwner) {
      try {
        if (await runGroupGuards({ sock, msg, text })) continue;
      } catch (err) {
        logger.error({ err }, 'runGroupGuards crashed');
      }
    }

    if (isOwnerSender) {
      try { await maybeSaveViewOnce({ sock, msg, text }); } catch (err) { logger.error({ err }, 'view-once handler crashed'); }
      try { await maybeSaveStatus({ sock, msg, text }); } catch (err) { logger.error({ err }, 'status saver crashed'); }
    }

    if (text.startsWith(config.bot.prefix)) {
      const body = text.slice(config.bot.prefix.length).trim();
      const [name, ...rest] = body.split(/\s+/);
      const commandName = (name || '').toLowerCase();
      const args = rest;

      const handler = commands[commandName];
      if (!handler) continue;

      if (!sessionIsOwner) {
        const phone = session.phoneNumber;
        if (!phone || !users.isAuthorized(phone)) {
          try {
            await sock.sendMessage(remoteJid, {
              text: '⛔ Your access has expired. Please contact the admin.',
            }, { quoted: msg });
          } catch (_) {}
          continue;
        }
      }

      try {
        await handler({ sock, msg, args, text, session, isOwnerSender });
      } catch (err) {
        logger.error({ err, command: commandName }, 'Command handler failed');
      }
    }
  }
}

async function runGroupGuards({ sock, msg, text }) {
  const remoteJid = msg.key.remoteJid;
  if (!isGroupJid(remoteJid)) return false;
  if (msg.key?.fromMe) return false;

  const settings = groups.getSettings(remoteJid);
  if (!settings.antilink && !settings.antistatusmention) return false;

  const ctx = getContextInfo(msg);
  const isStatusMention = !!ctx && ctx.remoteJid === 'status@broadcast';
  const containsLink = !!text && isUrl(text);

  if (!isStatusMention && !containsLink) return false;
  if (isStatusMention && !settings.antistatusmention) return false;
  if (!isStatusMention && containsLink && !settings.antilink) return false;

  let meta;
  try {
    meta = await sock.groupMetadata(remoteJid);
  } catch (err) {
    logger.warn({ err, remoteJid }, 'Group guard: metadata fetch failed');
    return false;
  }

  const participants = meta?.participants || [];
  const me = findBotParticipant(participants, sock);
  const senderRaw = senderJid(msg);
  if (!senderRaw) return false;

  const senderPart = findParticipant(participants, senderRaw);
  const botIsAdmin = isParticipantAdmin(me);
  const senderIsAdmin = isParticipantAdmin(senderPart);

  if (!botIsAdmin) {
    logger.info({ remoteJid }, 'Group guard: bot is not admin, skipping');
    return false;
  }
  if (senderIsAdmin) return false;

  const removeJid = senderPart?.id || jidNormalizedUser(senderRaw);
  const mentionJid = senderPart?.phoneNumber || senderPart?.id || jidNormalizedUser(senderRaw);
  const warnKey = jidNormalizedUser(senderRaw);

  const feature = isStatusMention ? 'antistatusmention' : 'antilink';
  const featureLabel = isStatusMention ? 'Anti-status-mention' : 'Antilink';
  const violation = isStatusMention ? 'mentioning a status' : 'sending links';

  try {
    await sock.sendMessage(remoteJid, { delete: msg.key });
  } catch (err) {
    logger.warn({ err }, 'Group guard: delete failed');
  }

  const count = groups.incWarning(remoteJid, warnKey, feature);

  if (count >= WARN_THRESHOLD) {
    try {
      await sock.groupParticipantsUpdate(remoteJid, [removeJid], 'remove');
      await safeText(sock, remoteJid, {
        text: `🚫 ${featureLabel}: removed @${jidToPhone(mentionJid)} after ${count} violations.`,
        mentions: [mentionJid],
      });
      groups.resetWarnings(remoteJid, warnKey);
    } catch (err) {
      logger.warn({ err }, 'Group guard: remove failed');
      await safeText(sock, remoteJid, {
        text: `⚠️ ${featureLabel}: tried to remove @${jidToPhone(mentionJid)} but failed.`,
        mentions: [mentionJid],
      });
    }
  } else {
    const remaining = WARN_THRESHOLD - count;
    await safeText(sock, remoteJid, {
      text: `⚠️ ${featureLabel}: @${jidToPhone(mentionJid)}, please stop ${violation}.\nWarning ${count}/${WARN_THRESHOLD} — ${remaining} more and you'll be removed.`,
      mentions: [mentionJid],
    });
  }

  return true;
}

async function safeText(sock, jid, payload) {
  try {
    await sock.sendMessage(jid, payload);
  } catch (err) {
    logger.warn({ err }, 'sendMessage failed');
  }
}

function ownerSelfJid(sock) {
  const fromUser = sock?.user?.id ? jidNormalizedUser(sock.user.id) : '';
  return fromUser || config.owner.jid || '';
}

async function maybeSaveViewOnce({ sock, msg, text }) {
  const quoted = getQuotedMessage(msg);
  if (!quoted) return;

  const innerVO = getViewOnceMessage({ message: quoted.message });
  if (!innerVO) return;

  if (!isEmojiOnly(text)) return;

  const mediaType = getMediaTypeFromMessage(innerVO);
  if (!mediaType) return;

  const target = ownerSelfJid(sock);
  if (!target) return;

  try {
    const buffer = await downloadMediaMessage(
      { key: quoted.key, message: { [mediaType]: innerVO[mediaType] } },
      'buffer',
      {},
    );

    const baseCaption = innerVO[mediaType]?.caption || '';
    const caption = `🔓 View-once unlocked\n${baseCaption}`.trim();
    const payload = buildResendPayload(mediaType, innerVO, buffer, caption);

    await sock.sendMessage(target, payload);
  } catch (err) {
    logger.error({ err }, 'View-once save failed');
  }
}

async function maybeSaveStatus({ sock, msg, text }) {
  const quoted = getQuotedMessage(msg);
  if (!quoted) return;

  const ctx = getContextInfo(msg);
  const isStatus =
    ctx?.remoteJid === 'status@broadcast' ||
    quoted.contextInfo?.remoteJid === 'status@broadcast';
  if (!isStatus) return;

  const trimmed = (text || '').trim();
  if (!trimmed) return;

  const target = ownerSelfJid(sock);
  if (!target) return;

  const ownerOf = ctx?.participant ? jidToPhone(ctx.participant) : '';
  const header = ownerOf
    ? `💾 Status saved from +${ownerOf}`
    : '💾 Status saved';

  const mediaType = getMediaTypeFromMessage(quoted.message);

  try {
    if (mediaType) {
      const buffer = await downloadMediaMessage(
        { key: quoted.key, message: quoted.message },
        'buffer',
        {},
      );
      const baseCaption = quoted.message[mediaType]?.caption || '';
      const caption = baseCaption ? `${header}\n\n${baseCaption}` : header;
      const payload = buildResendPayload(mediaType, quoted.message, buffer, caption);
      await sock.sendMessage(target, payload);
    } else {
      const t =
        quoted.message.conversation ||
        quoted.message.extendedTextMessage?.text ||
        '';
      if (t) {
        await sock.sendMessage(target, { text: `${header}\n\n${t}` });
      }
    }
  } catch (err) {
    logger.error({ err }, 'Status save failed');
  }
}

function buildResendPayload(mediaType, message, buffer, caption) {
  switch (mediaType) {
    case 'imageMessage':
      return { image: buffer, caption };
    case 'videoMessage':
      return { video: buffer, caption };
    case 'audioMessage':
      return {
        audio: buffer,
        mimetype: message.audioMessage?.mimetype || 'audio/mp4',
        ptt: !!message.audioMessage?.ptt,
      };
    case 'documentMessage':
      return {
        document: buffer,
        mimetype: message.documentMessage?.mimetype || 'application/octet-stream',
        fileName: message.documentMessage?.fileName || 'file',
        caption,
      };
    case 'stickerMessage':
      return { sticker: buffer };
    default:
      return { text: caption };
  }
}

module.exports = handleMessages;
