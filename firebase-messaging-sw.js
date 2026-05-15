// Kernel Terminal — Service Worker
// Kuulab Firebase Realtime DB-d otse, ei vaja FCM-i
// Töötab Firefox, Chrome, Safari, Edge

const FIREBASE_URL = 'https://kernel-chat-8b669-default-rtdb.europe-west1.firebasedatabase.app';

let lastMsgKey = null;
let currentUser = null;
let pollInterval = null;

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'INIT') {
    currentUser = e.data.user;
    lastMsgKey = e.data.lastKey || null;
    startPolling();
  }
  if (e.data && e.data.type === 'STOP') {
    stopPolling();
  }
});

function startPolling() {
  if (pollInterval) return;
  pollInterval = setInterval(checkNewMessages, 5000);
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

async function checkNewMessages() {
  if (!currentUser) return;
  try {
    const res = await fetch(
      `${FIREBASE_URL}/messages.json?orderBy="timestamp"&limitToLast=1`
    );
    if (!res.ok) return;
    const data = await res.json();
    if (!data) return;

    const entries = Object.entries(data);
    if (!entries.length) return;
    const [key, msg] = entries[0];

    // Ignoreeri kui sama sõnum, enda sõnum või kustutatud
    if (key === lastMsgKey) return;
    if (msg.user === currentUser) { lastMsgKey = key; return; }
    if (msg.deleted) { lastMsgKey = key; return; }

    lastMsgKey = key;

    self.registration.showNotification('KERNEL_TERMINAL — uus sõnum', {
      body: msg.user + ': ' + msg.text,
      vibrate: [200, 100, 200],
      tag: key, // duplikaatide vältimiseks
    });
  } catch(e) {
    // Vaikne ebaõnnestumine — ei taha SW-d krahhida
  }
}

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
      for (const c of cs) {
        if ('focus' in c) return c.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});
