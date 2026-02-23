---
name: telegram-bot-development
description: Telegram Bot API, polling, webhooks, message formatting, inline keyboards, and file sending. Use when building or extending Julia's Telegram communication layer via OpenClaw.
---

# Telegram Bot Development

## Bot API Basics
```ts
// Polling approach (simpler, no public URL needed)
import TelegramBot from 'node-telegram-bot-api';
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, { polling: true });

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  await bot.sendMessage(chatId, `You said: ${text}`);
});
```

## Message Formatting (MarkdownV2)
```ts
// Escape special chars for MarkdownV2
const escape = (s: string) => s.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');

await bot.sendMessage(chatId, `*Bold* _italic_ \`code\`\n[Link](https://example.com)`, {
  parse_mode: 'MarkdownV2'
});
```

## Inline Keyboards
```ts
await bot.sendMessage(chatId, 'Choose an option:', {
  reply_markup: {
    inline_keyboard: [[
      { text: '✅ Approve', callback_data: 'approve' },
      { text: '❌ Reject', callback_data: 'reject' }
    ]]
  }
});

bot.on('callback_query', async (query) => {
  await bot.answerCallbackQuery(query.id);
  await bot.sendMessage(query.message!.chat.id, `You chose: ${query.data}`);
});
```

## File Sending
```ts
await bot.sendDocument(chatId, fs.createReadStream('./report.pdf'), {
  caption: 'Daily security report'
});
await bot.sendPhoto(chatId, 'https://example.com/image.png');
```

## Julia/OpenClaw Integration
- OpenClaw handles the Telegram connection natively
- Julia communicates via `julia-relay` skill → `POST /incoming` on the bridge
- Never directly call the Telegram API from the orchestrator — go through OpenClaw
- For escalations, use: `POST http://localhost:3001/incoming` with Julia's chatId
