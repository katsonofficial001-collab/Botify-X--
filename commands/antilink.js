'use strict';

const groups = require('../utils/groups');
const { isGroupJid } = require('../utils/helpers');
const { requireGroupAdmin } = require('./_guards');

module.exports = async function antilink({ sock, msg, args, isOwnerSender }) {
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
    const status = groups.isEnabled(remoteJid, 'antilink') ? 'ON' : 'OFF';
    await sock.sendMessage(remoteJid, {
      text: `Usage: *antilink on  |  *antilink off\nCurrent status: *${status}*`,
    }, { quoted: msg });
    return;
  }

  groups.setEnabled(remoteJid, 'antilink', arg === 'on');

  const reply = arg === 'on'
    ? '✅ Antilink *enabled* for this chat.\nLinks will be deleted and the sender warned. After 5 violations the user is removed.'
    : '🟡 Antilink *disabled* for this chat.';

  await sock.sendMessage(remoteJid, { text: reply }, { quoted: msg });
};
