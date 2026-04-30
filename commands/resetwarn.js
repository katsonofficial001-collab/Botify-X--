'use strict';

const { jidNormalizedUser } = require('@whiskeysockets/baileys');
const groups = require('../utils/groups');
const { isGroupJid, getQuotedMessage, jidToPhone } = require('../utils/helpers');
const { requireGroupAdmin } = require('./_guards');

module.exports = async function resetwarn({ sock, msg, isOwnerSender }) {
  const remoteJid = msg.key.remoteJid;

  if (!isGroupJid(remoteJid)) {
    await sock.sendMessage(remoteJid, {
      text: '❌ This command only works inside a group.',
    }, { quoted: msg });
    return;
  }

  const allowed = await requireGroupAdmin({ sock, msg, isOwnerSender });
  if (!allowed) return;

  const quoted = getQuotedMessage(msg);
  const targetRaw = quoted?.contextInfo?.participant || quoted?.key?.participant;
  if (!targetRaw) {
    await sock.sendMessage(remoteJid, {
      text: 'Reply to the user you want to clear, then send *resetwarn.',
    }, { quoted: msg });
    return;
  }

  const targetJid = jidNormalizedUser(targetRaw);
  const before = groups.getWarnings(remoteJid, targetJid);
  const had = before.antilink + before.antistatusmention;
  groups.resetWarnings(remoteJid, targetJid);

  await sock.sendMessage(remoteJid, {
    text: had > 0
      ? `✅ Warnings cleared for @${jidToPhone(targetJid)} (was ${had}).`
      : `ℹ️ @${jidToPhone(targetJid)} had no warnings.`,
    mentions: [targetJid],
  }, { quoted: msg });
};
