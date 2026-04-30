'use strict';

const config = require('../utils/config');
const logger = require('../utils/logger');

const ONLINE_MESSAGE = `|||||||||||||||||||||||||
BOTIFY X ONLINE 🚀
|||||||||||||||||||||||||

✅ Connected via pairing portal
⚡ System active
🔐 Secure session established`;

async function onOpen({ session }) {
  const { sock } = session;
  if (!config.owner.jid) {
    logger.warn('OWNER_NUMBER not set — skipping online notification');
    return;
  }
  try {
    await sock.sendMessage(config.owner.jid, { text: ONLINE_MESSAGE });
  } catch (err) {
    logger.error({ err }, 'Failed to send online notification to owner');
  }
}

module.exports = { onOpen, ONLINE_MESSAGE };
