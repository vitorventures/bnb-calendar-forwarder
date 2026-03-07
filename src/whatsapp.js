const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, '..', 'state.json');
const PIN_DURATION = 2592000; // 30 days in seconds

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function toDateKey(checkout) {
  return checkout.date.toISOString().split('T')[0];
}

function toLabel(checkout) {
  return checkout.date.toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short' });
}

function buildChangeNotification(oldEntries, newCheckouts) {
  const oldKeys = new Set(oldEntries.map((e) => e.date));
  const newKeys = new Set(newCheckouts.map(toDateKey));

  const added = newCheckouts.filter((c) => !oldKeys.has(toDateKey(c)));
  const removed = oldEntries.filter((e) => !newKeys.has(e.date));

  const lines = ['📋 *Cleaning schedule updated*'];
  if (added.length) lines.push(`➕ Added: ${added.map(toLabel).join(' · ')}`);
  if (removed.length) lines.push(`➖ Removed: ${removed.map((e) => e.label).join(' · ')}`);
  return lines.join('\n');
}

async function sendOrUpdateMessage(client, groupName, text, checkouts) {
  const state = loadState();
  const oldEntries = state.checkouts || [];
  const newEntries = checkouts.map((c) => ({ date: toDateKey(c), label: toLabel(c) }));

  const hasChanged =
    oldEntries.length !== newEntries.length ||
    oldEntries.some((e, i) => e.date !== newEntries[i]?.date);

  if (!hasChanged) {
    console.log('No changes in checkouts, skipping update.');
    return;
  }

  // Find group
  const chats = await client.getChats();
  const group = chats.find(
    (c) => c.isGroup && c.name.toLowerCase() === groupName.toLowerCase()
  );

  if (!group) {
    throw new Error(`WhatsApp group not found: "${groupName}"`);
  }

  // Unpin all currently pinned messages in the group
  try {
    const pinned = await client.getPinnedMessages(group.id._serialized);
    await Promise.all(pinned.map((m) => m.unpin().catch(() => {})));
    if (pinned.length) console.log(`Unpinned ${pinned.length} existing message(s).`);
  } catch (err) {
    console.warn('Could not unpin existing messages:', err.message);
  }

  // Send fresh schedule message and pin it
  const sent = await group.sendMessage(text);

  try {
    await sent.pin(PIN_DURATION);
    console.log('Message pinned for 30 days.');
  } catch (err) {
    console.warn('Could not pin message (bot may need admin rights):', err.message);
  }

  // Send change notification (skip on first run when there's nothing to compare)
  if (oldEntries.length > 0) {
    await group.sendMessage(buildChangeNotification(oldEntries, checkouts));
  }

  saveState({ checkouts: newEntries });
  console.log('New message sent and saved.');
}

module.exports = { sendOrUpdateMessage };
