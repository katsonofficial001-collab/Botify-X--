'use strict';

const users = require('../utils/users');

module.exports = async ({ sock, msg, args, session }) => {
  const mode = (args[0] || '').toLowerCase();
  const jid = msg.key.remoteJid;

  if (!['public', 'private'].includes(mode)) {
    return sock.sendMessage(jid, {
      text: 'Usage: .mode public OR .mode private'
    });
  }

  const phone = session.phoneNumber;

  users.updateUser(phone, { mode });

  await sock.sendMessage(jid, {
    text: `✅ Bot mode: *${mode.toUpperCase()}*\n\n${
      mode === 'public'
        ? 'Others can now use your bot'
        : 'Only you can control your bot'
    }`
  });
};
