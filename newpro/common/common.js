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

document.addEventListener('DOMContentLoaded', () => {
  loadPart('#menu-container', 'common/menu.html').then(r => {
    updateActiveMenu();
  });

  loadPart('#toast-container', 'common/toast.html');
  loadPart('#auth-modal-container', 'common/auth.html'); // ← 추가: 있으면 자동 로드
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
