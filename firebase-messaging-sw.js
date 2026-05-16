importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCW1sTAjhIEMGddqplM7TQ-Wc0eLYWhRSQ",
  authDomain: "kernel-chat-8b669.firebaseapp.com",
  databaseURL: "https://kernel-chat-8b669-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "kernel-chat-8b669",
  storageBucket: "kernel-chat-8b669.firebasestorage.app",
  messagingSenderId: "70231400069",
  appId: "1:70231400069:web:8e62e67bd7c2efb28553ec"
});

const messaging = firebase.messaging();

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());

// Taustsõnumid — rakendus suletud või taustal
// Kasutame data payload-i (mitte notification) et vältida topelt teavitust
messaging.onBackgroundMessage((payload) => {
  const title = payload.data?.title || 'KERNEL_TERMINAL';
  const body  = payload.data?.body  || '';
  self.registration.showNotification(title, {
    body,
    icon: 'https://annilillesalajaneaustaja-blip.github.io/kernel-terminal/ikoon.png',
    vibrate: [200, 100, 200],
    tag: 'kernel-msg'
  });
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
      for (const c of cs) { if ('focus' in c) return c.focus(); }
      if (clients.openWindow) return clients.openWindow('https://annilillesalajaneaustaja-blip.github.io/kernel-terminal/');
    })
  );
});
