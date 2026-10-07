# Between — настройка Telegram-бота (с нуля)

Клиент v1 — **Telegram Mini App** без обязательного сервера. Токен бота в репозиторий не коммитим.

## Чеклист BotFather

1. Откройте [@BotFather](https://t.me/BotFather) → `/newbot`.
2. Display name: **Between**. Username: например `BetweenJournalBot` / `between_app_bot` (должен заканчиваться на `bot`, быть свободным).
3. BotFather пришлёт **bot token** — сохраните у себя (менеджер паролей). **Не присылайте токен в чат**, пока не решите хранить его в env для будущей проверки `initData`.
4. Настройте кнопку меню Web App:
   - `/setmenubutton` → выберите бота → **Configure menu button** → текст, например `Открыть Between` → URL Web App.
   - Пока нет HTTPS-деплоя, поставьте placeholder (например `https://example.com`) и замените после публикации / туннеля.
   - Альтернатива: Bot Settings → Menu Button в интерфейсе BotFather.
5. (Опционально) `/setdescription` и `/setabouttext` — коротко на русском: дневник к сеансу психотерапии.

## Что прислать обратно в этот проект

- **Username бота** (например `@BetweenJournalBot`).
- Хотите ли вы, чтобы мы позже положили токен в env окружения агента **только для серверной валидации `initData`** (сейчас не требуется) — да / нет.

Токен в чат не нужен для клиентского v1.

## Публичный URL

Telegram открывает Mini App только по **HTTPS**. Для теста с телефона:

- задеплойте Next.js (Vercel и т.п.), или
- поднимите туннель к локальному `npm run dev` (ngrok / cloudflared) и укажите этот HTTPS URL в Menu Button.

## Локальная разработка без Telegram

```bash
npm install
npm run dev
```

Откройте [http://127.0.0.1:43123](http://127.0.0.1:43123) — приложение работает в **режиме разработки** (имя «Гость»), `localStorage` как обычно.
