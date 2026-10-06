# Запуск на Railway

Репозиторий уже готов к Railway: `railway.json` задаёт команду запуска `npm start`, проверку здоровья `/healthz` и перезапуск при падении. Node берётся из `engines` в `package.json` (22 и новее).

## Шаги

1. **Новый проект.** railway.com → New Project → Deploy from GitHub repo → выбрать репозиторий с игрой.
2. **Постоянный диск.** В сервисе: правый клик → Attach Volume, путь монтирования `/data`. Без него при каждом перезапуске пропадают таблица сезона, архив дел, профили и ключ подписи входа.
3. **Переменные** (вкладка Variables):

   | Переменная | Значение |
   |---|---|
   | `NODE_ENV` | `production` |
   | `DATA_DIR` | `/data` |
   | `ADMIN_KEY` | длинный случайный пароль, от 16 знаков |
   | `PUBLIC_URL` | адрес сайта с https, например `https://detective-game.up.railway.app` |
   | `TRUST_PROXY_HOPS` | `1` |

   Почта (`support@detective-game.org`) и Discord (`https://discord.gg/hfWsKkGVH`) стоят по умолчанию, задавать их не нужно. Вход через Discord и Google включается позже переменными `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
4. **Адрес.** Settings → Networking → Generate Domain, затем карандаш рядом с адресом: `detective-game.up.railway.app`.

   После смены адреса поправьте `PUBLIC_URL`. Когда появится свой домен, добавьте его там же (Custom Domain) и снова поправьте `PUBLIC_URL`: старый адрес `*.up.railway.app` сам начнёт переводить на него (301).
5. **Проверка.** Откройте `/healthz` (должно быть `{"ok":true,...}`), затем главную, затем `/#/admin` со своим `ADMIN_KEY` и тестовую комнату с ботами.

## Важно

- **Ровно один экземпляр.** Партии живут в памяти процесса, поэтому в Settings → Replicas должна стоять 1.
- **Перезапуск обрывает идущие партии.** Каждый пуш в main пересобирает сервис. Выкатывайте обновления, когда никто не играет, или выключите автодеплой (Settings → Source) и запускайте вручную.
- В боевом режиме сервер не стартует без `ADMIN_KEY` от 16 знаков и без https в `PUBLIC_URL`: смотрите логи деплоя, если сервис не поднимается.
- Вход через Google: в Google Cloud Console укажите адрес главной и `PUBLIC_URL/privacy` как политику конфиденциальности, а `PUBLIC_URL/auth/google/callback` как адрес возврата. Для Discord адрес возврата `PUBLIC_URL/auth/discord/callback`.
