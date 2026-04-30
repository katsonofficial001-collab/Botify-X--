'use strict';

const { jidNormalizedUser, areJidsSameUser } = require('@whiskeysockets/baileys');

const URL_REGEX =
  /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-z0-9-]+\.(com|net|org|io|me|app|gg|co|xyz|info|biz|tv|live|link|to|us|uk|ng|in|so|dev)(\/[^\s]*)?)/i;

function getMessageText(msg) {
  if (!msg || !msg.message) return '';
  const m = msg.message;
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    m.buttonsResponseMessage?.selectedDisplayText ||
    m.listResponseMessage?.title ||
    ''
  );
}

function getContextInfo(msg) {
  const m = msg?.message;
  if (!m) return null;
  return (
    m.extendedTextMessage?.contextInfo ||
    m.imageMessage?.contextInfo ||
    m.videoMessage?.contextInfo ||
    m.audioMessage?.contextInfo ||
    m.documentMessage?.contextInfo ||
    m.stickerMessage?.contextInfo ||
    m.reactionMessage?.contextInfo ||
    null
  );
}

function getQuotedMessage(msg) {
  const ctx = getContextInfo(msg);
  if (!ctx?.quotedMessage) return null;
  return {
    key: {
      remoteJid: msg.key.remoteJid,
      id: ctx.stanzaId,
      participant: ctx.participant,
      fromMe: false,
    },
    message: ctx.quotedMessage,
    contextInfo: ctx,
  };
}

function isUrl(text) {
  if (!text) return false;
  return URL_REGEX.test(text);
}

function isGroupJid(jid) {
  return typeof jid === 'string' && jid.endsWith('@g.us');
}

function isPrivateJid(jid) {
  return typeof jid === 'string' && jid.endsWith('@s.whatsapp.net');
}

function jidToPhone(jid) {
  if (!jid) return '';
  return jid.split('@')[0].split(':')[0].replace(/\D/g, '');
}

function phoneToJid(phone) {
  const n = String(phone || '').replace(/\D/g, '');
  return n ? `${n}@s.whatsapp.net` : '';
}

function getViewOnceMessage(msg) {
  const m = msg?.message;
  if (!m) return null;
  const wrapper =
    m.viewOnceMessage ||
    m.viewOnceMessageV2 ||
    m.viewOnceMessageV2Extension;
  if (!wrapper?.message) return null;
  return wrapper.message;
}

function getQuotedViewOnce(quoted) {
  if (!quoted) return null;
  return getViewOnceMessage({ message: quoted.message });
}

function getMediaTypeFromMessage(message) {
  if (!message) return null;
  if (message.imageMessage) return 'imageMessage';
  if (message.videoMessage) return 'videoMessage';
  if (message.audioMessage) return 'audioMessage';
  if (message.documentMessage) return 'documentMessage';
  if (message.stickerMessage) return 'stickerMessage';
  return null;
}

function getMentions(msg) {
  const ctx = getContextInfo(msg);
  return ctx?.mentionedJid || [];
}

function senderJid(msg) {
  if (!msg) return '';
  if (isGroupJid(msg.key?.remoteJid)) return msg.key.participant || '';
  return msg.key?.remoteJid || '';
}

function isEmojiOnly(text) {
  if (!text || typeof text !== 'string') return false;
  const stripped = text.replace(/\s+/g, '');
  if (!stripped) return false;
  if (/[\p{L}\p{N}]/u.test(stripped)) return false;
  return /\p{Extended_Pictographic}/u.test(stripped);
}

function jidsMatch(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  let na, nb;
  try {
    na = jidNormalizedUser(a);
    nb = jidNormalizedUser(b);
  } catch (_) {
    return false;
  }
  if (na === nb) return true;
  try {
    if (areJidsSameUser(na, nb)) return true;
  } catch (_) {}
  return false;
}

function findParticipant(participants, targetJid) {
  if (!targetJid || !Array.isArray(participants)) return null;
  for (const p of participants) {
    if (jidsMatch(p.id, targetJid)) return p;
    if (p.lid && jidsMatch(p.lid, targetJid)) return p;
    if (p.phoneNumber && jidsMatch(p.phoneNumber, targetJid)) return p;
  }
  return null;
}

function getBotIdentifiers(sock) {
  const out = [];
  if (sock?.user?.id) out.push(sock.user.id);
  if (sock?.user?.lid) out.push(sock.user.lid);
  return out;
}

function findBotParticipant(participants, sock) {
  if (!Array.isArray(participants) || !sock?.user) return null;
  const ids = getBotIdentifiers(sock);
  for (const id of ids) {
    const found = findParticipant(participants, id);
    if (found) return found;
  }
  return null;
}

function isParticipantAdmin(p) {
  if (!p) return false;
  return p.admin === 'admin' || p.admin === 'superadmin';
}

module.exports = {
  URL_REGEX,
  getMessageText,
  getQuotedMessage,
  getContextInfo,
  isUrl,
  isGroupJid,
  isPrivateJid,
  jidToPhone,
  phoneToJid,
  getViewOnceMessage,
  getQuotedViewOnce,
  getMediaTypeFromMessage,
  getMentions,
  senderJid,
  isEmojiOnly,
  jidsMatch,
  findParticipant,
  findBotParticipant,
  isParticipantAdmin,
};
