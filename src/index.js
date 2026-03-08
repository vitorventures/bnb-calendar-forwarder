require('dotenv').config();

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const cron = require('node-cron');

const { getUpcomingCheckouts } = require('./calendar');
const { formatCleaningSchedule } = require('./formatter');
const { sendOrUpdateMessage } = require('./whatsapp');

const {
  ICAL_URL,
  WHATSAPP_GROUP_NAME,
  CRON_SCHEDULE = '0 8 * * *',
  LOOKAHEAD_DAYS = '365',
} = process.env;

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

function logError(...args) {
  console.error(new Date().toISOString(), ...args);
}

if (!ICAL_URL || !WHATSAPP_GROUP_NAME) {
  console.error('Missing required env vars: ICAL_URL, WHATSAPP_GROUP_NAME');
  process.exit(1);
}

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: { args: ['--no-sandbox'] },
});

client.on('qr', (qr) => {
  log('Scan the QR code below to authenticate:');
  qrcode.generate(qr, { small: true });
});

client.on('authenticated', () => {
  log('WhatsApp authenticated.');
});

client.on('auth_failure', (msg) => {
  logError('Authentication failed:', msg);
  process.exit(1);
});

let initialized = false;

async function runUpdate() {
  try {
    log('Fetching calendar...');
    const checkouts = await getUpcomingCheckouts(ICAL_URL, parseInt(LOOKAHEAD_DAYS, 10));
    const message = formatCleaningSchedule(checkouts);
    await sendOrUpdateMessage(client, WHATSAPP_GROUP_NAME, message, checkouts);
  } catch (err) {
    logError('Error during update:', err.message);
  }
}

client.on('ready', async () => {
  if (initialized) return;
  initialized = true;

  log('WhatsApp client ready.');

  // Immediate run on startup
  await runUpdate();

  // Scheduled runs
  cron.schedule(CRON_SCHEDULE, () => {
    log('Cron triggered, running update...');
    runUpdate();
  });

  log(`Cron scheduled: ${CRON_SCHEDULE}`);
});

client.initialize();
