import { getApps, getApp, initializeApp } from 'https://www.gstatic.com/firebasejs/11.2.0/firebase-app.js';
import { initializeAppCheck, ReCaptchaV3Provider } from 'https://www.gstatic.com/firebasejs/11.2.0/firebase-app-check.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js';
import { getFunctions } from 'https://www.gstatic.com/firebasejs/11.2.0/firebase-functions.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/11.2.0/firebase-storage.js';
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyC-etI5o4uWbBp2Arj9KpxdDyRebguErnY",
  authDomain: "newpro-4bc73.firebaseapp.com",
  projectId: "newpro-4bc73",
  storageBucket: "newpro-4bc73.firebasestorage.app",
  messagingSenderId: "267192611563",
  appId: "1:267192611563:web:94fb5ec97872cd452a84ae"
};
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// App Check는 앱당 1회
try {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider('6LcKb8QqAAAAAKReI1hvkatzxiNvquuoryudyXi4'),
    isTokenAutoRefreshEnabled: true
  });
} catch { /* 이미 초기화됐다면 조용히 패스 */ }

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
export const storage = getStorage(app);
export const analytics = getAnalytics(app);
export { app }