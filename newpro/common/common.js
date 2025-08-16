import { auth, db, functions, storage, analytics } from './firebase-init.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js';
import { doc, setDoc, getDoc, collection, query, where, getDocs, limit, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js';
import { getMessaging, getToken, onMessage } from 'https://www.gstatic.com/firebasejs/11.2.0/firebase-messaging.js';

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

async function loadPart(containerSelector, filePath) {
  const el = document.querySelector(containerSelector);
  if (!el) return;
  const html = await fetch(filePath).then(r => r.text());
  el.innerHTML = html;
}

function updateActiveMenu() {
  // 현재 페이지의 파일 이름만 가져오기 (예: "index.html" 또는 "card.html")
  const currentPage = window.location.pathname.split('/').pop();

  // #mainNav 안의 모든 nav-link를 선택
  const navLinks = document.querySelectorAll('#mainNav .nav-link');

  navLinks.forEach(link => {
    // 각 링크의 href 속성에서 파일 이름만 가져오기
    const linkPage = link.getAttribute('href').split('/').pop();

    // 현재 페이지와 링크의 페이지가 같으면 'active' 클래스 추가!
    if (linkPage === currentPage) {
      link.classList.add('active');
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    // 여러 HTML 조각을 동시에 불러와서 시간 절약!
    await Promise.all([
      loadPart('#menu-container', 'common/menu.html'),
      loadPart('#toast-container', 'common/toast.html'),
    ]);

    // 모든 HTML 로딩이 끝났으니, 이제 안심하고 함수들을 실행할 수 있어!
    updateActiveMenu();
    bindAuthUI();
    bindModals();

    // 모달이 열릴 때 이메일 입력창에 자동으로 포커스 (귀염 포인트✨)
    document.getElementById('signupModal')?.addEventListener('shown.bs.modal', () => {
      document.getElementById('signupEmail')?.focus();
    });
    document.getElementById('loginModal')?.addEventListener('shown.bs.modal', () => {
      document.getElementById('loginEmail')?.focus();
    });

  } catch (err) {
    // 페이지에 해당 컨테이너가 없어도 괜찮아~ 조용히 넘어가자!
    // console.error(err); // 혹시 디버깅이 필요하면 이 줄을 활성화해!
  }
});

// 공통 토스트
function showToast(message, title = '알림', duration = 5000) {
  const toastEl = document.getElementById('liveToast');
  if (!toastEl) return;
  document.getElementById('toastTitle').textContent = title;
  document.getElementById('toastMessage').innerHTML = String(message).replace(/\n/g, '<br/>');
  new bootstrap.Toast(toastEl, { delay: duration }).show();
}
window.showToast = showToast;