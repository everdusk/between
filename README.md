# Between

**Репозиторий:** [github.com/everdusk/between](https://github.com/everdusk/between)

Telegram Mini App — личный дневник для подготовки к еженедельной психотерапии.  
Интерфейс на русском; бренд — **Between**. Данные в `localStorage` на устройстве (без аккаунта и обязательного бэкенда).

**Бот:** [@BetweenJournalBot](https://t.me/BetweenJournalBot) — создан. Menu Button URL ещё не задан (нужен HTTPS). Токен в репозиторий не передавался.

## Возможности (v1)

- **Дневник** — дата, настроение, текст, теги
- **Неделя** — сводка, повторяющиеся темы, «говорить на сеансе»
- **Сеансы** — итоги встречи и список прошлых записей
- Telegram WebApp SDK: `ready()`, `expand()`, theme/viewport; имя из `initDataUnsafe.user`
- Вне Telegram — **режим разработки** (localhost), чтобы можно было тестировать без бота

## Локальный запуск

```bash
npm install
npm run dev
```

Откройте [http://127.0.0.1:43123](http://127.0.0.1:43123). В шапке будет «Гость · режим разработки».

## Telegram

Подробности: [`docs/telegram-setup.md`](./docs/telegram-setup.md).

| Шаг | Статус |
| --- | --- |
| Бот `@BetweenJournalBot` | Готово |
| Bot token в проекте | Нет (не нужен для client-only v1) |
| Menu Button → Web App URL | Ожидает HTTPS (деплой или туннель) |

Когда будет HTTPS URL: BotFather → `/setmenubutton` → `@BetweenJournalBot` → `Открыть Between` → URL.

### Как тестировать в Telegram

1. Задеплойте приложение по HTTPS **или** поднимите туннель к localhost (`ngrok http 43123` / `cloudflared tunnel`).
2. Укажите этот URL в Menu Button бота.
3. Откройте [@BetweenJournalBot](https://t.me/BetweenJournalBot) → кнопка меню → Between.

Опциональный шаблон env: `.env.example` (`BOT_TOKEN` — только для будущей серверной проверки).

## Стек

Next.js (App Router), TypeScript, Tailwind, shadcn/ui, `@twa-dev/sdk`.

## Не в v1

Валидация `initData` на сервере, облачная синхронизация, PDF, напоминания, шаринг с терапевтом.
