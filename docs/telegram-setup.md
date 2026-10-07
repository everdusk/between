# Between — настройка Telegram-бота

Клиент v1 — **Telegram Mini App** без обязательного сервера. Токен бота в репозиторий не коммитим.

**Репозиторий (source of truth):** [github.com/everdusk/between](https://github.com/everdusk/between)  
**Бот:** [@BetweenJournalBot](https://t.me/BetweenJournalBot) (создан). Токен не передан в проект.

## Чеклист BotFather

1. ~~`/newbot`~~ — готово (`@BetweenJournalBot`).
2. Токен — у пользователя локально; в чат не нужен для клиентского v1.
3. Menu Button → Web App URL — **ждёт HTTPS** (деплой или туннель):
   - `/setmenubutton` → `@BetweenJournalBot` → текст `Открыть Between` → HTTPS URL приложения.
4. (Опционально) `/setdescription` и `/setabouttext` — дневник к сеансу психотерапии.

## Дальше

- Подключите [everdusk/between](https://github.com/everdusk/between) к Vercel → получите HTTPS URL → укажите в Menu Button.
- Серверная валидация `initData` (токен в env) — позже, по желанию.

## Публичный URL

Telegram открывает Mini App только по **HTTPS**. Для теста с телефона:

- задеплойте Next.js на Vercel из GitHub-репо [everdusk/between](https://github.com/everdusk/between), или
- поднимите туннель к локальному `npm run dev` (ngrok / cloudflared) и укажите этот HTTPS URL в Menu Button.

## Локальная разработка без Telegram

```bash
npm install
npm run dev
```

Откройте [http://127.0.0.1:43123](http://127.0.0.1:43123) — приложение работает в **режиме разработки** (имя «Гость»), `localStorage` как обычно.
