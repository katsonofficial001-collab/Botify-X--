'use strict';

const config = require('../utils/config');

module.exports = async function menu({ sock, msg }) {
  const p = config.bot.prefix;
  const text = `╭━━━〔 *${config.bot.name}* 〕━━━┈⊷
┃ Version: ${config.bot.version}
┃ Prefix:  ${p}
╰━━━━━━━━━━━━━━━━━━┈⊷

╭─ *General*
│ ${p}menu       — show this menu
│ ${p}version    — bot version
│ ${p}ping       — bot response time
│ ${p}gpt <q>    — ask the AI
│ ${p}block      — (DM) reply to a user to block
╰─

╭─ *Group*
│ ${p}tagall                  — mention everyone
│ ${p}antilink on|off         — toggle link guard
│ ${p}antistatusmention on|off — toggle status-mention guard
│ ${p}welcome on|off          — toggle welcome / goodbye
│ ${p}resetwarn               — reply to a user to clear warnings
╰─

╭─ *Group Guard*
│ • All toggles default to OFF (per group)
│ • Threshold: 5 violations → user removed
│ • Bot must be group admin to take action
╰─

╭─ *Owner Save Tools*
│ Reply to a view-once with an *emoji only*  → unlocked to your "Message yourself"
│ Reply to a status with any text or emoji   → status saved to your "Message yourself"
╰─

🔐 Botify X — Production Build`;

  await sock.sendMessage(msg.key.remoteJid, { text }, { quoted: msg });
};
