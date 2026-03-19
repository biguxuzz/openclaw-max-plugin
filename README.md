# OpenClaw MAX Messenger Plugin

[![OpenClaw](https://img.shields.io/badge/OpenClaw-Plugin-blue)](https://github.com/openclaw/openclaw)
[![npm](https://img.shields.io/npm/v/@biguxuzz/max)](https://www.npmjs.com/package/@biguxuzz/max)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

A MAX Messenger channel plugin for OpenClaw Gateway — long polling and webhook support, file attachments, typing indicators, and flexible access control.

## Features

- ✅ **Message Reception** - Long polling or webhook to receive messages from MAX API
- ✅ **Message Sending** - Send text messages to users (outbound)
- ✅ **Cron / Notification Delivery** - Receive cron job reminders and system notifications in MAX
- ✅ **File Handling** - Receive and process file attachments (docx, pdf, images, etc.)
- ✅ **Image Support** - Handle image messages with sendMedia outbound
- ✅ **Typing Indicators** - Show typing status, refreshed every 5 s while AI processes
- ✅ **Webhook Secret Validation** - `X-Max-Bot-Api-Secret` header check
- ✅ **Access Control** - `dmPolicy` (`open` / `pairing` / `allowlist` / `closed` / `disabled`) + `allowFrom`

## Prerequisites

- **OpenClaw Gateway** v2026.3.8 or higher
- **Node.js** v22 or higher
- **MAX Bot Token** — obtained from the MAX developer portal (see below)

## How to create a MAX bot

1. Go to [business.max.ru](https://business.max.ru) and log in with your MAX account.
2. Open **Bots** → **Create bot**.
3. Fill in the name and description, submit for moderation (usually approved within minutes).
4. Once approved, copy your **Bot API token** from the bot settings page.

## Installation

### Via openclaw plugins (recommended)

```bash
openclaw plugins install @biguxuzz/max
openclaw gateway restart
```

### Manual

```bash
cd ~/.nvm/versions/node/v24.14.0/lib/node_modules/openclaw/extensions/max-messenger
git pull origin main
openclaw gateway restart
```

### From source

```bash
git clone https://github.com/biguxuzz/openclaw-max-plugin.git
cd openclaw-max-plugin
npm install && npm run build
cp -r . ~/.nvm/versions/node/v24.14.0/lib/node_modules/openclaw/extensions/max-messenger
openclaw gateway restart
```

## Configuration

### Minimal (flat config, long polling)

```json
{
  "channels": {
    "max": {
      "token": "YOUR_MAX_BOT_TOKEN",
      "dmPolicy": "pairing",
      "allowFrom": ["3411927"]
    }
  }
}
```

### With accounts (multi-account)

```json
{
  "channels": {
    "max": {
      "accounts": {
        "default": {
          "token": "YOUR_MAX_BOT_TOKEN",
          "dmPolicy": "pairing",
          "allowFrom": ["3411927"]
        }
      }
    }
  }
}
```

### With webhook (production)

```json
{
  "channels": {
    "max": {
      "token": "YOUR_MAX_BOT_TOKEN",
      "webhookUrl": "https://your-domain.com/max/webhook",
      "webhookSecret": "random_secret_string",
      "webhookPath": "/max/webhook",
      "dmPolicy": "pairing",
      "allowFrom": ["3411927"]
    }
  }
}
```

MAX will send events to `webhookUrl`; incoming requests are validated against `webhookSecret` via the `X-Max-Bot-Api-Secret` header.

### Via environment variable

If you prefer not to store the token in `openclaw.json`:

```bash
MAX_BOT_TOKEN=your_token openclaw gateway start
```

The plugin checks `MAX_BOT_TOKEN` first, then `MAX_API_TOKEN`, then the `token` field in config.

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `token` | string | — | MAX Bot API token |
| `enabled` | boolean | `true` | Enable/disable the MAX channel |
| `dmPolicy` | string | `pairing` | DM access policy (see below) |
| `allowFrom` | string[] | `[]` | Allowed MAX user IDs |
| `webhookUrl` | string | — | Public webhook URL (if omitted, uses long polling) |
| `webhookSecret` | string | — | Secret for `X-Max-Bot-Api-Secret` header validation |
| `webhookPath` | string | `/max/webhook` | Local HTTP path for webhook registration |

### Direct Message Policies

| Policy | Behaviour |
|--------|-----------|
| `open` | Accept messages from anyone |
| `pairing` | Accept only from users in `allowFrom` (default) |
| `allowlist` | Alias for `pairing` — clearer intent |
| `closed` | Reject all direct messages |
| `disabled` | Completely disable inbound message processing |

## Usage

After configuration and gateway restart, the plugin:

- Starts long polling **or** registers a webhook with MAX
- Delivers inbound messages (text, files, images) to your AI assistant
- Sends outbound messages back to users
- Delivers cron job notifications and reminders
- Enforces `dmPolicy` / `allowFrom` access control
- Shows typing indicator while processing (refreshed every 5 s)

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

When a user sends a file in MAX the plugin downloads it and makes it available to the AI assistant. Supported: docx, pdf, images, txt, and other common formats.

## Architecture

```
max-messenger/
├── src/
│   ├── api.ts          # MAX API client (sendMessage, getUpdates, sendAction)
│   ├── channel.ts      # Gateway channel plugin + outbound adapter
│   ├── provider.ts     # Provider monitor
│   ├── runtime.ts      # Long polling loop, message handling, file download
│   ├── types.ts        # TypeScript types
│   └── webhook.ts      # Webhook handler with secret validation
├── index.ts            # Plugin entry point
├── openclaw.plugin.json  # Plugin manifest
├── package.json
└── tsconfig.json
```

## Resources

- [MAX API Documentation](https://dev.max.ru)
- [MAX Bot Developer Portal](https://business.max.ru)
- [OpenClaw Documentation](https://docs.openclaw.ai)
- [OpenClaw GitHub](https://github.com/openclaw/openclaw)
- [Plugin Repository](https://github.com/biguxuzz/openclaw-max-plugin)
- [npm Package](https://www.npmjs.com/package/@biguxuzz/max)

## License

MIT License — see [LICENSE](LICENSE) for details.
