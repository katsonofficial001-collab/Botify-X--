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
  const { sock } = session;
  const messages = payload.messages || [];

  for (const msg of messages) {
    if (!msg.message) continue;

    const remoteJid = msg.key.remoteJid;
    if (!remoteJid) continue;

    const text = (getMessageText(msg) || '').trim();
    const isFromMe = !!msg.key?.fromMe;

    // 🔥 USER MODE (per client)
    const phone = session.phoneNumber;
    const userData = users.getUser(phone) || {};
    const userMode = userData.mode || 'private';

    if (userMode === 'private' && !isFromMe) continue;

    // 🔥 ANTILINK / GROUP GUARD
    try {
      if (await runGroupGuards({ sock, msg, text })) continue;
    } catch (err) {
      logger.error({ err }, 'runGroupGuards crashed');
    }

    // 🔥 VIEW-ONCE UNLOCK (emoji trigger)
    try { await maybeSaveViewOnce({ sock, msg, text }); } catch {}

    // 🔥 STATUS SAVER
    try { await maybeSaveStatus({ sock, msg, text }); } catch {}

    // 🔥 COMMANDS
    if (text.startsWith(config.bot.prefix)) {
      const body = text.slice(config.bot.prefix.length).trim();
      const [name, ...rest] = body.split(/\s+/);
      const commandName = (name || '').toLowerCase();
      const args = rest;

      const handler = commands[commandName];
      if (!handler) continue;

      try {
        await handler({ sock, msg, args, text, session });
      } catch (err) {
        logger.error({ err, command: commandName }, 'Command failed');
      }
    }
  }
}

/* ===================== */
/* ANTILINK SYSTEM       */
/* ===================== */

async function runGroupGuards({ sock, msg, text }) {
  const remoteJid = msg.key.remoteJid;
  if (!isGroupJid(remoteJid)) return false;
  if (msg.key?.fromMe) return false;

  const settings = groups.getSettings(remoteJid);
  if (!settings.antilink) return false;

  const containsLink = !!text && isUrl(text);
  if (!containsLink) return false;

  let meta;
  try {
    meta = await sock.groupMetadata(remoteJid);
  } catch {
    return false;
  }

  const participants = meta?.participants || [];
  const me = findBotParticipant(participants, sock);
  const senderRaw = senderJid(msg);
  const senderPart = findParticipant(participants, senderRaw);

  if (!isParticipantAdmin(me)) return false;
  if (isParticipantAdmin(senderPart)) return false;

  try {
    await sock.sendMessage(remoteJid, { delete: msg.key });
  } catch {}

  return true;
}

/* ===================== */
/* VIEW-ONCE UNLOCK      */
/* ===================== */

async function maybeSaveViewOnce({ sock, msg, text }) {
  const quoted = getQuotedMessage(msg);
  if (!quoted) return;

  const innerVO = getViewOnceMessage({ message: quoted.message });
  if (!innerVO) return;

  if (!isEmojiOnly(text)) return;

  const mediaType = getMediaTypeFromMessage(innerVO);
  if (!mediaType) return;

  const target = sock.user?.id;
  if (!target) return;

  try {
    const buffer = await downloadMediaMessage(
      { key: quoted.key, message: { [mediaType]: innerVO[mediaType] } },
      'buffer',
      {}
    );

    await sock.sendMessage(target, {
      [mediaType.replace('Message', '')]: buffer,
      caption: '🔓 View-once unlocked'
    });

  } catch (err) {
    logger.error({ err }, 'View-once failed');
  }
}

/* ===================== */
/* STATUS SAVER          */
/* ===================== */

async function maybeSaveStatus({ sock, msg, text }) {
  const quoted = getQuotedMessage(msg);
  if (!quoted) return;

  const ctx = getContextInfo(msg);
  const isStatus =
    ctx?.remoteJid === 'status@broadcast' ||
    quoted.contextInfo?.remoteJid === 'status@broadcast';

  if (!isStatus) return;
  if (!text) return;

  const target = sock.user?.id;
  if (!target) return;

  try {
    const mediaType = getMediaTypeFromMessage(quoted.message);

    if (mediaType) {
      const buffer = await downloadMediaMessage(
        { key: quoted.key, message: quoted.message },
        'buffer',
        {}
      );

      await sock.sendMessage(target, {
        [mediaType.replace('Message', '')]: buffer,
        caption: '💾 Status saved'
      });

    } else {
      const t =
        quoted.message.conversation ||
        quoted.message.extendedTextMessage?.text;

      if (t) {
        await sock.sendMessage(target, { text: `💾 Status:\n${t}` });
      }
    }

  } catch (err) {
    logger.error({ err }, 'Status save failed');
  }
}

module.exports = handleMessages;
