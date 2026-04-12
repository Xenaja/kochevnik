/**
 * Cloudflare Worker — прокси для отправки заявок в Telegram
 *
 * Переменные окружения (настроить в Cloudflare Dashboard → Worker → Settings → Variables):
 *   TG_TOKEN   — токен бота (получить у @BotFather)
 *   TG_CHAT_ID — ID чата/канала, куда слать сообщения (получить через @userinfobot или getUpdates)
 *
 * Деплой:
 *   1. Установить Wrangler: npm install -g wrangler
 *   2. wrangler login
 *   3. wrangler deploy worker.js --name kochevnik-form
 *   4. В Dashboard добавить переменные TG_TOKEN и TG_CHAT_ID
 *   5. Скопировать URL воркера (вида https://kochevnik-form.<subdomain>.workers.dev)
 *      и вставить в WORKER_URL в kochevnik.html / index.html
 */

export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders(),
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: corsHeaders() });
    }

    let data;
    try {
      data = await request.json();
    } catch {
      return json({ ok: false, error: 'Bad JSON' }, 400);
    }

    const { name, phone, event_type, event_date } = data;

    if (!name || !phone) {
      return json({ ok: false, error: 'Имя и телефон обязательны' }, 400);
    }

    const lines = [
      '📋 <b>Новая заявка — Ансамбль Кочевник</b>',
      '',
      `👤 <b>Имя:</b> ${esc(name)}`,
      `📞 <b>Телефон:</b> ${esc(phone)}`,
      event_type ? `🎪 <b>Мероприятие:</b> ${esc(event_type)}` : null,
      event_date ? `📅 <b>Дата:</b> ${esc(event_date)}` : null,
    ].filter(Boolean).join('\n');

    const tgRes = await fetch(
      `https://api.telegram.org/bot${env.TG_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: env.TG_CHAT_ID,
          text: lines,
          parse_mode: 'HTML',
        }),
      }
    );

    if (!tgRes.ok) {
      const err = await tgRes.text();
      console.error('Telegram error:', err);
      return json({ ok: false, error: 'Telegram error' }, 502);
    }

    return json({ ok: true });
  },
};

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}
