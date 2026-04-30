'use strict';

const { jidNormalizedUser } = require('@whiskeysockets/baileys');
const config = require('../utils/config');
const { isPrivateJid, getQuotedMessage, jidToPhone } = require('../utils/helpers');

module.exports = async function block({ sock, msg, isOwnerSender }) {
  const remoteJid = msg.key.remoteJid;

  if (!isOwnerSender) {
    await sock.sendMessage(remoteJid, {
      text: '⛔ Only the bot owner can use this command.',
    }, { quoted: msg });
    return;
  }

  if (!isPrivateJid(remoteJid)) {
    await sock.sendMessage(remoteJid, {
      text: '❌ The block command only works in a private chat.',
    }, { quoted: msg });
    return;
  }

  const quoted = getQuotedMessage(msg);
  const candidate =
    quoted?.contextInfo?.participant ||
    quoted?.key?.participant ||
    remoteJid;

  let targetJid = '';
  try {
    targetJid = jidNormalizedUser(candidate);
  } catch (_) {
    targetJid = candidate;
  }

  const ownerJid = config.owner.jid;
  if (!targetJid || (ownerJid && targetJid === jidNormalizedUser(ownerJid))) {
    await sock.sendMessage(remoteJid, {
      text: 'Reply to a forwarded message from the user you want to block, or open their chat first.',
    }, { quoted: msg });
    return;
  }

  try {
    await sock.updateBlockStatus(targetJid, 'block');
    await sock.sendMessage(remoteJid, {
      text: `🚫 Blocked: @${jidToPhone(targetJid)}`,
      mentions: [targetJid],
    }, { quoted: msg });
  } catch (err) {
    await sock.sendMessage(remoteJid, {
      text: `⚠️ Failed to block: ${err.message || 'unknown error'}`,
    }, { quoted: msg });
  }
};
