'use strict';

const fs = require('fs');
const path = require('path');
const config = require('./config');

const dbPath = path.resolve(config.paths.data, 'groups.json');

const FEATURES = ['antilink', 'antistatusmention', 'welcome'];

function ensureDb() {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({ groups: {} }, null, 2));
  }
}

function readDb() {
  ensureDb();
  try {
    const parsed = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    if (!parsed || typeof parsed !== 'object') return { groups: {} };
    if (!parsed.groups || typeof parsed.groups !== 'object') parsed.groups = {};
    return parsed;
  } catch (_) {
    return { groups: {} };
  }
}

function writeDb(db) {
  ensureDb();
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

function defaultGroup() {
  return {
    antilink: false,
    antistatusmention: false,
    welcome: false,
    warnings: {},
  };
}

function getSettings(groupJid) {
  if (!groupJid) return defaultGroup();
  const db = readDb();
  const g = db.groups[groupJid];
  if (!g) return defaultGroup();
  return {
    antilink: !!g.antilink,
    antistatusmention: !!g.antistatusmention,
    welcome: !!g.welcome,
    warnings: g.warnings || {},
  };
}

function isEnabled(groupJid, feature) {
  if (!FEATURES.includes(feature)) return false;
  return !!getSettings(groupJid)[feature];
}

function setEnabled(groupJid, feature, value) {
  if (!groupJid || !FEATURES.includes(feature)) return false;
  const db = readDb();
  if (!db.groups[groupJid]) db.groups[groupJid] = defaultGroup();
  db.groups[groupJid][feature] = !!value;
  writeDb(db);
  return true;
}

function incWarning(groupJid, userJid, feature) {
  if (!groupJid || !userJid || !FEATURES.includes(feature)) return 0;
  const db = readDb();
  if (!db.groups[groupJid]) db.groups[groupJid] = defaultGroup();
  const g = db.groups[groupJid];
  if (!g.warnings) g.warnings = {};
  if (!g.warnings[userJid]) g.warnings[userJid] = {};
  g.warnings[userJid][feature] = (g.warnings[userJid][feature] || 0) + 1;
  writeDb(db);
  return g.warnings[userJid][feature];
}

function getWarnings(groupJid, userJid) {
  if (!groupJid || !userJid) return { antilink: 0, antistatusmention: 0 };
  const db = readDb();
  const w = db.groups[groupJid]?.warnings?.[userJid] || {};
  return {
    antilink: w.antilink || 0,
    antistatusmention: w.antistatusmention || 0,
  };
}

function resetWarnings(groupJid, userJid) {
  if (!groupJid || !userJid) return false;
  const db = readDb();
  const g = db.groups[groupJid];
  if (!g || !g.warnings || !g.warnings[userJid]) return false;
  delete g.warnings[userJid];
  writeDb(db);
  return true;
}

module.exports = {
  FEATURES,
  getSettings,
  isEnabled,
  setEnabled,
  incWarning,
  getWarnings,
  resetWarnings,
};
