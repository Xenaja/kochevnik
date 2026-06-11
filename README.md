# Лендинг «Ансамбль Кочевник»

Одностраничный сайт фолк-ансамбля «Кочевник» (традиционная культура Чукотки) —
концерты, корпоративы, фестивали. Есть форма заявки, которая отправляет обращения
в Telegram.

**Боевой адрес:** https://ans-kochevnik.ru

---

## Структура репозитория

| Файл / папка | Назначение |
|---|---|
| `index.html` | Весь сайт (вёрстка, стили, скрипты) — одностраничник |
| `worker.js` | Код Cloudflare Worker, принимает заявку и шлёт её в Telegram |
| `CNAME` | Кастомный домен для GitHub Pages (`ans-kochevnik.ru`) |
| `robots.txt`, `sitemap.xml` | SEO |
| `photos/`, `media/` | Изображения и видео сайта |

> `kochevnik.html`, `kochevnik-dark (*).html`, `kochevnik-light (*).html` —
> старые/рабочие копии, на сайте не используются.

---

## Хостинг и домен

Сайт раздаётся через **GitHub Pages** из ветки `main` репозитория
`github.com/Xenaja/kochevnik`. Любой `git push` в `main` автоматически
публикует изменения (через 1–2 минуты).

**Домен `ans-kochevnik.ru`:**
- DNS управляется у регистратора **reg.ru** (NS: `ns1.reg.ru`, `ns2.reg.ru`).
- Ресурсные записи в зоне reg.ru:

  | Тип | Хост | Значение |
  |---|---|---|
  | A | @ | `185.199.108.153` |
  | A | @ | `185.199.109.153` |
  | A | @ | `185.199.110.153` |
  | A | @ | `185.199.111.153` |
  | CNAME | www | `xenaja.github.io` |

- В GitHub → репозиторий → **Settings → Pages**: Custom domain = `ans-kochevnik.ru`,
  включён **Enforce HTTPS** (сертификат GitHub выпускает автоматически).

> ⚠️ Файл `CNAME` в корне репозитория обязателен — при его удалении GitHub
> отключит кастомный домен.

---

## Форма заявки

Поток данных:

```
Форма на сайте (index.html)
        │  POST JSON {name, phone, event_type, event_date}
        ▼
Cloudflare Worker  (kochevnik-form.xenonline77.workers.dev)
        │  sendMessage
        ▼
Telegram-бот @ansamble_leads_bot → чат 343054483
```

- В `index.html` адрес воркера задаётся константой `WORKER_URL`.
- Worker (`worker.js`) проверяет обязательные поля (имя, телефон), экранирует
  данные и шлёт сообщение в Telegram через Bot API.
- Секреты воркера (Cloudflare → Worker → **Settings → Variables and Secrets**):

  | Имя | Значение |
  |---|---|
  | `TG_TOKEN` | токен бота от @BotFather |
  | `TG_CHAT_ID` | ID чата, куда приходят заявки (например `343054483`) |

> ⚠️ **Имена секретов чувствительны к пробелам.** Если в имени `TG_CHAT_ID`
> случайно окажется хвостовой пробел, воркер не найдёт переменную и форма будет
> молча падать с `502 Telegram error`. Вписывайте имена строго: `TG_TOKEN`,
> `TG_CHAT_ID`.

---

## Типовые задачи

### Изменить текст / фото на сайте
Отредактируйте `index.html` (и при необходимости файлы в `photos/`), затем:
```bash
git add -A
git commit -m "Обновление контента"
git push origin main
```
Через 1–2 минуты изменения появятся на сайте.

### Изменить, куда приходят заявки
Поменяйте значение секрета `TG_CHAT_ID` (и при смене бота — `TG_TOKEN`) в
Cloudflare → Worker → Settings → Variables and Secrets, затем нажмите **Deploy**.
Чтобы бот мог писать в личный чат — получатель должен один раз нажать `/start`
у бота.

### Обновить логику воркера
Отредактируйте код в Cloudflare (Worker → **Edit code**) либо локально `worker.js`
и задеплойте через Wrangler:
```bash
npm install -g wrangler
wrangler login
wrangler deploy worker.js --name kochevnik-form
```

### Узнать chat_id
Напишите боту **@userinfobot** — он покажет «Your ID» (личный чат). Для группы —
добавьте в неё бота и используйте ID группы (с минусом), не забыв добавить туда же
самого бота заявок.

---

## Диагностика формы

Если заявки не доходят, временно замените код воркера на диагностический —
он покажет, какие переменные реально видит воркер и что отвечает Telegram:

```js
export default {
  async fetch(request, env) {
    const keys = Object.keys(env);
    let tg = null;
    try {
      const r = await fetch(`https://api.telegram.org/bot${env.TG_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: env.TG_CHAT_ID, text: 'диагностика' }),
      });
      tg = { status: r.status, body: await r.text() };
    } catch (e) { tg = { error: String(e) }; }
    return new Response(JSON.stringify({
      env_keys: keys.map(k => `[${k}]`),
      TG_CHAT_ID_value: env.TG_CHAT_ID || null,
      telegram: tg,
    }, null, 2), { headers: { 'Content-Type': 'application/json' } });
  },
};
```

Откройте `https://kochevnik-form.xenonline77.workers.dev` (POST) и посмотрите ответ.
Частые причины: пробел в имени секрета, пустое значение, не нажат **Deploy**,
получатель не нажал `/start` у бота. После диагностики верните боевой `worker.js`.
