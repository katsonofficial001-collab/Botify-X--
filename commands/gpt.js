'use strict';

const OpenAI = require('openai');
const config = require('../utils/config');
const logger = require('../utils/logger');

let client = null;
function getClient() {
  if (client) return client;
  if (!config.openai.apiKey) return null;
  client = new OpenAI({ apiKey: config.openai.apiKey });
  return client;
}

module.exports = async function gpt({ sock, msg, args }) {
  const remoteJid = msg.key.remoteJid;
  const question = args.join(' ').trim();
  if (!question) {
    await sock.sendMessage(remoteJid, {
      text: `Usage: ${config.bot.prefix}gpt <your question>`,
    }, { quoted: msg });
    return;
  }

  const ai = getClient();
  if (!ai) {
    await sock.sendMessage(remoteJid, {
      text: '❌ OpenAI is not configured. Set OPENAI_API_KEY in the environment.',
    }, { quoted: msg });
    return;
  }

  try {
    const completion = await ai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: `You are ${config.bot.name}, a concise, helpful WhatsApp assistant.` },
        { role: 'user', content: question },
      ],
      temperature: 0.7,
    });

    const answer = completion.choices?.[0]?.message?.content?.trim() || '🤖 (no response)';
    await sock.sendMessage(remoteJid, { text: answer }, { quoted: msg });
  } catch (err) {
    logger.error({ err }, 'OpenAI request failed');
    await sock.sendMessage(remoteJid, {
      text: `⚠️ AI request failed: ${err.message || 'unknown error'}`,
    }, { quoted: msg });
  }
};
