# Between — настройка Telegram-бота

**Репозиторий (source of truth):** [github.com/everdusk/between](https://github.com/everdusk/between)  
**Бот:** [@BetweenJournalBot](https://t.me/BetweenJournalBot)  
**Production:** [https://between-rouge.vercel.app/](https://between-rouge.vercel.app/)

Токен бота и ключи Redis **никогда** не коммитим и **не вставляем в чат** — только в Vercel Environment Variables (или `.env.local` у себя).

## Возможности

1. **Mini App** — дневник / неделя / сеансы (кнопка меню).
2. **Чат бота** — любой обычный текст в личке сохраняется **отдельной заметкой** на сегодня. Темы ставятся из текста, тег «бот» не пишется.
3. **Опросы** — в 9:00, 14:00 и 18:00 бот присылает кнопки самочувствия. В 21:00 спрашивает, есть ли заметка, если текста за день не было. Выключатели — в Mini App, вкладка «Сеансы».

## Env в Vercel

| Переменная | Обязательно | Назначение |
| --- | --- | --- |
| `BOT_TOKEN` | да (для чата + sync) | токен от BotFather |
| `UPSTASH_REDIS_REST_URL` | да (для чата + sync) | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | да | Upstash Redis REST token |
| `TELEGRAM_WEBHOOK_SECRET` | рекомендуется | секрет webhook (см. ниже) |
| `NEXT_PUBLIC_APP_URL` | опционально | `https://between-rouge.vercel.app` (кнопка Mini App в ответах) |
| `CRON_SECRET` | да, для опросов | секрет почасового вызова `/api/telegram/digest` |
| `GEMINI_API_KEY` или `GROQ_API_KEY` | нет | кнопка «Сформулировать текст». Без ключа бриф собирается правилами |

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
  -d "allowed_updates=[\"message\",\"callback_query\"]"
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
2. Пишите любой текст в чат — бот сохранит его отдельной заметкой.
3. Откройте Mini App — заметка будет в дневнике за сегодня. Настроение отмечается кнопками в опросе или в приложении.
4. Часовой пояс: при открытии Mini App сохраняется timezone устройства. До первого открытия напоминания и «сегодня» считаются по `Europe/Moscow`.

## Напоминания

На бесплатном тарифе Vercel почасовой cron при деплое отклоняется, поэтому расписание живёт в Upstash QStash (бесплатный уровень, тот же аккаунт, что и Redis).

1. В Vercel задайте длинный `CRON_SECRET`.
2. В [Upstash QStash](https://console.upstash.com/qstash) создайте schedule:
   - Destination: `https://between-rouge.vercel.app/api/telegram/digest`
   - Cron: `0 * * * *` (каждый час, UTC)
   - Forward header: `Authorization` = `Bearer <CRON_SECRET>`
3. Проверка вручную:

```bash
curl -sS "https://between-rouge.vercel.app/api/telegram/digest" \
  -H "Authorization: Bearer ${CRON_SECRET}"
```

Бот пишет пользователю только в местный час 9, 14, 18 или 21. В остальные часы вызов ничего не отправляет. Пользователь попадает в список после сообщения боту или открытия Mini App.

## Локальная разработка

```bash
npm install
cp .env.example .env.local   # заполните ключи локально
npm run dev
```

[http://127.0.0.1:43123](http://127.0.0.1:43123) — без Telegram работает на `localStorage`.  
Для теста webhook с телефона нужен HTTPS-туннель к `/api/telegram/webhook` и `setWebhook` на этот URL.
