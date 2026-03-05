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
