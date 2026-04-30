'use strict';

const { isGroupJid, jidToPhone } = require('../utils/helpers');

module.exports = async function tagall({ sock, msg, args }) {
  const remoteJid = msg.key.remoteJid;
  if (!isGroupJid(remoteJid)) {
    await sock.sendMessage(remoteJid, { text: '❌ This command works in groups only.' }, { quoted: msg });
    return;
  }

  const meta = await sock.groupMetadata(remoteJid);
  const participants = meta.participants || [];
  const note = args.join(' ').trim() || 'Group attention';

  const mentions = participants.map((p) => p.id);
  let body = `📣 *${note}*\n\n`;
  for (const p of participants) {
    body += `• @${jidToPhone(p.id)}\n`;
  }

  await sock.sendMessage(remoteJid, { text: body, mentions }, { quoted: msg });
};
