# OpenClaw MAX Messenger Plugin

[![OpenClaw](https://img.shields.io/badge/OpenClaw-Plugin-blue)](https://github.com/openclaw/openclaw)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

MAX Messenger channel plugin for OpenClaw Gateway.

## ⚠️ Status: WORK IN PROGRESS

This plugin is currently under development. **Polling functionality works but messages are not yet being received from MAX API.**

### What Works ✅
- Plugin loads successfully in OpenClaw Gateway
- Polling mechanism connects to MAX API
- API client can send messages
- Query parameters correctly formatted

### What Doesn't Work ❌
- MAX API `/updates` endpoint returns 0 updates (investigating)
- Long polling receives empty arrays despite messages being sent

## Installation

### Prerequisites
- OpenClaw Gateway v2026.3.8+
- Node.js v22+
- MAX Bot Token

### Setup

1. Copy plugin to OpenClaw extensions directory:
```bash
cp -r openclaw-max-plugin ~/.nvm/versions/node/v24.14.0/lib/node_modules/openclaw/extensions/max-messenger
```

2. Add MAX configuration to `~/.openclaw/gateway.json`:
```json
{
  "channels": {
    "max": {
      "enabled": true,
      "accounts": {
        "default": {
          "token": "YOUR_MAX_BOT_TOKEN"
        }
      }
    }
  }
}
```

3. Restart OpenClaw Gateway:
```bash
systemctl --user restart openclaw-gateway.service
```

## Configuration

### Environment Variables
- `MAX_BOT_TOKEN` - Your MAX bot token

### Gateway Config
```json
{
  "channels": {
    "max": {
      "enabled": true,
      "accounts": {
        "default": {
          "token": "string",
          "baseUrl": "https://platform-api.max.ru (optional)"
        }
      }
    }
  }
}
```

## Development

### Build
```bash
npm install
npm run build
```

### Test
```bash
npm test
```

## API Reference

### MAX API Client
```typescript
import { MaxApiClient } from './api.js';

const client = new MaxApiClient({
  token: 'your-bot-token'
});

// Send message
await client.sendMessage({
  user_id: 123456,
  text: 'Hello from OpenClaw!'
});

// Get updates (Long Polling)
const { updates, marker } = await client.getUpdates({
  limit: 100,
  timeout: 30,
  marker: lastMarker
});
```

## Architecture

```
max-messenger/
├── src/
│   ├── api.ts          # MAX API client
│   ├── channel.ts      # Gateway channel integration
│   ├── provider.ts     # Provider monitor
│   ├── runtime.ts      # Long polling runtime
│   ├── types.ts        # TypeScript types
│   └── webhook.ts      # Webhook handler (unused)
├── index.ts            # Plugin entry point
└── openclaw.plugin.json
```

## Comparison with Telegram

| Feature | Telegram | MAX |
|---------|----------|-----|
| Polling | ✅ Grammy bot | ⚠️ Custom implementation |
| Webhooks | ✅ Supported | 🚧 Not tested |
| Message delivery | ✅ Full | ❌ Under investigation |

## Known Issues

### 1. Polling Returns 0 Updates
**Symptom:** MAX API `/updates` always returns `{updates: [], marker: XXXXX}`

**Investigation:**
- Python test script receives messages correctly
- TypeScript plugin does not
- Possible issue with Node.js fetch vs Python requests

**Workaround:** None yet

### 2. Gateway Integration
**Symptom:** Messages received but not delivered to AI assistant

**Status:** Investigating `dispatchInboundMessage` from OpenClaw SDK

## Contributing

Contributions welcome! Please open an issue or PR.

### Development Setup
1. Fork the repository
2. Create feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -am 'Add my feature'`
4. Push to branch: `git push origin feature/my-feature`
5. Submit Pull Request

## Resources

- [MAX API Documentation](https://dev.max.ru)
- [OpenClaw Documentation](https://docs.openclaw.ai)
- [OpenClaw GitHub](https://github.com/openclaw/openclaw)
- [Community Discord](https://discord.com/invite/clawd)

## License

MIT License - See [LICENSE](LICENSE) for details.

## Credits

- OpenClaw Team
- MAX Messenger API Team

## Support

- GitHub Issues: [openclaw-max-plugin/issues](https://github.com/YOUR_USERNAME/openclaw-max-plugin/issues)
- Discord: [OpenClaw Community](https://discord.com/invite/clawd)

---

**Made with ❤️ for OpenClaw**
