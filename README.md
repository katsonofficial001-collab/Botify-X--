# Botify X — WhatsApp Bot

A production-ready, multi-user WhatsApp bot built with Node.js, [Baileys](https://github.com/WhiskeySockets/Baileys), and Express.
Pairing-code only (no QR), one Express server, an admin panel for issuing pairing codes, and a 30-day expiry system per user.

- **Version:** v1.0.0
- **Stack:** Node.js · Baileys · Express · dotenv · OpenAI
- **Deploy target:** Railway (zero modification)
- **Pairing portal:** <https://botifyx.up.railway.app/panel>

---

## Features

- **Group Guard**
  - Antilink (deletes links from non-admins when the bot is admin)
  - Anti-status-mention (deletes group messages quoting a status mention)
  - Welcome / Goodbye messages
  - `*tagall` to mention everyone
  - Reply to media/text and repost to status (owner-side trigger)
- **View-once saver** — reply with `👀`, `📥`, or "save" to a view-once. The bot resends it normally and forwards a copy to the owner.
- **Status saver** — reply with "save" to a status. The bot saves it and forwards a copy to the owner.
- **AI** — `*gpt <question>` answers using OpenAI.
- **Menu** — `*menu` lists all commands.
- **Version** — `*version` returns `Botify X v1.0.0`.
- **Block** — `*block` (private chat, owner) blocks a user via reply.
- **Online notification** — sends the "BOTIFY X ONLINE" banner to the owner on connect.
- **Admin panel** at `/panel` — login, pair owner, add users, generate pairing codes, manage 30-day expiry.

---

## Project Structure

```
botify-x/
├── index.js                # Entry point — Express server + bot bootstrap
├── package.json
├── .env.example
├── commands/               # *menu, *version, *tagall, *gpt, *block
├── events/                 # connection, messages, group-participants
├── utils/                  # config, logger, helpers, users, sessionManager
├── auth/                   # Baileys multi-file auth (auto-created)
├── dashboard/              # Admin panel (login + dashboard)
│   ├── server.js
│   └── views/
└── data/
    ├── users.json          # User registry (phone, expiresAt, paired)
    └── owner.json          # Saved owner number after first pairing
```

---

## Push to GitHub

```bash
cd botify-x
git init
git add .
git commit -m "Initial commit — Botify X v1.0.0"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

> The `.gitignore` already excludes `node_modules/`, `.env`, the `auth/` folder, and the data files.

---

## Deploy to Railway (with the `botifyx.up.railway.app` URL)

1. Sign in at <https://railway.app> and click **New Project → Deploy from GitHub repo**.
2. Pick your `botify-x` repo. Railway auto-detects Node.js and runs `npm install` then `npm start`.
3. Open the **Settings** tab and rename the service to **`botifyx`** — this is what Railway uses to build the public domain.
4. Open **Settings → Networking → Generate Domain**. Railway will issue:
   - **`https://botifyx.up.railway.app`**
   - The pairing portal lives at **`https://botifyx.up.railway.app/panel`**.
5. Open the **Variables** tab and add at minimum:
   - `ADMIN_PASSWORD=#jesusfuckingchrist#`
   - `SESSION_SECRET=<a long random string>`
   - `OPENAI_API_KEY=<your key>` (only needed for `*gpt`)
   - (Optional) `ADMIN_USERNAME=katson` — already the default if you skip this.
   - (Optional) `OWNER_NUMBER=<your phone>` — leave blank to pair right from the panel.
6. Wait for the deploy to finish (the **Deployments** tab shows "Active"). The link is now live — no more steps needed.

> **About persistence.** Railway containers are ephemeral by default. To keep WhatsApp sessions across redeploys, attach a Railway **Volume** mounted at `/app/auth` (and a second one at `/app/data` if you also want the user list to survive). Without volumes, you'll need to re-pair after every redeploy — but the panel itself always works.

---

## How to use after deploy

1. Open **<https://botifyx.up.railway.app/panel>**
2. Sign in:
   - **Username:** `katson`
   - **Password:** `#jesusfuckingchrist#`
3. The dashboard shows an **"Pair owner WhatsApp"** card at the top.
   - Type your owner phone number (international format, digits only — e.g. `2348012345678`).
   - Click **Generate owner pairing code**.
   - An 8-character code appears on the page.
4. On your phone: WhatsApp → **Linked devices** → **Link with phone number** → enter the code.
5. The card flips to **"Owner connected"**, and Botify X sends the "BOTIFY X ONLINE" banner to you in WhatsApp.
6. From the same dashboard, **Add a user**: enter their phone number → a pairing code appears → share it with them.
7. Each user is valid for 30 days. Use **+30d**, **Re-pair**, or **Delete** in the table to manage them.

That's the whole flow. No terminal, no Railway log digging, no QR codes.

---

## Local development (optional)

```bash
cp .env.example .env
# fill in OPENAI_API_KEY, SESSION_SECRET (and optionally OWNER_NUMBER)
npm install
npm start
```

Open <http://localhost:3000/panel>, log in, and pair from the dashboard exactly the same way.

---

## Environment variables

| Key              | Required | Description                                                            |
| ---------------- | -------- | ---------------------------------------------------------------------- |
| `PORT`           | no       | HTTP port (defaults to `3000`).                                        |
| `OWNER_NUMBER`   | no       | If set, the owner field on the panel is locked to this number.          |
| `OPENAI_API_KEY` | for `*gpt` | OpenAI API key.                                                      |
| `OPENAI_MODEL`   | no       | Defaults to `gpt-4o-mini`.                                             |
| `ADMIN_USERNAME` | no       | Defaults to `katson`.                                                  |
| `ADMIN_PASSWORD` | yes      | Admin panel password. Default is `#jesusfuckingchrist#` — change it.   |
| `SESSION_SECRET` | yes      | Long random string for the panel cookie.                               |

---

## Commands reference

| Command          | Where        | Who              | What                                            |
| ---------------- | ------------ | ---------------- | ----------------------------------------------- |
| `*menu`          | anywhere     | active users     | Shows the command list                          |
| `*version`       | anywhere     | active users     | `Botify X v1.0.0`                               |
| `*gpt <q>`       | anywhere     | active users     | Asks OpenAI                                     |
| `*tagall [note]` | groups       | active users     | Mentions every participant                      |
| `*block`         | private chat | owner only       | Blocks the user you replied to                  |

Reply triggers (owner-only):

| Trigger                                | Effect                                                    |
| -------------------------------------- | --------------------------------------------------------- |
| Reply `👀` / `📥` / `save` to view-once | Resend normally + forward a copy to owner                 |
| Reply `save` to a quoted status        | Save it and forward a copy to owner                       |

---

## Health check

`GET /health` returns the bot version, owner status, and a list of active sessions.

---

## License

MIT
