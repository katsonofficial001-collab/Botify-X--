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
  isUrl,
  isGroupJid,
  jidToPhone,
  getViewOnceMessage,
  getMediaTypeFromMessage,
  senderJid,
} = require('../utils/helpers');

const WARN_THRESHOLD = 5;

const SAVE_TRIGGERS = new Set(['👀', '📥', '⬇️', 'save', 'send']);

async function handleMessages({ session, payload }) {
  const { sock, isOwner: sessionIsOwner } = session;
  const messages = payload.messages || [];

  for (const msg of messages) {
    if (!msg.message) continue;
    if (msg.key?.fromMe && !sessionIsOwner) continue;

    const remoteJid = msg.key.remoteJid;
    if (!remoteJid) continue;

    const sender = senderJid(msg) || remoteJid;
    const senderPhone = jidToPhone(sender);
    const isOwnerSender = sessionIsOwner && !!msg.key?.fromMe;
    const text = getMessageText(msg).trim();

    if (sessionIsOwner) {
      if (await runGroupGuards({ sock, msg, text })) continue;
    }

    if (isOwnerSender) {
      await maybeSaveViewOnce({ sock, msg, text });
      await maybeSaveStatus({ sock, msg, text });
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

  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  const isStatusMention =
    !!ctx && ctx.remoteJid === 'status@broadcast' && (ctx.mentionedJid?.length || 0) > 0;
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

  const botJid = jidNormalizedUser(sock.user?.id || '');
  const me = meta.participants.find((p) => jidNormalizedUser(p.id) === botJid);
  const senderRaw = senderJid(msg);
  const sender = senderRaw ? jidNormalizedUser(senderRaw) : '';
  if (!sender) return false;

  const senderPart = meta.participants.find((p) => jidNormalizedUser(p.id) === sender);
  const botIsAdmin = !!me && (me.admin === 'admin' || me.admin === 'superadmin');
  const senderIsAdmin = !!senderPart && (senderPart.admin === 'admin' || senderPart.admin === 'superadmin');

  if (!botIsAdmin) return false;
  if (senderIsAdmin) return false;

  const feature = isStatusMention ? 'antistatusmention' : 'antilink';
  const featureLabel = isStatusMention ? 'Anti-status-mention' : 'Antilink';
  const violation = isStatusMention ? 'mentioning a status' : 'sending links';

  try {
    await sock.sendMessage(remoteJid, { delete: msg.key });
  } catch (err) {
    logger.warn({ err }, 'Group guard: delete failed');
  }

  const count = groups.incWarning(remoteJid, sender, feature);

  if (count >= WARN_THRESHOLD) {
    try {
      await sock.groupParticipantsUpdate(remoteJid, [sender], 'remove');
      await sock.sendMessage(remoteJid, {
        text: `🚫 ${featureLabel}: removed @${jidToPhone(sender)} after ${count} violations.`,
        mentions: [sender],
      });
      groups.resetWarnings(remoteJid, sender);
    } catch (err) {
      logger.warn({ err }, 'Group guard: remove failed');
      await safeText(sock, remoteJid, {
        text: `⚠️ ${featureLabel}: tried to remove @${jidToPhone(sender)} but failed.`,
        mentions: [sender],
      });
    }
  } else {
    const remaining = WARN_THRESHOLD - count;
    await safeText(sock, remoteJid, {
      text: `⚠️ ${featureLabel}: @${jidToPhone(sender)}, please stop ${violation}.\nWarning ${count}/${WARN_THRESHOLD} — ${remaining} more and you'll be removed.`,
      mentions: [sender],
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

async function maybeSaveViewOnce({ sock, msg, text }) {
  const isReaction = !!msg.message.reactionMessage;
  const quoted = getQuotedMessage(msg);
  if (!quoted) return;

  const trigger = isReaction
    ? msg.message.reactionMessage.text
    : (text || '').toLowerCase();
  if (!trigger || !SAVE_TRIGGERS.has(trigger)) return;

  const innerVO = getViewOnceMessage({ message: quoted.message });
  if (!innerVO) return;

  const mediaType = getMediaTypeFromMessage(innerVO);
  if (!mediaType) return;

  try {
    const buffer = await downloadMediaMessage(
      { key: quoted.key, message: { [mediaType]: innerVO[mediaType] } },
      'buffer',
      {},
    );

    const caption = innerVO[mediaType]?.caption || '🔓 View-once unlocked by Botify X';
    const payload = buildResendPayload(mediaType, innerVO, buffer, caption);

    await sock.sendMessage(msg.key.remoteJid, payload, { quoted: msg });
    if (config.owner.jid) {
      await sock.sendMessage(config.owner.jid, payload);
    }
  } catch (err) {
    logger.error({ err }, 'View-once save failed');
  }
}

async function maybeSaveStatus({ sock, msg, text }) {
  const quoted = getQuotedMessage(msg);
  if (!quoted) return;

  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  const isStatus = ctx?.remoteJid === 'status@broadcast' || quoted.contextInfo?.remoteJid === 'status@broadcast';
  if (!isStatus) return;

  const trigger = (text || '').toLowerCase();
  if (!SAVE_TRIGGERS.has(trigger)) return;

  const mediaType = getMediaTypeFromMessage(quoted.message);

  try {
    if (mediaType) {
      const buffer = await downloadMediaMessage(
        { key: quoted.key, message: quoted.message },
        'buffer',
        {},
      );
      const caption = quoted.message[mediaType]?.caption || '💾 Status saved by Botify X';
      const payload = buildResendPayload(mediaType, quoted.message, buffer, caption);
      await sock.sendMessage(msg.key.remoteJid, payload, { quoted: msg });
      if (config.owner.jid) await sock.sendMessage(config.owner.jid, payload);
    } else {
      const t = quoted.message.conversation || quoted.message.extendedTextMessage?.text;
      if (t) {
        const payload = { text: `💾 Status text saved:\n\n${t}` };
        await sock.sendMessage(msg.key.remoteJid, payload, { quoted: msg });
        if (config.owner.jid) await sock.sendMessage(config.owner.jid, payload);
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
