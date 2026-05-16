// ════════════════════════════════════════════════════
//   KERNEL TERMINAL — Cloudflare Worker
//   Kutsutakse index.html-ist iga sõnumi saatmisel
// ════════════════════════════════════════════════════

const FCM_PROJECT_ID  = 'kernel-chat-8b669';
const SA_CLIENT_EMAIL = 'firebase-adminsdk-fbsvc@kernel-chat-8b669.iam.gserviceaccount.com';

export default {
  async fetch(request, env, ctx) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    const url = new URL(request.url);

    // Tokeni registreerimine seadmel
    if (request.method === 'POST' && url.pathname === '/register') {
      try {
        const { token, user } = await request.json();
        if (!token || !user) return new Response('missing fields', { status: 400, headers: cors });
        await env.KV.put('token:' + user, token);
        return new Response('ok', { headers: cors });
      } catch(e) {
        return new Response(e.message, { status: 500, headers: cors });
      }
    }

    // Teavituse saatmine — kutsutakse iga sõnumi saatmisel
    if (request.method === 'POST' && url.pathname === '/notify') {
      try {
        const { fromUser, text } = await request.json();
        if (!fromUser || !text) return new Response('missing fields', { status: 400, headers: cors });

        ctx.waitUntil(sendNotifications(env, fromUser, text));
        return new Response('ok', { headers: cors });
      } catch(e) {
        return new Response(e.message, { status: 500, headers: cors });
      }
    }

    return new Response('Kernel Terminal Push Worker', { headers: cors });
  }
};

async function sendNotifications(env, fromUser, text) {
  try {
    const tokenKeys = await env.KV.list({ prefix: 'token:' });
    if (!tokenKeys.keys.length) return;

    const privateKey = await env.SA_PRIVATE_KEY.get();
    const oauthToken = await getOAuthToken(privateKey);

    for (const k of tokenKeys.keys) {
      const user = k.name.replace('token:', '');
      if (user === fromUser) continue; // ära saada endale
      const token = await env.KV.get(k.name);
      if (!token) continue;

      await sendFCMv1(oauthToken, token, {
        title: 'KERNEL_TERMINAL — uus sõnum',
        body: fromUser + ': ' + text
      });
    }
  } catch(e) {
    console.error('sendNotifications:', e.message);
  }
}

async function getOAuthToken(privateKey) {
  const b64url = s => btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
  const enc = o => b64url(unescape(encodeURIComponent(JSON.stringify(o))));

  const now = Math.floor(Date.now() / 1000);
  const unsigned = enc({ alg: 'RS256', typ: 'JWT' }) + '.' + enc({
    iss: SA_CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  });

  const pemBody = privateKey
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');

  const keyBuf = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    'pkcs8', keyBuf.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  );

  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', key,
    new TextEncoder().encode(unsigned)
  );
  const jwt = unsigned + '.' + b64url(String.fromCharCode(...new Uint8Array(sig)));

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('OAuth failed: ' + JSON.stringify(data));
  return data.access_token;
}

async function sendFCMv1(oauthToken, fcmToken, notification) {
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`,
    {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + oauthToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: {
          token: fcmToken,
          notification: { title: notification.title, body: notification.body },
          webpush: {
            notification: { title: notification.title, body: notification.body, vibrate: [200, 100, 200] },
            fcm_options: { link: 'https://annilillesalajaneaustaja-blip.github.io/kernel-terminal/' }
          }
        }
      })
    }
  );
  if (!res.ok) console.error('FCM v1 failed:', res.status, await res.text());
}
