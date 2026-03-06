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

  // Try to edit existing message
  if (state.messageId && state.chatId) {
    try {
      const chat = await client.getChatById(state.chatId);
      const messages = await chat.fetchMessages({ limit: 100 });
      const existing = messages.find((m) => m.id._serialized === state.messageId);

      if (existing && existing.fromMe) {
        if (!hasChanged) {
          console.log('No changes in checkouts, skipping update.');
          return;
        }
        await existing.edit(text);
        console.log('Message edited successfully.');
        await chat.sendMessage(buildChangeNotification(oldEntries, checkouts));
        saveState({ ...state, checkouts: newEntries });
        return;
      }
    } catch (err) {
      console.warn('Could not edit stored message, will send new one:', err.message);
    }
  }

  // Find group and send new message
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

  const sent = await group.sendMessage(text);

  // Pin new message for 30 days (requires bot to be group admin)
  try {
    await sent.pin(PIN_DURATION);
    console.log('Message pinned for 30 days.');
  } catch (err) {
    console.warn('Could not pin message (bot may need admin rights):', err.message);
  }

  saveState({ chatId: group.id._serialized, messageId: sent.id._serialized, checkouts: newEntries });
  console.log('New message sent and ID saved.');
}

module.exports = { sendOrUpdateMessage };
