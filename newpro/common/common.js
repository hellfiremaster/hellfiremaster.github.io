import { auth, db, functions, storage, analytics, app } from './firebase-init.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js';
import { doc, setDoc, getDoc, collection, query, where, getDocs, limit, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js';
import { getMessaging, getToken } from 'https://www.gstatic.com/firebasejs/11.2.0/firebase-messaging.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/11.2.0/firebase-functions.js';    

let admin = null;
let authInitalized = false;

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
      
        // 관리자 메뉴 추가(중복 삽입 방지용 id 체크)
        // if (dropdownMenu && termsLi && !dropdownMenu.querySelector('#resetPassword')) {
        //   termsLi.insertAdjacentHTML('afterend', `
        //     <li><a class="dropdown-item" id="resetPassword" href="reset-password.html">🔒 비밀번호 초기화</a></li>
        //   `);
        // }
      }
      let nickname = '익명', score = 0;

      const u = await fetchUserDoc(user.uid);
      if (u) { nickname = u.nickname || nickname; score = u.score || 0; }
      const r = getRankByScore(score);
      if (userDropBtn) userDropBtn.innerText = `${nickname} ${r.icon}`;
      saveFcmToken();

      const copyBtn = document.getElementById('copyReferralLinkBtn');
      if (copyBtn) {
        const clone = copyBtn.cloneNode(true);
        copyBtn.parentNode.replaceChild(clone, copyBtn);

        const buildReferralUrl = () => {
          // index.html 기준으로 referrer 파라미터만 붙인 공유 링크 생성
          const url = new URL('index.html', window.location.href);
          url.searchParams.set('referrer', nickname);
          return url.toString();
        };
      
        clone.addEventListener('click', async (e) => {
          e.preventDefault();
          const link = buildReferralUrl();
          try {
            await navigator.clipboard.writeText(link);
            showToast(
              '초대 링크를 복사했어요! 친구에게 붙여넣기 해줘 💖<br/>' +
              '<small class="text-light">✨ 본인을 추천인으로 가입하면 <span class="fw-bold">500포인트</span> 보너스!</small>',
              '추천링크 복사'
            );
          } catch (err) {
            // Clipboard API가 막힌 환경 폴백
            window.prompt('아래 링크를 복사해줘', link);
          }
        }, { once: true });
      }

    } else {
      admin = false;
      if (loginBtn)  loginBtn.classList.remove('d-none');
      if (signupBtn) signupBtn.classList.remove('d-none');
      if (userDropdown) userDropdown.classList.add('d-none');

      const params = new URLSearchParams(location.search);
      const refFromUrl = params.get('referrer');
      if (refFromUrl) {
        const refInput = document.getElementById('referrer');
        if (refInput) {
          refInput.value = refFromUrl;
          refInput.readOnly = true;                 // 수정 금지
          refInput.setAttribute('aria-readonly', 'true');
          refInput.classList.add('bg-light');       // 살짝 비활성화 느낌(선택)
        }
        const modalEl = document.getElementById('signupModal');
        if (modalEl) {
          bootstrap.Modal.getOrCreateInstance(modalEl).show();
        }
      }      
    }

    authInitalized = true;
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
            // console.log('FCM 토큰 저장 완료💕', currentToken);
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
      const nickname  = document.getElementById('signupNickname').value.trim();
      const referrerNickname = document.getElementById('referrer').value.trim();
      if (!email || !pw || !nickname) {
        return showToast('모든 항목을 입력하세요.', '회원가입 실패');
      }
      if (/\s/.test(nickname)) {
        document.getElementById('signupNickname').focus();
        return showToast('닉네임에 공백이 들어가면 안 돼! 공백을 제거하고 다시 시도해줘 💡', '회원가입 실패');
      }
      // 닉네임 중복 체크
      const snap = await getDocs(query(collection(db,'users'), where('nickname','==', nickname), limit(1)));
      if (!snap.empty) return showToast('이미 사용 중인 닉네임이에요.', '회원가입 실패');

      try {
        const cred = await createUserWithEmailAndPassword(auth, email, pw);
        await setDoc(doc(db,'users', cred.user.uid), { nickname, score: 0, createdAt: serverTimestamp() });
        if(referrerNickname) {
          await setDoc(doc(db,'users_private', cred.user.uid), { referrerNickname });
        }
        showToast('회원가입 성공!', '회원가입');
        bootstrap.Modal.getInstance(document.getElementById('signupModal'))?.hide();
        if(referrerNickname) {
          const applyReferrer = httpsCallable(functions, 'applyReferrer');
          applyReferrer({ referrerNickname });
        }
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
  if(!authInitalized) {
    showToast('인증 상태를 확인하는 중이에요. 잠시만 기다려주세요.', '잠시만요');
    return;
  }

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

export function showOkModal({
  title = '알림',
  message = '',
  okText = 'OK',
  size = 'md',        // 'sm' | 'md' | 'lg'
  backdrop = 'static',
  keyboard = false
} = {}) {
  const el     = document.getElementById('okModal');
  const dialog = document.getElementById('okModalDialog');
  const titleEl= document.getElementById('okModalTitle');
  const bodyEl = document.getElementById('okModalBody');
  const okBtn  = document.getElementById('okModalOk');

  // 사이즈 적용
  dialog.className = 'modal-dialog modal-dialog-centered';
  if (size === 'sm') dialog.classList.add('modal-sm');
  if (size === 'lg') dialog.classList.add('modal-lg');

  // 내용/버튼 텍스트
  titleEl.textContent = title;
  bodyEl.innerHTML = message;
  okBtn.textContent = okText;

  // 이전 핸들러 정리(클론으로 교체)
  const okClone = okBtn.cloneNode(true);
  okBtn.parentNode.replaceChild(okClone, okBtn);

  const modal = bootstrap.Modal.getOrCreateInstance(el, { backdrop, keyboard });

  return new Promise((resolve) => {
    let done = false;
    const finish = (val) => {
      if (done) return;
      done = true;
      resolve(val);
      modal.hide();
    };

    okClone.addEventListener('click', () => finish(true), { once: true });
    // X/백드롭/ESC로 닫히면 false
    el.addEventListener('hidden.bs.modal', () => finish(false), { once: true });

    modal.show();
  });
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

// light-dark 적용
const themeQuery = window.matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  document.documentElement.setAttribute(
    'data-bs-theme',
    themeQuery.matches ? 'dark' : 'light'
  );
}
applyTheme();
themeQuery.addEventListener('change', applyTheme);

// 🎄 크리스마스 시즌 체크 및 CSS 로드 (common.js 안이나 script 태그 안에 넣어줘)
function checkChristmasEvent() {
  const today = new Date();
  const month = today.getMonth() + 1; // 월 (0부터 시작해서 +1 해줘야 함)
  const day = today.getDate();        // 일

  // 이벤트 기간 설정: 12월 20일 ~ 12월 26일 (원하는 대로 수정 가능!)
  const isEventPeriod = (month === 12 && day >= 20 && day <= 31);

  // 테스트할 때는 강제로 true로 바꿔서 확인해봐! 
  // const isEventPeriod = true; 

  if (isEventPeriod) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './common/christmas.css'; // ★ 저장한 파일 경로 정확하게!
    document.head.appendChild(link);
  }
}

// 페이지 로드되면 실행!
checkChristmasEvent();