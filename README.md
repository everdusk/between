# Between

**Репозиторий:** [github.com/everdusk/between](https://github.com/everdusk/between)

Telegram Mini App — личный дневник для подготовки к еженедельной психотерапии.  
Интерфейс на русском; бренд — **Between**. Данные в `localStorage` на устройстве (без аккаунта и обязательного бэкенда).

**Бот:** [@BetweenJournalBot](https://t.me/BetweenJournalBot) — создан. Токен в репозиторий не передавался.  
**HTTPS:** [https://between-rouge.vercel.app](https://between-rouge.vercel.app) — задеплоено. Menu Button в BotFather ещё нужно указать вручную.

## Возможности (v1)

- **Дневник** — дата, настроение, текст, теги
- **Неделя** — сводка, повторяющиеся темы, «говорить на сеансе»
- **Сеансы** — итоги встречи и список прошлых записей
- Telegram WebApp SDK: `ready()`, `expand()`, theme/viewport; имя из `initDataUnsafe.user`
- Вне Telegram — браузерный режим; на localhost — **режим разработки**

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
| HTTPS деплой | [between-rouge.vercel.app](https://between-rouge.vercel.app) |
| Menu Button → Web App URL | Ожидает BotFather (`/setmenubutton`) |

В BotFather: `/setmenubutton` → `@BetweenJournalBot` → текст `Открыть Between` → URL `https://between-rouge.vercel.app`.

### Как тестировать в Telegram

1. Убедитесь, что Menu Button указывает на HTTPS URL выше.
2. Откройте [@BetweenJournalBot](https://t.me/BetweenJournalBot) → кнопка меню → Between.

Опциональный шаблон env: `.env.example` (`BOT_TOKEN` — только для будущей серверной проверки).

## Стек

Next.js (App Router), TypeScript, Tailwind, shadcn/ui, `@twa-dev/sdk`.

## Не в v1

Валидация `initData` на сервере, облачная синхронизация, PDF, напоминания, шаринг с терапевтом.
