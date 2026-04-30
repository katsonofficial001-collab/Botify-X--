'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');

const config = require('../utils/config');
const users = require('../utils/users');
const sessionManager = require('../utils/sessionManager');

function renderTemplate(filename, vars = {}) {
  const filePath = path.join(__dirname, 'views', filename);
  let html = fs.readFileSync(filePath, 'utf8');
  for (const [key, value] of Object.entries(vars)) {
    html = html.split(`{{${key}}}`).join(value == null ? '' : String(value));
  }
  return html;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function requireAuth(req, res, next) {
  if (req.session?.authenticated) return next();
  return res.redirect('/panel/login');
}

function buildPanel() {
  const router = express.Router();

  router.use(
    session({
      secret: config.admin.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 8 },
    }),
  );

  router.use(express.urlencoded({ extended: true }));
  router.use(express.json());

  router.get('/', requireAuth, (req, res) => res.redirect('/panel/dashboard'));

  router.get('/login', (req, res) => {
    if (req.session?.authenticated) return res.redirect('/panel/dashboard');
    res.send(renderTemplate('login.html', { error: '' }));
  });

  router.post('/login', (req, res) => {
    const { username, password } = req.body || {};
    if (username === config.admin.username && password === config.admin.password) {
      req.session.authenticated = true;
      return res.redirect('/panel/dashboard');
    }
    res.status(401).send(
      renderTemplate('login.html', {
        error: '<div class="error">Invalid username or password.</div>',
      }),
    );
  });

  router.post('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/panel/login'));
  });

  router.get('/dashboard', requireAuth, (req, res) => {
    const ownerStatus = sessionManager.ownerStatus();
    const ownerError = req.session.ownerError;
    delete req.session.ownerError;
    const all = users.listUsers();

    const rows = all
      .map((u) => {
        const expires = new Date(u.expiresAt).toISOString().slice(0, 10);
        const status = u.expired
          ? '<span class="badge red">expired</span>'
          : u.paired
            ? '<span class="badge green">active</span>'
            : '<span class="badge amber">pending</span>';
        return `<tr>
          <td>${escapeHtml(u.phone)}</td>
          <td>${expires}</td>
          <td>${status}</td>
          <td>
            <form method="POST" action="/panel/users/${escapeHtml(u.phone)}/renew" style="display:inline">
              <button class="btn small">+30d</button>
            </form>
            <form method="POST" action="/panel/users/${escapeHtml(u.phone)}/pair" style="display:inline">
              <button class="btn small primary">Re-pair</button>
            </form>
            <form method="POST" action="/panel/users/${escapeHtml(u.phone)}/delete" style="display:inline" onsubmit="return confirm('Delete this user?')">
              <button class="btn small danger">Delete</button>
            </form>
          </td>
        </tr>`;
      })
      .join('');

    let ownerCard;
    if (ownerStatus.connected) {
      ownerCard = `<div class="card success">
        <div class="row" style="justify-content: space-between;">
          <div>
            <h2 style="margin:0">Owner connected</h2>
            <p class="muted" style="margin: 4px 0 0;">Phone: <strong>${escapeHtml(ownerStatus.phone || 'unknown')}</strong></p>
          </div>
          <span class="badge green">online</span>
        </div>
        <form method="POST" action="/panel/owner/unpair" style="margin-top:14px" onsubmit="return confirm('Unpair the owner WhatsApp?')">
          <button class="btn ghost">Unpair owner</button>
        </form>
      </div>`;
    } else {
      const pendingCode = ownerStatus.pairing?.code;
      const pendingPhone = ownerStatus.pairing?.phone;
      const codeBlock = pendingCode
        ? `<div class="code">${escapeHtml(pendingCode)}</div>
           <p class="muted">Pair on phone <strong>${escapeHtml(pendingPhone || '')}</strong> within 60 seconds. WhatsApp → Linked devices → Link with phone number.</p>`
        : '';
      const errorBlock = ownerError
        ? `<div class="error" style="margin-top:12px">${escapeHtml(ownerError)}</div>`
        : '';

      ownerCard = `<div class="card highlight">
        <div class="row" style="justify-content: space-between;">
          <div>
            <h2 style="margin:0">Pair owner WhatsApp</h2>
            <p class="muted" style="margin: 4px 0 0;">This is your bot account. Pair it once to bring Botify X online.</p>
          </div>
          <span class="badge amber">not paired</span>
        </div>
        <form method="POST" action="/panel/owner/pair">
          <label>Owner phone number</label>
          <input name="phone" type="tel" placeholder="2348012345678" value="${escapeHtml(ownerStatus.phone || '')}" ${ownerStatus.fromEnv ? 'readonly' : ''} required />
          ${ownerStatus.fromEnv ? '<p class="muted" style="margin: 6px 0 0;">Set via OWNER_NUMBER environment variable.</p>' : ''}
          <div class="row" style="margin-top: 14px;">
            <button class="btn">Generate owner pairing code</button>
          </div>
        </form>
        ${codeBlock}
        ${errorBlock}
      </div>`;
    }

    const flashCode = req.session.lastPairing;
    delete req.session.lastPairing;
    const userPairBlock = flashCode
      ? `<div class="card success">
          <h3>User pairing code</h3>
          <p>Phone: <strong>${escapeHtml(flashCode.phone)}</strong></p>
          <div class="code">${escapeHtml(flashCode.code)}</div>
          <p class="muted">Open WhatsApp on that phone → Linked devices → Link with phone number → enter the code above.</p>
        </div>`
      : '';

    res.send(
      renderTemplate('dashboard.html', {
        ownerCard,
        userPairBlock,
        rows: rows || '<tr><td colspan="4" class="muted">No users yet.</td></tr>',
        botName: config.bot.name,
        botVersion: config.bot.version,
      }),
    );
  });

  router.post('/owner/pair', requireAuth, async (req, res) => {
    const phone = users.normalizePhone(req.body?.phone);
    if (!phone) {
      req.session.ownerError = 'Please enter a valid phone number (digits only).';
      return res.redirect('/panel/dashboard');
    }
    try {
      await sessionManager.requestOwnerPairing(phone);
    } catch (err) {
      req.session.ownerError = err.message || 'Failed to start owner pairing.';
    }
    res.redirect('/panel/dashboard');
  });

  router.post('/owner/unpair', requireAuth, async (req, res) => {
    await sessionManager.shutdownSession('owner').catch(() => {});
    res.redirect('/panel/dashboard');
  });

  router.post('/users', requireAuth, async (req, res) => {
    const phone = users.normalizePhone(req.body?.phone);
    if (!phone) return res.status(400).send('Invalid phone');

    try {
      users.addUser(phone);
      const result = await sessionManager.requestPairingCodeFor(phone);
      req.session.lastPairing = {
        phone,
        code: result.pairingCode || (result.alreadyConnected ? 'Already connected' : 'Pending'),
      };
    } catch (err) {
      req.session.lastPairing = { phone, code: `Error: ${err.message}` };
    }
    res.redirect('/panel/dashboard');
  });

  router.post('/users/:phone/renew', requireAuth, (req, res) => {
    users.addUser(req.params.phone);
    res.redirect('/panel/dashboard');
  });

  router.post('/users/:phone/pair', requireAuth, async (req, res) => {
    const phone = users.normalizePhone(req.params.phone);
    try {
      const result = await sessionManager.requestPairingCodeFor(phone);
      req.session.lastPairing = {
        phone,
        code: result.pairingCode || (result.alreadyConnected ? 'Already connected' : 'Pending'),
      };
    } catch (err) {
      req.session.lastPairing = { phone, code: `Error: ${err.message}` };
    }
    res.redirect('/panel/dashboard');
  });

  router.post('/users/:phone/delete', requireAuth, async (req, res) => {
    const phone = users.normalizePhone(req.params.phone);
    await sessionManager.shutdownSession(`user-${phone}`).catch(() => {});
    users.removeUser(phone);
    res.redirect('/panel/dashboard');
  });

  return router;
}

module.exports = { buildPanel };
