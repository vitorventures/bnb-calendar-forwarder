# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`bnb-calendar-forwarder` is a Node.js bot that fetches Lodgify reservation checkout dates via iCal and sends/updates a cleaning schedule in a WhatsApp group. It runs as a persistent process, checks the calendar on a cron schedule, and edits a single pinned message rather than sending new ones.

## Tech Stack

- **Runtime**: Node.js
- **Key packages**: `whatsapp-web.js`, `qrcode-terminal`, `node-ical`, `node-cron`, `dotenv`

## Development Setup

```bash
npm install
cp .env.example .env   # fill in ICAL_URL, WHATSAPP_GROUP_NAME, CRON_SCHEDULE, LOOKAHEAD_DAYS
node src/index.js      # scan QR on first run; keep running for schedule
```

## Running

```bash
npm start
```

On first run, scan the QR code displayed in the terminal. The session is persisted to `.wwebjs_auth/` so no re-scan is needed on restart.

## Production Deployment

Runs on a GCP e2-small instance (Debian 12) managed by pm2.

```bash
pm2 start src/index.js --name bnb-bot
pm2 save && pm2 startup   # survive reboots
pm2 logs bnb-bot          # check logs
pm2 restart bnb-bot       # restart after code changes
```

To deploy changes:
```bash
# locally
git push

# on server
ssh -i ~/.ssh/id_rsa vzanatta@34.170.253.132
cd bnb-calendar-forwarder && git pull && pm2 restart bnb-bot
```

Required system packages (Debian/Ubuntu):
```bash
sudo apt-get install -y libnspr4 libnss3 libgbm1 libxss1 libasound2 libcairo2 libpango-1.0-0 \
  libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 \
  libxfixes3 libxrandr2 libxtst6
```

## Behaviour Notes

- On each cron run, the bot compares new checkouts against the last known ones (stored in `state.json`)
- **No changes**: skips silently — no edit, no message
- **Changes detected**: edits the pinned message (updating the `Updated:` date) and drops a short unpinned notification in the chat listing what was added/removed
- When the tracked message is gone, it sends a new one, unpins all currently pinned messages, and pins the new one for 30 days
- Pinning requires the WhatsApp account to be a **group admin**
- `state.json` (gitignored) tracks the last sent `messageId`, `chatId`, and `checkouts` (for change detection)
- WhatsApp session tied to the phone — phone must stay connected to the internet
