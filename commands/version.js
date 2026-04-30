'use strict';

const config = require('../utils/config');

module.exports = async function version({ sock, msg }) {
  await sock.sendMessage(
    msg.key.remoteJid,
    { text: `${config.bot.name} ${config.bot.version}` },
    { quoted: msg },
  );
};
