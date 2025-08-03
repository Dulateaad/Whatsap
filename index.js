const { makeWASocket, useMultiFileAuthState, downloadMediaMessage } = require('@whiskeysockets/baileys');
const { recognizeTextFromImage } = require('./utils/ocr');
const { initDb } = require('./db');
const config = require('./config.json');

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth');
  const sock = makeWASocket({ auth: state, printQRInTerminal: true });

  sock.ev.on('creds.update', saveCreds);
  const db = await initDb();

  function containsAd(text) {
    return config.adKeywords.some(word => text.toLowerCase().includes(word.toLowerCase()));
  }

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;

      const sender = msg.key.participant || msg.key.remoteJid;
      const chatId = msg.key.remoteJid;
      const isPrivate = chatId.endsWith('@s.whatsapp.net');

      // Админская команда
      const message = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
      if (isPrivate && sender === config.admin && message.startsWith('/оплатил')) {
        const [, phone, date] = message.trim().split(' ');
        const userId = (phone.replace(/[^0-9]/g, '') + '@c.us');
        await db.run('INSERT OR REPLACE INTO paid_users (id, until) VALUES (?, ?)', [userId, date]);
        await sock.sendMessage(sender, { text: `✅ Пользователь ${userId} добавлен до ${date}` });
        continue;
      }

      // Проверка рекламного текста
      let text = message || '';
      if (containsAd(text)) {
        const paid = await db.get('SELECT * FROM paid_users WHERE id = ?', [sender]);
        const now = new Date();
        const until = paid ? new Date(paid.until) : null;

        if (!paid || until < now) {
          await sock.sendMessage(chatId, { delete: msg.key });
          await sock.sendMessage(sender, { text: config.warnMessage });
          continue;
        }
      }

      // Проверка изображений на рекламу
      if (msg.message.imageMessage) {
        const buffer = await downloadMediaMessage(msg, 'buffer', {}, { logger: sock.logger, reuploadRequest: sock.updateMediaMessage });
        const textFromImage = await recognizeTextFromImage(buffer);

        if (containsAd(textFromImage)) {
          const paid = await db.get('SELECT * FROM paid_users WHERE id = ?', [sender]);
          const now = new Date();
          const until = paid ? new Date(paid.until) : null;

          if (!paid || until < now) {
            await sock.sendMessage(chatId, { delete: msg.key });
            await sock.sendMessage(sender, { text: config.warnMessage });
          }
        }
      }
    }
  });
}

startBot();
