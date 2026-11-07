# Between — настройка Telegram-бота

**Репозиторий (source of truth):** [github.com/everdusk/between](https://github.com/everdusk/between)  
**Бот:** [@BetweenJournalBot](https://t.me/BetweenJournalBot)  
**Production:** [https://between-rouge.vercel.app/](https://between-rouge.vercel.app/)

Токен бота и ключи Redis **никогда** не коммитим и **не вставляем в чат** — только в Vercel Environment Variables (или `.env.local` у себя).

## Возможности

1. **Mini App** — дневник / неделя / сеансы (кнопка меню).
2. **Чат бота** — любой обычный текст в личке сохраняется **отдельной заметкой** на сегодня. Голосовое и аудио расшифровываются моделью `whisper-1` и сохраняются так же, но только после оплаты «Недели» и не больше 10 в день. Пробная неделя голосовые не открывает. Темы ставятся из текста, тег «бот» не пишется.
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
| `AITUNNEL_API_KEY` | нет | бриф, судья тем, паттерн и расшифровка голосовых (`whisper-1`). Модель текста `~deepseek/deepseek-v4-flash-latest` через `https://api.aitunnel.ru/v1/`. Если ключ задан, Gemini и Groq не вызываются. В allowlist ключа нужен и `whisper-1` |
| `GEMINI_API_KEY` или `GROQ_API_KEY` | нет | запасной путь, только когда `AITUNNEL_API_KEY` пуст. Без любого ключа бриф собирается правилами |
| `WEEK_STAR_PRICE` | нет | цена 30 дней «Недели» в Stars. Целое 1–10000, иначе 150. 3 месяца — эта цена × 3 со скидкой 20%, год — × 12 со скидкой 50% |
| `WEEK_RUB_PRICE` | нет | та же цена в браузере, в рублях. Целое 1–10000, иначе 150. Скидки те же. В тексте «Недели» Stars не называются |
| `REVIEW_EMAIL` | нет | почта, которая входит на обычный `/journal` через «Войти по паролю» |
| `REVIEW_PASSWORD` | нет | пароль этой почты, не короче 8 символов. Это вход на сайт, не кабинет оплаты |
| `WEEK_EXEMPT_USER_IDS` | нет | дополнительные Telegram id через запятую с премиумом без срока. Сроки по username задаются в `PREMIUM_WHITELIST` |

Создать Redis: [Upstash](https://upstash.com/) → Redis → REST API → скопировать URL и token в Vercel → Redeploy.

## Webhook

После деплоя и env выставьте webhook (подставьте свой `BOT_TOKEN` **локально в терминале**, не в чат):

```bash
# Без secret
curl -sS "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -d "url=https://between-rouge.vercel.app/api/telegram/webhook" \
  -d "allowed_updates=[\"message\",\"callback_query\",\"pre_checkout_query\"]"

# С secret (тот же TELEGRAM_WEBHOOK_SECRET, что в Vercel)
curl -sS "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -d "url=https://between-rouge.vercel.app/api/telegram/webhook" \
  -d "secret_token=${TELEGRAM_WEBHOOK_SECRET}" \
  -d "allowed_updates=[\"message\",\"callback_query\",\"pre_checkout_query\"]"
```

Проверка:

```bash
curl -sS "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"
curl -sS "https://between-rouge.vercel.app/api/telegram/webhook"
```

Снять webhook: `.../deleteWebhook`.

После выкладки оплаты вкладки «Неделя» webhook нужно выставить заново. В `allowed_updates` обязательны `message`, `callback_query` и `pre_checkout_query`. Без `pre_checkout_query` Telegram оборвёт оплату по таймауту, и Stars не спишутся. Доступ пишется только из `successful_payment`.

## Оплата вкладки «Неделя»

Первое открытие «Недели» запускает 7 дней бесплатно — и для новых людей, и для тех, кто уже пользовался дневником. Дальше спектр и бриф закрываются. Дневник и «Сеансы» остаются бесплатными.

Оплата в Stars, базовая цена месяца — `WEEK_STAR_PRICE` (по умолчанию 150):

- 30 дней — подписка, продлевается сама, полная цена
- 90 дней — разовый счёт, скидка 20% (при 150 это 360)
- 365 дней — разовый счёт, скидка 50% (при 150 это 900)

Отмена подписки на 30 дней — в Telegram; доступ держится до конца оплаченного периода. Более длинные счета срок не продлевают сами: новый срок начинается от оплаты и не укорачивает уже оплаченный.

Пока премиум включён, рядом с названием Between стоит ⭐. В боте команда `/premium` пишет, сколько дней осталось. Пробные 7 дней премиумом не считаются.

`/paysupport` отвечает, как устроена оплата Stars и куда писать, если доступ не открылся или нужен возврат. Команда нужна модерации Telegram для приёма Stars. Бот сам ставит её в меню вместе с `/start` и `/premium` при первом апдейте после деплоя.

`/stats` отвечает только логинам из `ANALYTICS_OWNERS` (по умолчанию `aliatorovskaia`) и в меню команд не входит. Один и тот же текст приходит и в Telegram, и в MAX. Внутри два блока, Telegram и MAX: визит, заметка, неделя, пейволл, счёт, оплата за 7 дней по Москве, и возврат на следующий день и на 7-й. Старые счётчики до разделения входят в блок Telegram. Id мессенджера в ключи не пишется. Один человек за день даёт один шаг в своём мессенджере, второй мессенджер считается отдельно. Оплата считается на сервере по подтверждённому счёту Stars, повтор того же платежа не прибавляется. Тот же отчёт отдаёт `GET /api/analytics` с `Authorization: Bearer <CRON_SECRET>`.

Те же шаги уходят в PostHog (регион US, `https://us.i.posthog.com`), если в `POSTHOG_KEY` лежит публичный токен проекта (`phc_…`). Для проекта в EU задайте `POSTHOG_HOST=https://eu.i.posthog.com`. Сервер читает переменную и отдаёт её в браузер. Личный ключ (`phx_…`) не проходит и в клиент не попадает. Пока переменная пустая, SDK не грузится. `identify` не вызывается. Автосъём кликов, просмотры страниц, запись сессии, опросы и флаги выключены. События называются `telegram_visit`, `telegram_note`, `max_visit`, `max_note` и так же для недели, пейволла, счёта и оплаты. Свои поля — `messenger` (`telegram` или `max`) и тариф `month`, `quarter` или `year`. Старые события без приставки остаются в истории PostHog. Случайный ключ устройства лежит в localStorage, чтобы в PostHog считался возврат на 1-й и 7-й день; это не Telegram id и не имя. Хеш запуска Mini App (там initData) с адреса срезается до отправки. IP соединение PostHog всё равно видит, пока в проекте не включено Discard client IP data; запись сессий там тоже лучше выключить. `/stats` от этого не зависит: оплата там — подтверждённый счёт Stars, а в PostHog — закрытый счёт со статусом paid. После добавления ключа в Vercel нужен новый деплой, иначе клиент его не увидит.

Вайтлист в `PREMIUM_WHITELIST`: срок `month`, `quarter`, `year` или `forever`. Конечный срок начинается в первый заход, а не от старого открытия «Недели». `@aliatorovskaia` — `forever`. Дополнительные числовые id без срока — `WEEK_EXEMPT_USER_IDS`. Логин сверяется в Mini App и в боте.

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

Прямая ссылка Mini App (`t.me/BetweenJournalBot?startapp` и ссылка из каталога) открывает приложение на весь экран и не создаёт чат. Пока человек не разрешил боту писать, опросы и заметки из чата не доходят. При таком входе сразу поверх приложения окно: Between живёт и в чате, заметку можно отправить боту, не открывая приложение, а вопросы «как вы» выключаются на вкладке «Сеансы». Кнопка «Разрешить сообщения» вызывает системное разрешение Telegram. Если человек отказывается, окно закрывается, а та же плашка остаётся под напоминаниями на вкладке «Сеансы». После согласия сервер один раз шлёт то же приветствие, что и `/start`, и диалог появляется в списке чатов. Если разрешение уже есть, ни окна, ни плашки нет. Ссылки, которые рассылаем сами, лучше вести в чат: `https://t.me/BetweenJournalBot?start=open`.

## Дневник в браузере

`https://between-rouge.vercel.app/journal` — тот же дневник без Telegram. Регистрация — почта и пароль, затем код из письма: он стоит отдельной строкой в начале письма и в теме, его можно выделить и скопировать. Вход — почта и пароль, или VK, Яндекс и Сбер. Если пароль забыт, письмо содержит только ссылку на `/reset`: человек сам задаёт новый пароль. Пароль в письме не отправляется. Письма уходят через SMTP: `SMTP_HOST`, `SMTP_PORT` 465, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`. Заметки на сервере. В карточке аккаунта кнопка «Telegram бот» открывает `https://t.me/BetweenJournalBot?start=link_…`. С российского адреса перед ссылкой показывается, что без VPN Telegram не откроется. Код связки живёт 15 минут. После Start этот чат и браузер пишут в один дневник, и премиум тоже один: купленный в Telegram открывается в браузере, купленный в браузере — в Telegram. Если срок был и там и там, дни складываются. Повторная связка те же дни не прибавляет. Мини-приложение без связки по-прежнему хранит дневник на числовом id Telegram. В браузере «Неделя» говорит цену в рублях и сколько бесплатных дней осталось. Проверочный вход `REVIEW_EMAIL` и `REVIEW_PASSWORD` использует ту же форму входа. `/terms` и `/privacy` называют самозанятую, которая ведёт сервис, и её ИНН.

В той же карточке кнопка «Бот в MAX» открывает `https://max.ru/<ник>?start=link_…`. Ник берётся из `MAX_BOT_USERNAME`. Код тот же, 15 минут, и после «Начать» чат MAX и браузер пишут в один дневник. Премиум тоже один. Заметки из MAX лежат на ключе `max:<id>`, пока связки нет, и не пересекаются с числовым id Telegram.

Для кнопок входа в кабинете провайдера регистрируется ровно этот callback: `https://between-rouge.vercel.app/api/account/oauth/vk/callback`, и то же для `yandex` и `sber`. Ключи — `VK_CLIENT_ID`, `VK_SERVICE_TOKEN`, `YANDEX_CLIENT_ID`, `YANDEX_CLIENT_SECRET`, `SBER_CLIENT_ID`, `SBER_CLIENT_SECRET`. Сбер ещё ждёт сертификат партнёра в `SBER_CLIENT_CERT` и `SBER_CLIENT_KEY`. Пока ключа нет, кнопка возвращает на дневник с «этот вход ещё не подключён».

## Как пользоваться

1. Напишите боту `/start` — краткая подсказка + кнопка «Открыть Between». `/premium` — сколько дней премиума осталось. `/paysupport` — вопрос по оплате Stars.
2. Пишите любой текст в чат — бот сохранит его отдельной заметкой.
3. Откройте Mini App — заметка будет в дневнике за сегодня. Настроение отмечается кнопками в опросе или в приложении.
4. Часовой пояс: при открытии Mini App сохраняется timezone устройства. До первого открытия напоминания и «сегодня» считаются по `Europe/Moscow`.

## MAX

Тот же дневник во втором мессенджере. Токен в чат и в git не кладётся.

В Vercel → Settings → Environment Variables, окружение Production:

| Переменная | Назначение |
| --- | --- |
| `MAX_BOT_TOKEN` | токен из настроек бота MAX |
| `MAX_BOT_USERNAME` | публичный ник без `@`, у самозанятого он вида `se123_bot` |
| `MAX_WEBHOOK_SECRET` | необязательно. 5–256 символов: латиница, цифры, `_` и `-`. Уходит заголовком `X-Max-Bot-Api-Secret` |

После сохранения переменных — Redeploy. Подписка на события ставится сама, когда кто-то открывает `https://www.between-journal.ru/api/max/webhook` или срабатывает почасовой опрос. Отдельный `curl` не нужен. События: `message_created`, `message_callback`, `bot_started`.

В MAX нет Stars. Текст в личке становится заметкой, утром, днём и вечером бот спрашивает настроение теми же кнопками, в 21:00 напоминает про заметку. Голосовое с ссылкой на файл разбирается так же, только после оплаченной «Недели». Оплата «Недели» остаётся на сайте. `/paysupport` в MAX про сайт, не про Stars.

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
