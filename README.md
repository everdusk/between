# Between

**Репозиторий:** [github.com/everdusk/between](https://github.com/everdusk/between)  
**Production:** [https://between-rouge.vercel.app/](https://between-rouge.vercel.app/)

Telegram Mini App — личный дневник для подготовки к еженедельной психотерапии.  
Интерфейс на русском; бренд — **Between**.

**Бот:** [@BetweenJournalBot](https://t.me/BetweenJournalBot)

## Возможности (v1)

- **Дневник** — дата, настроение, текст, теги
- **Неделя** — сводка, повторяющиеся темы, «говорить на сеансе»
- **Сеансы** — итоги встречи и список прошлых записей
- **Чат бота** — любой текст в личке с ботом дописывается в сегодняшний день (сервер + Redis)
- Mini App sync по Telegram `initData` (вне Telegram — `localStorage`)

## Локальный запуск

```bash
npm install
cp .env.example .env.local   # опционально, для webhook/sync
npm run dev
```

Откройте [http://127.0.0.1:43123](http://127.0.0.1:43123). В шапке будет «Гость · режим разработки».

## Telegram

Подробности: [`docs/telegram-setup.md`](./docs/telegram-setup.md).

| Шаг | Статус |
| --- | --- |
| Бот `@BetweenJournalBot` | Готово |
| Production HTTPS | `https://between-rouge.vercel.app/` |
| Menu Button → Web App | Укажите production URL в BotFather |
| `BOT_TOKEN` + Upstash Redis в Vercel | Нужно для чата → дневник |
| Webhook → `/api/telegram/webhook` | После env (см. docs) |

### Env (Vercel)

- `BOT_TOKEN`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET` (рекомендуется)
- `NEXT_PUBLIC_APP_URL` (опционально)

## Стек

Next.js (App Router), TypeScript, Tailwind, shadcn/ui, `@twa-dev/sdk`, Upstash Redis.

## Не в v1

PDF, напоминания, шаринг с терапевтом, отдельный аккаунт вне Telegram.
