# OpenClaw MAX Messenger Plugin

[![OpenClaw](https://img.shields.io/badge/OpenClaw-Plugin-blue)](https://github.com/openclaw/openclaw)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

A complete MAX Messenger channel plugin for OpenClaw Gateway, enabling seamless integration with MAX Messenger bots through polling and webhook support.

## Features

- ✅ **Message Reception** - Long polling to receive messages from MAX API
- ✅ **Message Sending** - Send text messages to users (outbound)
- ✅ **Cron / Notification Delivery** - Receive cron job reminders and system notifications in MAX
- ✅ **File Handling** - Receive and process file attachments (docx, pdf, images, etc.)
- ✅ **Image Support** - Handle image messages
- ✅ **Typing Indicators** - Show typing status to users
- ✅ **Access Control** - `dmPolicy` (open/pairing/closed) + `allowFrom` allow-list

## Prerequisites

- **OpenClaw Gateway** v2026.3.8 or higher
- **Node.js** v22 or higher
- **MAX Bot Token** — from the MAX developer portal

## Installation

### Manual (recommended)

```bash
cd ~/.nvm/versions/node/v24.14.0/lib/node_modules/openclaw/extensions/max-messenger
git pull origin main
openclaw gateway restart
```

### From source

```bash
git clone https://github.com/biguxuzz/openclaw-max-plugin.git
npm install
cp -r openclaw-max-plugin ~/.nvm/versions/node/v24.14.0/lib/node_modules/openclaw/extensions/max-messenger
openclaw gateway restart
```

## Configuration

Add MAX configuration to your OpenClaw `openclaw.json`:

```json
{
  "channels": {
    "max": {
      "enabled": true,
      "dmPolicy": "pairing",
      "accounts": {
        "default": {
          "token": "YOUR_MAX_BOT_TOKEN",
          "enabled": true,
          "dmPolicy": "pairing",
          "allowFrom": ["3411927"]
        }
      }
    }
  }
}
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable/disable the MAX channel |
| `token` | string | required | Your MAX bot token |
| `baseUrl` | string | `https://platform-api.max.ru` | MAX API base URL (optional) |
| `dmPolicy` | string | `pairing` | DM policy: `open`, `pairing`, or `closed` |
| `allowFrom` | string[] | `[]` | List of allowed user IDs |

### Direct Message Policies

- **`open`** — Accept all direct messages
- **`pairing`** — Require pairing before accepting DMs (default)
- **`closed`** — Reject all direct messages

## Usage

After configuration and gateway restart, the plugin automatically:

- Starts polling for new messages from MAX API
- Delivers inbound messages (text, files, images) to your AI assistant
- Sends outbound messages back to users in MAX
- Delivers cron job notifications and reminders to MAX
- Enforces `dmPolicy` and `allowFrom` access control
- Shows typing indicators while processing

### Sending messages via cron

```bash
# One-time reminder
openclaw cron add --name "reminder" --at "2026-03-18T09:00:00+03:00" \
  --message "Time for standup!" --to "max:3411927" --announce

# Recurring reminder (daily at 09:00 MSK)
openclaw cron add --name "standup" --cron "0 9 * * *" \
  --tz "Europe/Moscow" --message "Standup time" --to "max:3411927" --announce
```

### Receiving files

When a user sends a file in MAX, the plugin downloads it and makes it available to the AI assistant. Supported formats: docx, pdf, images, txt, and others.

## Architecture

```
max-messenger/
├── src/
│   ├── api.ts          # MAX API client (sendMessage, getUpdates, sendAction, etc.)
│   ├── channel.ts      # Gateway channel plugin + outbound adapter
│   ├── provider.ts     # Provider monitor
│   ├── runtime.ts      # Long polling loop, message handling, file download
│   ├── types.ts        # TypeScript types
│   └── webhook.ts      # Webhook handler (alternative to polling)
├── index.ts            # Plugin entry point
├── openclaw.plugin.json  # Plugin manifest
├── package.json
└── tsconfig.json
```

## MAX API Reference

### Sending a text message

```typescript
await client.sendMessage({
  user_id: 123456,
  text: 'Hello from OpenClaw!'
});
```

### Getting updates (Long Polling)

```typescript
const { updates, marker } = await client.getUpdates({
  limit: 100,
  timeout: 30,
  marker: lastMarker
});
```

### Typing indicator

```typescript
await client.sendAction({
  chatId: 'user123',
  action: 'typing_on'
});
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -am 'Add my feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Submit a Pull Request

## Resources

- [MAX API Documentation](https://dev.max.ru)
- [OpenClaw Documentation](https://docs.openclaw.ai)
- [OpenClaw GitHub](https://github.com/openclaw/openclaw)
- [GitHub Repository](https://github.com/biguxuzz/openclaw-max-plugin)
- [Community Discord](https://discord.com/invite/clawd)

## License

MIT License - See [LICENSE](LICENSE) for details.
