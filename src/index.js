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
  LOOKAHEAD_DAYS = '60',
} = process.env;

if (!ICAL_URL || !WHATSAPP_GROUP_NAME) {
  console.error('Missing required env vars: ICAL_URL, WHATSAPP_GROUP_NAME');
  process.exit(1);
}

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: { args: ['--no-sandbox'] },
});

client.on('qr', (qr) => {
  console.log('Scan the QR code below to authenticate:');
  qrcode.generate(qr, { small: true });
});

client.on('authenticated', () => {
  console.log('WhatsApp authenticated.');
});

client.on('auth_failure', (msg) => {
  console.error('Authentication failed:', msg);
  process.exit(1);
});

let initialized = false;

async function runUpdate() {
  try {
    console.log('Fetching calendar...');
    const checkouts = await getUpcomingCheckouts(ICAL_URL, parseInt(LOOKAHEAD_DAYS, 10));
    const message = formatCleaningSchedule(checkouts);
    await sendOrUpdateMessage(client, WHATSAPP_GROUP_NAME, message, checkouts);
  } catch (err) {
    console.error('Error during update:', err.message);
  }
}

client.on('ready', async () => {
  if (initialized) return;
  initialized = true;

  console.log('WhatsApp client ready.');

  // Immediate run on startup
  await runUpdate();

  // Scheduled runs
  cron.schedule(CRON_SCHEDULE, () => {
    console.log('Cron triggered, running update...');
    runUpdate();
  });

  console.log(`Cron scheduled: ${CRON_SCHEDULE}`);
});

client.initialize();
