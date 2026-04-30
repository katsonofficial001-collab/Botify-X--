'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');

const dataDir = 'data';
const ownerFile = path.join(dataDir, 'owner.json');

let ownerCache = null;
let ownerLoaded = false;

function loadOwnerFromFile() {
  ownerLoaded = true;
  try {
    const raw = fs.readFileSync(path.resolve(ownerFile), 'utf8');
    const parsed = JSON.parse(raw);
    ownerCache = parsed.phone ? String(parsed.phone).replace(/\D/g, '') : '';
  } catch (_) {
    ownerCache = '';
  }
}

function getOwnerNumber() {
  const env = (process.env.OWNER_NUMBER || '').replace(/\D/g, '');
  if (env) return env;
  if (!ownerLoaded) loadOwnerFromFile();
  return ownerCache || '';
}

function setOwnerNumber(phone) {
  const number = String(phone || '').replace(/\D/g, '');
  if (!number) return '';
  const dir = path.resolve(dataDir);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.resolve(ownerFile),
    JSON.stringify({ phone: number, savedAt: Date.now() }, null, 2),
  );
  ownerCache = number;
  ownerLoaded = true;
  return number;
}

const config = {
  bot: {
    name: 'Botify X',
    version: 'v1.0.0',
    prefix: '*',
  },
  server: {
    port: parseInt(process.env.PORT, 10) || 3000,
  },
  owner: {
    get number() {
      return getOwnerNumber();
    },
    get jid() {
      const n = getOwnerNumber();
      return n ? `${n}@s.whatsapp.net` : '';
    },
    set(phone) {
      return setOwnerNumber(phone);
    },
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
  },
  admin: {
    username: process.env.ADMIN_USERNAME || 'katson',
    password: process.env.ADMIN_PASSWORD || '#jesusfuckingchrist#',
    sessionSecret:
      process.env.SESSION_SECRET ||
      'botify-x-default-session-secret-change-me',
  },
  paths: {
    auth: 'auth',
    data: dataDir,
    usersDb: path.join(dataDir, 'users.json'),
    ownerFile,
  },
  defaults: {
    expiryDays: 30,
  },
};

module.exports = config;
