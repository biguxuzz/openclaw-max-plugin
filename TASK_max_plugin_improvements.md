# Задание: Улучшение плагина MAX Messenger по результатам сравнения с конкурентом

## Контекст

Проведено сравнение нашего плагина `@biguxuzz/max` с `@olegbalbekov/openclaw-max` (https://github.com/olegbalbekov/openclaw-max).

**Наш плагин:** https://github.com/biguxuzz/openclaw-max-plugin

## Что нужно улучшить (приоритет по убыванию)

### 1. Webhook с валидацией секрета (HIGH)

Сейчас webhook-хендлер без проверки подлинности. Нужно добавить:
- Подпись `X-Max-Bot-Api-Secret` из заголовков запроса
- Сравнение с `webhookSecret` из конфига
- `webhookSecret` и `webhookPath` — опциональные поля конфига

Конфиг:
```json
{
  "channels": {
    "max": {
      "token": "...",
      "webhookUrl": "https://domain.com/max/webhook",
      "webhookSecret": "random_secret_string",
      "webhookPath": "/max/webhook"
    }
  }
}
```

Ссылка на реализацию конкурента: `src/webhook-handler.ts` строки 85-93

### 2. Поддержка `openclaw plugins install` (HIGH)

Сейчас установка только manual. Нужно чтобы работало:
```bash
openclaw plugins install @biguxuzz/max
```

Возможно проблема в структуре package.json или openclaw.plugin.json. Изучить как конкурент решил это.

### 3. Плоский конфиг (MEDIUM)

У нас:
```json
"accounts": { "default": { "token": "..." } }
```

У конкурента:
```json
"token": "..."
```

Нужно поддержать ОБА формата для совместимости. Если `token` указан прямо в channel — использовать его. Если `accounts` — текущая логика.

### 4. Добавить политики DM (MEDIUM)

Добавить:
- `allowlist` — только пользователи из allowFrom (alias для текущего `closed` с allowFrom)
- `disabled` — полностью отключить приём сообщений

Текущие: `open`, `pairing`, `closed`
Целевые: `open`, `pairing`, `closed`, `allowlist`, `disabled`

### 5. Переменная окружения MAX_BOT_TOKEN (LOW)

Поддержать `MAX_BOT_TOKEN` как fallback если token не указан в конфиге:
```bash
MAX_BOT_TOKEN=your_token openclaw gateway start
```

### 6. Улучшение README (LOW)

- Добавить секцию "Как создать бота MAX" (business.max.ru → модерация → токен)
- Добавить пример с webhookUrl
- Добавить пример с env var
- Добавить ссылку на openclaw plugins install

## Репозиторий конкурента для референса

```bash
git clone https://github.com/olegbalbekov/openclaw-max.git
```

Ключевые файлы:
- `src/webhook-handler.ts` — webhook с секретом
- `src/channel.ts` — плоский конфиг, outbound
- `src/accounts.ts` — resolve аккаунтов
- `README.md` — документация setup guide

## Наши преимущества (НЕ ТРОГАТЬ)

- ✅ Обработка файлов (приём docx, pdf, images)
- ✅ Typing индикатор с автообновлением каждые 5с
- ✅ sendMedia в outbound

## После выполнения

1. Обновить version в package.json (patch или minor)
2. `npm publish --access public`
3. Запушить в GitHub

## Версия OpenClaw

2026.3.8 (3caab92)
