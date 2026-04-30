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
│ ${p}gpt <q>    — ask the AI
│ ${p}block      — (DM) reply to a user to block
╰─

╭─ *Group*
│ ${p}tagall                 — mention everyone in group
│ ${p}antilink on|off        — toggle link guard (admins)
│ ${p}antistatusmention on|off — toggle status-mention guard
│ ${p}resetwarn              — reply to a user to clear warnings
╰─

╭─ *Group Guard*
│ • Welcome / Goodbye  (auto)
│ • Antilink           (off by default)
│ • Anti-status-mention (off by default)
│ Threshold: 5 violations → user removed
╰─

╭─ *Save Tools (owner only)*
│ Reply 👀 / 📥 / "save" to a view-once  → unlock
│ Reply "save" to a status               → save & forward
╰─

🔐 Botify X — Production Build`;

  await sock.sendMessage(msg.key.remoteJid, { text }, { quoted: msg });
};
