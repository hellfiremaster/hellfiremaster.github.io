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
  
messaging.onMessage((payload) => {
    console.log('onMessage received. ', payload);
});

// 백그라운드 메시지는 자동으로 노티로 보여준다고 가정
// 클릭 시 동작 정의
self.addEventListener('notificationclick', event => {
    console.log('notificationclick', event);
    event.notification.close();
    const { postId, commentId } = event.notification.data || {};
    const url = `${self.location.origin}/?postId=${postId}&commentId=${commentId}`;
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then(winList => {
          // 이미 열린 창 있으면 포커스
          for (const win of winList) {
            if (win.url === url) return win.focus();
          }
          // 없으면 새창
          return clients.openWindow(url);
        })
    );
  });