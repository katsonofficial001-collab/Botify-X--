'use strict';

const logger = require('../utils/logger');
const { jidToPhone } = require('../utils/helpers');

async function handleGroupParticipants({ session, payload }) {
  const { sock } = session;
  const { id, participants, action } = payload;

  let metadata;
  try {
    metadata = await sock.groupMetadata(id);
  } catch (err) {
    logger.warn({ err }, 'Could not fetch group metadata');
    return;
  }

  const groupName = metadata?.subject || 'this group';

  for (const participant of participants) {
    const phone = jidToPhone(participant);
    try {
      if (action === 'add') {
        await sock.sendMessage(id, {
          text: `👋 Welcome @${phone} to *${groupName}*!\nGlad to have you here.`,
          mentions: [participant],
        });
      } else if (action === 'remove') {
        await sock.sendMessage(id, {
          text: `👋 Goodbye @${phone}.\nWe wish you all the best.`,
          mentions: [participant],
        });
      }
    } catch (err) {
      logger.error({ err, id, action }, 'Failed to send group event message');
    }
  }
}

module.exports = handleGroupParticipants;
