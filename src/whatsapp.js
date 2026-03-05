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

async function sendOrUpdateMessage(client, groupName, text) {
  const state = loadState();

  // Try to edit existing message
  if (state.messageId && state.chatId) {
    try {
      const chat = await client.getChatById(state.chatId);
      const messages = await chat.fetchMessages({ limit: 100 });
      const existing = messages.find((m) => m.id._serialized === state.messageId);

      if (existing && existing.fromMe) {
        await existing.edit(text);
        console.log('Message edited successfully.');
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

  saveState({ chatId: group.id._serialized, messageId: sent.id._serialized });
  console.log('New message sent and ID saved.');
}

module.exports = { sendOrUpdateMessage };
