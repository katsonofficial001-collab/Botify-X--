'use strict';

const { jidNormalizedUser } = require('@whiskeysockets/baileys');
const { isGroupJid, senderJid } = require('../utils/helpers');
const logger = require('../utils/logger');

async function requireGroupAdmin({ sock, msg, isOwnerSender }) {
  const remoteJid = msg.key.remoteJid;
  if (!isGroupJid(remoteJid)) return false;
  if (isOwnerSender) return true;

  let meta;
  try {
    meta = await sock.groupMetadata(remoteJid);
  } catch (err) {
    logger.warn({ err }, 'requireGroupAdmin: metadata fetch failed');
    await safeSend(sock, remoteJid, '⚠️ Could not verify group permissions.', msg);
    return false;
  }

  const sender = jidNormalizedUser(senderJid(msg) || '');
  const part = meta.participants.find((p) => jidNormalizedUser(p.id) === sender);
  const isAdmin = !!part && (part.admin === 'admin' || part.admin === 'superadmin');

  if (!isAdmin) {
    await safeSend(sock, remoteJid, '⛔ Only group admins (or the bot owner) can use this command.', msg);
    return false;
  }
  return true;
}

async function safeSend(sock, jid, text, quoted) {
  try {
    await sock.sendMessage(jid, { text }, { quoted });
  } catch (_) {}
}

module.exports = { requireGroupAdmin };
