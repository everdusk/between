# Between

Telegram Mini App — личный дневник для подготовки к еженедельной психотерапии.  
Интерфейс на русском; бренд — **Between**. Данные в `localStorage` на устройстве (без аккаунта и обязательного бэкенда).

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

## Telegram: бот с нуля (BotFather)

Подробный чеклист: [`docs/telegram-setup.md`](./docs/telegram-setup.md) в контексте проекта (или краткая копия ниже).

1. [@BotFather](https://t.me/BotFather) → `/newbot` → имя **Between**, username вида `BetweenJournalBot`.
2. Сохраните **bot token** у себя. **Не коммитьте** и не обязательно присылать в чат для v1.
3. `/setmenubutton` → Web App URL (нужен **HTTPS**; до деплоя — placeholder, затем замените).
4. Пришлите в проект: **username бота** и нужно ли позже хранить токен в env для валидации `initData` (да/нет).

Опциональный шаблон env: `.env.example` (`BOT_TOKEN` — только для будущей серверной проверки, клиент v1 работает без него).

### Как тестировать в Telegram

1. Задеплойте приложение по HTTPS **или** поднимите туннель к localhost (`ngrok http 43123` / `cloudflared tunnel`).
2. Укажите этот URL в Menu Button бота.
3. Откройте бота в Telegram Desktop или на телефоне → кнопка меню → Between.

## Стек

Next.js (App Router), TypeScript, Tailwind, shadcn/ui, `@twa-dev/sdk`.

## Не в v1

Валидация `initData` на сервере, облачная синхронизация, PDF, напоминания, шаринг с терапевтом.
