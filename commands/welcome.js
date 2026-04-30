'use strict';

const groups = require('../utils/groups');
const { isGroupJid } = require('../utils/helpers');
const { requireGroupAdmin } = require('./_guards');

module.exports = async function welcome({ sock, msg, args, isOwnerSender }) {
  const remoteJid = msg.key.remoteJid;

  if (!isGroupJid(remoteJid)) {
    await sock.sendMessage(remoteJid, {
      text: '❌ This command only works inside a group.',
    }, { quoted: msg });
    return;
  }

  const allowed = await requireGroupAdmin({ sock, msg, isOwnerSender });
  if (!allowed) return;

  const arg = (args[0] || '').toLowerCase();
  if (arg !== 'on' && arg !== 'off') {
    const status = groups.isEnabled(remoteJid, 'welcome') ? 'ON' : 'OFF';
    await sock.sendMessage(remoteJid, {
      text: `Usage: *welcome on  |  *welcome off\nCurrent status: *${status}*`,
    }, { quoted: msg });
    return;
  }

  groups.setEnabled(remoteJid, 'welcome', arg === 'on');

  const reply = arg === 'on'
    ? '✅ Welcome / Goodbye messages *enabled* for this chat.'
    : '🟡 Welcome / Goodbye messages *disabled* for this chat.';

  await sock.sendMessage(remoteJid, { text: reply }, { quoted: msg });
};
