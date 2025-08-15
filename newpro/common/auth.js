import { auth, db, functions, storage, analytics } from './firebase-init.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, limit, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js';
import { getMessaging, getToken, onMessage } from 'https://www.gstatic.com/firebasejs/11.2.0/firebase-messaging.js';
import * as common from './common.js';

// ---- 유틸: 점수→랭크 이모지(간단판) ----
function getRankByScore(score=0) {
  if (score >= 50000) return { name: '이터널', icon: '🌌' };
  if (score >= 25000) return { name: '레전드', icon: '👑' };
  if (score >= 10000) return { name: '마스터', icon: '🏆' };
  if (score >= 5000)  return { name: '다이아몬드', icon: '💎' };
  if (score >= 1000)  return { name: '플래티넘', icon: '🛡️' };
  if (score >= 500)   return { name: '골드', icon: '🥇' };
  if (score >= 100)   return { name: '실버', icon: '🥈' };
  return { name: '브론즈', icon: '🥉' };
}
window.getRankByScore = getRankByScore;

async function fetchUserDoc(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() : null;
}

// 요소 기다리기 (조각이 비동기로 로드되니까 기다려줘야 해!)
function waitForEl(selector, timeout=5000) {
  return new Promise((resolve, reject) => {
    const t0 = performance.now();
    const tick = () => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);
      if (performance.now() - t0 > timeout) return reject(new Error(`EL timeout: ${selector}`));
      requestAnimationFrame(tick);
    };
    tick();
  });
}

function bindAuthUI() {
  const authLoadingBtn = document.getElementById('authLoadingBtn');
  const loginBtn       = document.getElementById('loginBtn');
  const signupBtn      = document.getElementById('signupBtn');
  const userDropdown   = document.getElementById('userDropdown');
  const userDropBtn    = document.getElementById('userDropdownMenuButton');
  const logoutBtn      = document.getElementById('logoutBtnDropdown');

  // 상태 반영
  onAuthStateChanged(auth, async (user) => {
    if (authLoadingBtn) authLoadingBtn.classList.add('d-none');
    if (user) {
      if (loginBtn)  loginBtn.classList.add('d-none');
      if (signupBtn) signupBtn.classList.add('d-none');
      if (userDropdown) userDropdown.classList.remove('d-none');

      let nickname = '익명', score = 0;
      const u = await fetchUserDoc(user.uid);
      if (u) { nickname = u.nickname || nickname; score = u.score || 0; }
      const r = getRankByScore(score);
      if (userDropBtn) userDropBtn.innerText = `${nickname} ${r.icon}`;
      saveFcmToken();
    } else {
      if (loginBtn)  loginBtn.classList.remove('d-none');
      if (signupBtn) signupBtn.classList.remove('d-none');
      if (userDropdown) userDropdown.classList.add('d-none');
    }
  });

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await signOut(auth);
        window.showToast('로그아웃 완료', '로그아웃');
      } catch (err) {
        window.showToast(err.message, '로그아웃 실패');
      }
    });
  }
}

function saveFcmToken() {
  // 1) Messaging 객체 생성
  if(location.protocol === 'https:') {
    const messaging = getMessaging(app);

    if (Notification.permission === 'default') {
      showToast('알림을 허용하면 댓글 알림을 받을수 있습니다.');
    }

    // 2) 푸시 권한 요청 & 토큰 발급
    Notification.requestPermission().then(async (permission) => {
      if (permission === 'granted' && auth.currentUser) {
        try {
          const currentToken = await getToken(messaging, {
            vapidKey: 'BI4TCRiStLi-urYEy8MPM3A8Q2ciQkI7LwvkqQrudLDoXznHllqGN61b0ueM57BSltpgqJsoL4nMt7lcyQL6pbc'
          });
          if (currentToken) {
            await setDoc(doc(db, 'users_private', auth.currentUser.uid), {
              fcmToken: currentToken,
              updatedAt: serverTimestamp()
            }, { merge: true });
            // console.log('FCM 토큰 저장 완료💕', currentToken);
          }
        } catch (err) {
          console.error('FCM 토큰 가져오기 실패💦', err);
        }
      }
    });

    // 4) 앱이 켜져 있을 때 수신 메시지 처리 (optional)
    onMessage(messaging, (payload) => {
      console.log('새 알림 도착✨', payload);
      const postId = payload.data?.postId;
      if(postId) {
        fetchComment(postId);
      }
      // showToast(payload.notification.title, payload.notification.body);
    });
  }
}

function bindModals() {
  const signupForm = document.getElementById('signupForm');
  const loginForm  = document.getElementById('loginForm');
  const resetBtn   = document.getElementById('resetPasswordBtn');

  // 회원가입
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('signupEmail').value.trim();
      const pw    = document.getElementById('signupPassword').value.trim();
      const nick  = document.getElementById('signupNickname').value.trim();
      if (!email || !pw || !nick) {
        return window.showToast('모든 항목을 입력하세요.', '회원가입 실패');
      }
      // 닉네임 중복 체크
      const snap = await getDocs(query(collection(db,'users'), where('nickname','==', nick), limit(1)));
      if (!snap.empty) return window.showToast('이미 사용 중인 닉네임이에요.', '회원가입 실패');

      try {
        const cred = await createUserWithEmailAndPassword(auth, email, pw);
        await setDoc(doc(db,'users', cred.user.uid), { nickname: nick, score: 0, createdAt: serverTimestamp() });
        window.showToast('회원가입 성공!', '회원가입');
        bootstrap.Modal.getInstance(document.getElementById('signupModal'))?.hide();
      } catch (err) {
        window.showToast(err.message, '회원가입 실패');
      }
    });
  }

  // 로그인
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value.trim();
      const pw    = document.getElementById('loginPassword').value.trim();
      if (!email || !pw) return window.showToast('이메일/비밀번호를 입력하세요.', '로그인 실패');
      try {
        await signInWithEmailAndPassword(auth, email, pw);
        window.showToast('로그인 성공!', '로그인');
        bootstrap.Modal.getInstance(document.getElementById('loginModal'))?.hide();
      } catch (err) {
        window.showToast(err.message, '로그인 실패');
      }
    });
  }

  // 비밀번호 초기화
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      const email = document.getElementById('loginEmail').value.trim();
      if (!email) return window.showToast('이메일을 입력하세요.', '오류');
      try {
        await sendPasswordResetEmail(auth, email);
        window.showToast('비밀번호 초기화 메일을 보냈어요.', '비밀번호 초기화');
      } catch (err) {
        window.showToast(err.message, '오류');
      }
    });
  }
}

// 로그인 요구 헬퍼 (다른 페이지에서도 씀)
function requireLogin() {
  window.showToast('로그인이 필요합니다.', '반가워요.');
  const el = document.getElementById('signupModal');
  bootstrap.Modal.getOrCreateInstance(el).show();
}
window.requireLogin = requireLogin;

// 시작: 조각이 로드될 때까지 기다렸다가 바인딩
(async () => {
  try {
    await waitForEl('#menu-container');           // 메뉴
    await waitForEl('#auth-modal-container');     // 모달 컨테이너
    await waitForEl('#signupModal');              // 모달이 실제로 로드될 때까지
    bindAuthUI();
    bindModals();

    // 모달 열릴 때 포커스 (귀염 포인트✨)
    document.getElementById('signupModal')?.addEventListener('shown.bs.modal', () => document.getElementById('signupEmail')?.focus());
    document.getElementById('loginModal') ?.addEventListener('shown.bs.modal', () => document.getElementById('loginEmail') ?.focus());
  } catch (e) {
    // 페이지에 컨테이너가 없을 수도 있으니 조용히 패스~
  }
})();