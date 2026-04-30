'use strict';

const config = require('../utils/config');
const { isPrivateJid, getQuotedMessage, jidToPhone } = require('../utils/helpers');

module.exports = async function block({ sock, msg, isOwnerSender }) {
  const remoteJid = msg.key.remoteJid;

  if (!isPrivateJid(remoteJid)) {
    await sock.sendMessage(remoteJid, {
      text: '❌ The block command only works in private chat.',
    }, { quoted: msg });
    return;
  }

  if (!isOwnerSender) {
    await sock.sendMessage(remoteJid, {
      text: '⛔ Only the bot owner can use this command.',
    }, { quoted: msg });
    return;
  }

  const quoted = getQuotedMessage(msg);
  const targetJid = quoted?.contextInfo?.participant || quoted?.key?.participant || remoteJid;

  if (!targetJid || targetJid === config.owner.jid) {
    await sock.sendMessage(remoteJid, {
      text: 'Reply to a forwarded message from the user you want to block.',
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
