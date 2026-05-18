importScripts('https://www.gstatic.com/firebasejs/11.2.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.2.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyC-etI5o4uWbBp2Arj9KpxdDyRebguErnY",
  authDomain: "newpro-4bc73.firebaseapp.com",
  projectId: "newpro-4bc73",
  storageBucket: "newpro-4bc73.firebasestorage.app",
  messagingSenderId: "267192611563",
  appId: "1:267192611563:web:94fb5ec97872cd452a84ae"
};
firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  console.log('onBackgroundMessage received.', payload);  
  // self.registration.showNotification(
  //   payload.notification.title,
  //   payload.notification
  // );
});

self.addEventListener('notificationclick', (event) => {
  console.log('notificationclick', event);
  // event.notification.close();

  // const fcmData = event.notification?.data?.FCM_MSG?.data || event.notification?.data || {};
  // const roomId = fcmData.roomId || '';

  // const target = new URL('/newpro/chess.html', self.location.origin);
  // if (roomId) {
  //   target.searchParams.set('roomId', roomId);
  // }
  // const url = target.toString();

  // event.waitUntil(
  //   clients.matchAll({ type: 'window', includeUncontrolled: true }).then((winList) => {
  //     for (const win of winList) {
  //       if ('navigate' in win) {
  //         return win.navigate(url).then((client) => {
  //           const nextClient = client || win;
  //           if ('focus' in nextClient) {
  //             return nextClient.focus();
  //           }
  //           return undefined;
  //         });
  //       }
  //     }
  //     return clients.openWindow(url);
  //   })
  // );
});