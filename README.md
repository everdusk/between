# Between

**Репозиторий:** [github.com/everdusk/between](https://github.com/everdusk/between)  
**Production:** [https://between-rouge.vercel.app/](https://between-rouge.vercel.app/)

Telegram Mini App — личный дневник для подготовки к еженедельной психотерапии.  
Интерфейс на русском; бренд — **Between**.

**Бот:** [@BetweenJournalBot](https://t.me/BetweenJournalBot)

## Возможности

- **Дневник** — несколько заметок в день, самочувствие словами, темы из текста
- **Неделя** — сводка с последнего сеанса, тренды, бриф к сеансу
- **Сеансы** — ближайшая дата или еженедельное расписание, итоги встречи
- **Бот** — каждая реплика отдельной заметкой; опросы в 9:00, 14:00 и 18:00; вопрос в 21:00, если за день не было текста
- **Сайт** — в обычном браузере те же записи можно перечитать. Новая мысль по-прежнему пишется боту. Оплата Stars на сайт не распространяется
- Mini App sync по Telegram `initData`. Сайт читает тот же дневник после входа через Telegram

## Локальный запуск

```bash
npm install
cp .env.example .env.local   # опционально, для webhook/sync
npm run dev
```

Откройте [http://127.0.0.1:43123](http://127.0.0.1:43123) в браузере — это сайт: кнопка «Написать боту» и чтение записей. Mini App с дневником, неделей и сеансами открывается внутри Telegram.

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

## Не в этой версии

PDF, шаринг с терапевтом, отдельный аккаунт вне Telegram.
