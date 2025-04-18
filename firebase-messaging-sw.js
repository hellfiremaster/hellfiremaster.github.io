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