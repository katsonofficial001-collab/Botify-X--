'use strict';

module.exports = async function ping({ sock, msg }) {
  const remoteJid = msg.key.remoteJid;

  const sentTs = Number(msg.messageTimestamp || 0) * 1000;
  const now = Date.now();

  const start = process.hrtime.bigint();
  await sock.sendMessage(remoteJid, { text: '🏓 Pinging...' }, { quoted: msg });
  const sendMs = Number(process.hrtime.bigint() - start) / 1e6;

  const roundtripMs = sentTs > 0 ? Math.max(0, now - sentTs) : 0;

  const lines = [
    '🏓 *Pong!*',
    `⚡ Send latency: ${sendMs.toFixed(2)} ms`,
  ];
  if (roundtripMs > 0) {
    lines.push(`📡 Receive delay: ${roundtripMs} ms`);
  }
  lines.push(`🟢 Uptime: ${formatUptime(process.uptime())}`);

  await sock.sendMessage(remoteJid, { text: lines.join('\n') }, { quoted: msg });
};

function formatUptime(seconds) {
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor((seconds / 3600) % 24);
  const d = Math.floor(seconds / 86400);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}
