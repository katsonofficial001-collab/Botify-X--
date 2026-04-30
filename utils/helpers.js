'use strict';

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

function getQuotedMessage(msg) {
  const ctx =
    msg?.message?.extendedTextMessage?.contextInfo ||
    msg?.message?.imageMessage?.contextInfo ||
    msg?.message?.videoMessage?.contextInfo ||
    msg?.message?.documentMessage?.contextInfo ||
    msg?.message?.audioMessage?.contextInfo ||
    msg?.message?.stickerMessage?.contextInfo ||
    msg?.message?.reactionMessage?.contextInfo;

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
  const ctx =
    msg?.message?.extendedTextMessage?.contextInfo ||
    msg?.message?.imageMessage?.contextInfo ||
    msg?.message?.videoMessage?.contextInfo;
  return ctx?.mentionedJid || [];
}

function senderJid(msg) {
  if (!msg) return '';
  if (isGroupJid(msg.key?.remoteJid)) return msg.key.participant || '';
  return msg.key?.remoteJid || '';
}

module.exports = {
  URL_REGEX,
  getMessageText,
  getQuotedMessage,
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
};
