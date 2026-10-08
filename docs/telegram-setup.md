# Between — настройка Telegram-бота

**Репозиторий (source of truth):** [github.com/everdusk/between](https://github.com/everdusk/between)  
**Бот:** [@BetweenJournalBot](https://t.me/BetweenJournalBot)  
**Production:** [https://between-rouge.vercel.app/](https://between-rouge.vercel.app/)

Токен бота и ключи Redis **никогда** не коммитим и **не вставляем в чат** — только в Vercel Environment Variables (или `.env.local` у себя).

## Возможности

1. **Mini App** — дневник / неделя / сеансы (кнопка меню).
2. **Чат бота** — любой обычный текст в личке с ботом **дописывается в сегодняшний день**. После этого откройте Mini App — строка будет в дневнике.

## Env в Vercel

| Переменная | Обязательно | Назначение |
| --- | --- | --- |
| `BOT_TOKEN` | да (для чата + sync) | токен от BotFather |
| `UPSTASH_REDIS_REST_URL` | да (для чата + sync) | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | да | Upstash Redis REST token |
| `TELEGRAM_WEBHOOK_SECRET` | рекомендуется | секрет webhook (см. ниже) |
| `NEXT_PUBLIC_APP_URL` | опционально | `https://between-rouge.vercel.app` (кнопка Mini App в ответах) |

Создать Redis: [Upstash](https://upstash.com/) → Redis → REST API → скопировать URL и token в Vercel → Redeploy.

## Webhook

После деплоя и env выставьте webhook (подставьте свой `BOT_TOKEN` **локально в терминале**, не в чат):

```bash
# Без secret
curl -sS "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -d "url=https://between-rouge.vercel.app/api/telegram/webhook"

# С secret (тот же TELEGRAM_WEBHOOK_SECRET, что в Vercel)
curl -sS "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -d "url=https://between-rouge.vercel.app/api/telegram/webhook" \
  -d "secret_token=${TELEGRAM_WEBHOOK_SECRET}" \
  -d "allowed_updates=[\"message\"]"
```

Проверка:

```bash
curl -sS "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"
curl -sS "https://between-rouge.vercel.app/api/telegram/webhook"
```

Снять webhook: `.../deleteWebhook`.

## Чеклист BotFather

1. ~~`/newbot`~~ — `@BetweenJournalBot`.
2. Токен → **только** в Vercel `BOT_TOKEN` (не в чат / не в git).
3. Menu Button → Web App:
   - [@BotFather](https://t.me/BotFather) → `/setmenubutton`
   - `@BetweenJournalBot`
   - Текст: `Открыть Between`
   - URL: `https://between-rouge.vercel.app/`
4. (Опционально) `/setdescription`, `/setabouttext`.
5. Webhook URL как выше.

## Как пользоваться

1. Напишите боту `/start` — краткая подсказка + кнопка «Открыть Between».
2. Пишите любой текст в чат — бот ответит «Записала в сегодняшний день».
3. Откройте Mini App — запись появится в дневнике за сегодня (с меткой времени).
4. Часовой пояс: при открытии Mini App сохраняется timezone устройства; до первого открытия «сегодня» считается в UTC.

## Локальная разработка

```bash
npm install
cp .env.example .env.local   # заполните ключи локально
npm run dev
```

[http://127.0.0.1:43123](http://127.0.0.1:43123) — без Telegram работает на `localStorage`.  
Для теста webhook с телефона нужен HTTPS-туннель к `/api/telegram/webhook` и `setWebhook` на этот URL.
