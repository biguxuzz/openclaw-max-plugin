# MAX Messenger Channel Plugin - Installation Guide

## 🎉 Плагин готов!

Плагин MAX Messenger для OpenClaw Gateway успешно создан и скомпилирован.

---

## 📦 Структура плагина

```
~/.openclaw/extensions/max-messenger/
├── dist/                  # Скомпилированный код
│   ├── index.js
│   └── src/
│       ├── api.js
│       ├── runtime.js
│       ├── channel.js
│       └── types.js
├── src/                   # Исходный код (TypeScript)
│   ├── api.ts
│   ├── runtime.ts
│   ├── channel.ts
│   ├── types.ts
│   └── plugin-sdk.ts
├── package.json
├── tsconfig.json
└── README.md
```

---

## ⚙️ Интеграция в OpenClaw Gateway

### Способ 1: Автоматический (рекомендуется)

OpenClaw автоматически загружает плагины из `~/.openclaw/extensions/`.

**Шаги:**

1. **Проверить, что плагин на месте:**
   ```bash
   ls -la ~/.openclaw/extensions/max-messenger/dist/index.js
   ```

2. **Добавить конфигурацию в openclaw.json:**
   ```bash
   nano ~/.openclaw/openclaw.json
   ```

   Добавить:
   ```json
   {
     "channels": {
       "max": {
         "accounts": {
           "default": {
             "token": "f9LHodD0cOLnZZYiLeRbbEAcbVUr-y24xjoFi0_1Um3ZzOreaz7wLt5YUXloTlVitAeilAYuBzbw2G8DHBdC",
             "enabled": true,
             "dmPolicy": "pairing"
           }
         }
       }
     }
   }
   ```

3. **Перезапустить Gateway:**
   ```bash
   openclaw gateway restart
   ```

4. **Проверить статус:**
   ```bash
   openclaw status
   ```

---

### Способ 2: Ручная регистрация

Если автоматический способ не работает:

1. **Найти файл регистрации плагинов:**
   ```bash
   find ~/.nvm/versions/node/v24.14.0/lib/node_modules/openclaw -name "*plugin*registry*" -o -name "*extensions*"
   ```

2. **Добавить плагин вручную**

---

## 🧪 Тестирование

### 1. Проверить загрузку плагина

```bash
openclaw channels list
```

Должен показать:
```
- telegram
- max-messenger  # <-- Новый канал
```

### 2. Настроить pairing

```bash
openclaw channels max setup --token YOUR_TOKEN
```

### 3. Добавить разрешенный user_id

```bash
openclaw channels max allow 3411927
```

### 4. Отправить сообщение в MAX

```bash
openclaw send max:3411927 "Привет из OpenClaw!"
```

### 5. Проверить входящие сообщения

Отправь сообщение боту в MAX, и OpenClaw должен его обработать.

---

## 📋 Troubleshooting

### Плагин не загружается

**Проверить:**
```bash
# Плагин скомпилирован?
ls -la ~/.openclaw/extensions/max-messenger/dist/index.js

# Конфигурация правильная?
cat ~/.openclaw/openclaw.json | grep -A 10 "max"

# Gateway запущен?
openclaw gateway status
```

### Сообщения не отправляются

**Проверить:**
- Token правильный?
- User в allowlist?
- dmPolicy позволяет?

**Логи:**
```bash
tail -f ~/.openclaw/logs/gateway.log | grep MAX
```

---

## 📚 Документация

**MAX API:** https://dev.max.ru/docs-api

**OpenClaw Docs:** https://docs.openclaw.ai

**Plugin Source:** `~/.openclaw/extensions/max-messenger/src/`

---

## 🎯 Возможности плагина

✅ **Поддерживается:**
- Direct messages
- Long Polling
- Message sending
- Pairing/Allowlist
- Media support

❌ **Не поддерживается (MAX API limitation):**
- Reactions
- Threads
- Polls

---

## 🔄 Обновление плагина

```bash
cd ~/.openclaw/extensions/max-messenger
npm run build
openclaw gateway restart
```

---

*Создано: 2026-03-11*
*Версия: 1.0.0*
