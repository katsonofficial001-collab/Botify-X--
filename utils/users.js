'use strict';

const fs = require('fs');
const path = require('path');
const config = require('./config');

const dbPath = path.resolve(config.paths.usersDb);

function ensureDb() {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify({ users: [] }, null, 2));
}

function readDb() {
  ensureDb();
  try {
    return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  } catch (_) {
    return { users: [] };
  }
}

function writeDb(db) {
  ensureDb();
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function listUsers() {
  return readDb().users.map((u) => ({
    ...u,
    expired: isExpired(u),
  }));
}

function getUser(phone) {
  const number = normalizePhone(phone);
  const db = readDb();
  return db.users.find((u) => u.phone === number) || null;
}

function addUser(phone, days = config.defaults.expiryDays) {
  const number = normalizePhone(phone);
  if (!number) throw new Error('Invalid phone number');
  const db = readDb();
  let user = db.users.find((u) => u.phone === number);
  const now = Date.now();
  const expiresAt = now + days * 24 * 60 * 60 * 1000;
  if (user) {
    user.expiresAt = expiresAt;
    user.updatedAt = now;
  } else {
    user = {
      phone: number,
      createdAt: now,
      updatedAt: now,
      expiresAt,
      paired: false,
    };
    db.users.push(user);
  }
  writeDb(db);
  return user;
}

function removeUser(phone) {
  const number = normalizePhone(phone);
  const db = readDb();
  const before = db.users.length;
  db.users = db.users.filter((u) => u.phone !== number);
  writeDb(db);
  return db.users.length < before;
}

function markPaired(phone, paired = true) {
  const number = normalizePhone(phone);
  const db = readDb();
  const user = db.users.find((u) => u.phone === number);
  if (!user) return null;
  user.paired = paired;
  user.updatedAt = Date.now();
  writeDb(db);
  return user;
}

function isExpired(user) {
  if (!user) return true;
  return Date.now() > Number(user.expiresAt || 0);
}

function isAuthorized(phone) {
  const user = getUser(phone);
  if (!user) return false;
  return !isExpired(user);
}

module.exports = {
  listUsers,
  getUser,
  addUser,
  removeUser,
  markPaired,
  isExpired,
  isAuthorized,
  normalizePhone,
};
