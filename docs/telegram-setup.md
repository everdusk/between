# Between — настройка Telegram-бота

Клиент v1 — **Telegram Mini App** без обязательного сервера. Токен бота в репозиторий не коммитим.

**Репозиторий (source of truth):** [github.com/everdusk/between](https://github.com/everdusk/between)  
**Бот:** [@BetweenJournalBot](https://t.me/BetweenJournalBot) (создан). Токен не передан в проект.  
**Публичный HTTPS:** [https://between-rouge.vercel.app](https://between-rouge.vercel.app)

## Чеклист BotFather

1. ~~`/newbot`~~ — готово (`@BetweenJournalBot`).
2. Токен — у пользователя локально; в чат не нужен для клиентского v1.
3. Menu Button → Web App URL — **осталось сделать вручную**:
   - `/setmenubutton` → `@BetweenJournalBot` → текст `Открыть Between` → `https://between-rouge.vercel.app`
4. (Опционально) `/setdescription` и `/setabouttext` — дневник к сеансу психотерапии.

## Дальше

- ~~Подключите к Vercel~~ — HTTPS уже есть: [between-rouge.vercel.app](https://between-rouge.vercel.app).
- Укажите этот URL в Menu Button (шаг 3 выше).
- Серверная валидация `initData` (токен в env) — позже, по желанию.

## Публичный URL

Telegram открывает Mini App только по **HTTPS**. Production:

- [https://between-rouge.vercel.app](https://between-rouge.vercel.app) (GitHub homepage / Vercel Production)

Для локального теста с телефона без деплоя: туннель к `npm run dev` (ngrok / cloudflared) и временный HTTPS URL в Menu Button.

## Локальная разработка без Telegram

```bash
npm install
npm run dev
```

Откройте [http://127.0.0.1:43123](http://127.0.0.1:43123) — приложение работает в **режиме разработки** (имя «Гость»), `localStorage` как обычно. На production HTTPS вне Telegram бейдж `localhost` не показывается.
