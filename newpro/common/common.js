import { auth, db, functions, storage, analytics, app } from './firebase-init.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js';
import { doc, setDoc, getDoc, collection, query, where, getDocs, limit, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js';
import { getMessaging, getToken } from 'https://www.gstatic.com/firebasejs/11.2.0/firebase-messaging.js';

let admin = null;

// ---- 유틸: 점수→랭크 이모지(간단판) ----
export function getRankByScore(score=0) {
  if (score >= 50000) return { name: '이터널', icon: '🌌' };
  if (score >= 25000) return { name: '레전드', icon: '👑' };
  if (score >= 10000) return { name: '마스터', icon: '🏆' };
  if (score >= 5000)  return { name: '다이아몬드', icon: '💎' };
  if (score >= 1000)  return { name: '플래티넘', icon: '🛡️' };
  if (score >= 500)   return { name: '골드', icon: '🥇' };
  if (score >= 100)   return { name: '실버', icon: '🥈' };
  return { name: '브론즈', icon: '🥉' };
}

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

      const idTokenResult = await user.getIdTokenResult()
      const claims = idTokenResult.claims;
      admin = claims.admin ?? false;

      if(admin) {
        const dropdownMenu = document.querySelector('#userDropdown .dropdown-menu');
        const termsLi = dropdownMenu?.querySelector('a[href="terms.html"]')?.closest('li');
      
        // 중복 삽입 방지용 id 체크
        if (dropdownMenu && termsLi && !dropdownMenu.querySelector('#giftAddItem')) {
          termsLi.insertAdjacentHTML('afterend', `
            <li><a class="dropdown-item" id="giftAddItem" href="giftcon.html">🎁 기프트콘 추가</a></li>
          `);
        }
      }
      let nickname = '익명', score = 0;

      const u = await fetchUserDoc(user.uid);
      if (u) { nickname = u.nickname || nickname; score = u.score || 0; }
      const r = getRankByScore(score);
      if (userDropBtn) userDropBtn.innerText = `${nickname} ${r.icon}`;
      saveFcmToken();

    } else {
      admin = false;
      if (loginBtn)  loginBtn.classList.remove('d-none');
      if (signupBtn) signupBtn.classList.remove('d-none');
      if (userDropdown) userDropdown.classList.add('d-none');
    }
  });

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await signOut(auth);
        alert('안녕히 가세요. ^^');        
        location.reload();
      } catch (err) {
        showToast(err.message, '로그아웃 실패');
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
            console.log('FCM 토큰 저장 완료💕', currentToken);
          }
        } catch (err) {
          console.error('FCM 토큰 가져오기 실패💦', err);
        }
      }
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
        return showToast('모든 항목을 입력하세요.', '회원가입 실패');
      }
      // 닉네임 중복 체크
      const snap = await getDocs(query(collection(db,'users'), where('nickname','==', nick), limit(1)));
      if (!snap.empty) return showToast('이미 사용 중인 닉네임이에요.', '회원가입 실패');

      try {
        const cred = await createUserWithEmailAndPassword(auth, email, pw);
        await setDoc(doc(db,'users', cred.user.uid), { nickname: nick, score: 0, createdAt: serverTimestamp() });
        showToast('회원가입 성공!', '회원가입');
        bootstrap.Modal.getInstance(document.getElementById('signupModal'))?.hide();
      } catch (err) {
        showToast(err.message, '회원가입 실패');
      }
    });
  }

  // 로그인
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value.trim();
      const pw    = document.getElementById('loginPassword').value.trim();
      if (!email || !pw) return showToast('이메일/비밀번호를 입력하세요.', '로그인 실패');
      try {
        await signInWithEmailAndPassword(auth, email, pw);
        showToast('로그인 성공!', '로그인');
        bootstrap.Modal.getInstance(document.getElementById('loginModal'))?.hide();
        location.reload();
      } catch (err) {
        showToast(err.message, '로그인 실패');
      }
    });
  }

  // 비밀번호 초기화
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      const email = document.getElementById('loginEmail').value.trim();
      if (!email) return showToast('이메일을 입력하세요.', '오류');
      try {
        await sendPasswordResetEmail(auth, email);
        showToast('비밀번호 초기화 메일을 보냈어요.', '비밀번호 초기화');
      } catch (err) {
        showToast(err.message, '오류');
      }
    });
  }
}

// 로그인 요구 헬퍼 (다른 페이지에서도 씀)
export function requireLogin() {
  showToast('로그인이 필요합니다.', '반가워요.');
  const el = document.getElementById('signupModal');
  bootstrap.Modal.getOrCreateInstance(el).show();
}

async function loadPart(containerSelector, filePath) {
  const el = document.querySelector(containerSelector);
  if (!el) return;
  const html = await fetch(filePath).then(r => r.text());
  el.innerHTML = html;
}

function updateActiveMenu() {
  // 현재 페이지의 파일 이름만 가져오기
  let currentPage = window.location.pathname.split('/').pop();

  // 파일명이 없으면 index.html로 처리
  if (!currentPage) {
    currentPage = 'index.html';
  }

  const navLinks = document.querySelectorAll('#mainNav .nav-link');

  navLinks.forEach(link => {
    let linkPage = link.getAttribute('href').split('/').pop();
    if (!linkPage) {
      linkPage = 'index.html';
    }
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
      loadPart('#common-html', 'common/common.html'),
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
export function showToast(message, title = '알림', duration = 5000) {
  const toastEl = document.getElementById('liveToast');
  if (!toastEl) return;
  document.getElementById('toastTitle').textContent = title;
  document.getElementById('toastMessage').innerHTML = String(message).replace(/\n/g, '<br/>');
  new bootstrap.Toast(toastEl, { delay: duration }).show();
}

// 전역 Yes/No 모달 호출기
export function showYesNoModal({
  title = '확인',
  message = '',
  yesText = 'Yes',
  noText = 'No',
  size = 'md',        // 'sm' | 'md' | 'lg'
  backdrop = 'static',
  keyboard = false
} = {}) {
  const el = document.getElementById('yesNoModal');
  const dialog = document.getElementById('yesNoModalDialog');
  const titleEl = document.getElementById('yesNoModalTitle');
  const bodyEl  = document.getElementById('yesNoModalBody');
  const yesBtn  = document.getElementById('yesNoModalYes');
  const noBtn   = document.getElementById('yesNoModalNo');

  // 사이즈 적용
  dialog.className = 'modal-dialog modal-dialog-centered';
  if (size === 'sm') dialog.classList.add('modal-sm');
  if (size === 'lg') dialog.classList.add('modal-lg');

  // 내용/버튼 텍스트
  titleEl.textContent = title;
  bodyEl.innerHTML = message;
  yesBtn.textContent = yesText;
  noBtn.textContent  = noText;

  // 이전 핸들러 정리(클론으로 교체)
  const yesClone = yesBtn.cloneNode(true);
  const noClone  = noBtn.cloneNode(true);
  yesBtn.parentNode.replaceChild(yesClone, yesBtn);
  noBtn.parentNode.replaceChild(noClone, noBtn);

  const modal = bootstrap.Modal.getOrCreateInstance(el, { backdrop, keyboard });

  return new Promise((resolve) => {
    let done = false;
    const finish = (val) => {
      if (done) return;
      done = true;
      resolve(val);
      modal.hide();
    };

    yesClone.addEventListener('click', () => finish(true), { once: true });
    noClone.addEventListener('click',  () => finish(false), { once: true });
    // X버튼/백드롭 닫힘도 No 처리
    el.addEventListener('hidden.bs.modal', () => finish(false), { once: true });

    modal.show();
  });
}

export function showLoader(showing) {
  if(showing) {
    document.getElementById('fullScreenLoader').classList.remove('d-none');
  } else {
    document.getElementById('fullScreenLoader').classList.add('d-none');
  }
}