# OpenClaw MAX Messenger Plugin

[![OpenClaw](https://img.shields.io/badge/OpenClaw-Plugin-blue)](https://github.com/openclaw/openclaw)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![npm](https://img.shields.io/npm/v/@openclaw/max)](https://www.npmjs.com/package/@openclaw/max)

A complete MAX Messenger channel plugin for OpenClaw Gateway, enabling seamless integration with MAX Messenger bots through polling and webhook support.

## Features

- ✅ **Message Reception** - Long polling to receive messages from MAX API
- ✅ **Message Sending** - Send text messages to users
- ✅ **File Handling** - Support for file attachments and downloads
- ✅ **Image Support** - Handle image messages
- ✅ **Webhook Support** - Optional webhook mode for real-time updates
- ✅ **Typing Indicators** - Show typing status to users
- ✅ **Direct Message Policies** - Configurable DM handling (open/pairing/closed)
- ✅ **Access Control** - Allow-list specific users or domains

## Prerequisites

- **OpenClaw Gateway** v2026.3.8 or higher
- **Node.js** v22 or higher
- **MAX Bot Token** - Get yours from the MAX developer portal

## Installation

### Using OpenClaw CLI

```bash
openclaw plugins install @openclaw/max
```

### Manual Installation

1. Clone or download the plugin:
```bash
git clone https://github.com/biguxuzz/openclaw-max-plugin.git
cd openclaw-max-plugin
npm install
npm run build
```

2. Copy to OpenClaw extensions directory:
```bash
cp -r openclaw-max-plugin ~/.nvm/versions/node/v24.14.0/lib/node_modules/openclaw/extensions/max-messenger
```

## Configuration

Add MAX configuration to your OpenClaw `gateway.json`:

```json
{
  "channels": {
    "max": {
      "enabled": true,
      "accounts": {
        "default": {
          "token": "YOUR_MAX_BOT_TOKEN",
          "baseUrl": "https://platform-api.max.ru"
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
| `allowFrom` | string[] | `[]` | List of allowed user IDs or domains |

### Direct Message Policies

- **`open`** - Accept all direct messages
- **`pairing`** - Require pairing before accepting DMs
- **`closed`** - Reject all direct messages

### Access Control Example

```json
{
  "channels": {
    "max": {
      "enabled": true,
      "accounts": {
        "default": {
          "token": "YOUR_MAX_BOT_TOKEN",
          "dmPolicy": "pairing",
          "allowFrom": ["user123", "company-domain"]
        }
      }
    }
  }
}
```

## Usage

After configuration, restart OpenClaw Gateway:

```bash
systemctl --user restart openclaw-gateway.service
```

The plugin will automatically:
- Start polling for new messages from MAX
- Handle inbound messages and deliver them to your AI assistant
- Send outbound messages back to users in MAX
- Process file attachments and images

## Development

### Build

```bash
npm install
npm run build
```

### Project Structure

```
openclaw-max-plugin/
├── src/
│   ├── api.ts          # MAX API client
│   ├── channel.ts      # Gateway channel integration
│   ├── provider.ts     # Provider monitor
│   ├── runtime.ts      # Long polling runtime
│   ├── types.ts        # TypeScript types
│   └── webhook.ts      # Webhook handler
├── index.ts            # Plugin entry point
├── openclaw.plugin.json  # Plugin metadata
├── package.json
└── tsconfig.json
```

## API Reference

### MAX API Client

```typescript
import { MaxApiClient } from './api.js';

const client = new MaxApiClient({
  token: 'your-bot-token',
  baseUrl: 'https://platform-api.max.ru'
});

// Send text message
await client.sendMessage({
  user_id: 123456,
  text: 'Hello from OpenClaw!'
});

// Send file
await client.sendFile({
  user_id: 123456,
  file: '/path/to/file.pdf',
  filename: 'document.pdf'
});

// Get updates (Long Polling)
const { updates, marker } = await client.getUpdates({
  limit: 100,
  timeout: 30,
  marker: lastMarker
});
```

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -am 'Add my feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Submit a Pull Request

### Code Style

- Follow existing code conventions
- Add TypeScript types for new code
- Include JSDoc comments for public APIs
- Write tests for new features

## Resources

- [MAX API Documentation](https://dev.max.ru)
- [OpenClaw Documentation](https://docs.openclaw.ai)
- [OpenClaw GitHub](https://github.com/openclaw/openclaw)
- [GitHub Repository](https://github.com/biguxuzz/openclaw-max-plugin)
- [Community Discord](https://discord.com/invite/clawd)

## Support

- **GitHub Issues**: [biguxuzz/openclaw-max-plugin/issues](https://github.com/biguxuzz/openclaw-max-plugin/issues)
- **Discord**: [OpenClaw Community](https://discord.com/invite/clawd)

## License

MIT License - See [LICENSE](LICENSE) for details.

## Credits

- **Author**: biguxuzz (Pavel)
- **Built for**: OpenClaw Gateway
- **Thanks to**: MAX Messenger API Team

---

**Made with ❤️ for OpenClaw**
