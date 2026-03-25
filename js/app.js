// ===== THEME =====
(function() {
  const saved = localStorage.getItem('crv-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
})();

document.addEventListener('DOMContentLoaded', () => {
  // Inicializa Lucide Icons
  if (typeof lucide !== 'undefined') lucide.createIcons();

  // Theme toggle
  const toggle = document.getElementById('themeToggle');
  const icon   = document.getElementById('iconTheme');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const html  = document.documentElement;
      const isDark = html.getAttribute('data-theme') === 'dark';
      html.setAttribute('data-theme', isDark ? 'light' : 'dark');
      localStorage.setItem('crv-theme', isDark ? 'light' : 'dark');
      if (icon) icon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
      lucide.createIcons();
    });
  }

  // Sidebar mobile
  const btnMenu  = document.getElementById('btnMenu');
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('sidebarOverlay');
  if (btnMenu && sidebar) {
    btnMenu.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('open');
    });
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('open');
    });
  }

  // Clock
  const clockEl = document.getElementById('topbarDatetime');
  if (clockEl) {
    const tick = () => {
      const now = new Date();
      clockEl.textContent = now.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
    };
    tick();
    setInterval(tick, 1000);
  }

  // Greeting
  const greetEl   = document.getElementById('greetingText');
  const greetDate = document.getElementById('greetingDate');
  if (greetEl) {
    const h = new Date().getHours();
    greetEl.textContent = h < 12 ? 'Bom dia 👋' : h < 18 ? 'Boa tarde 👋' : 'Boa noite 👋';
  }
  if (greetDate) {
    greetDate.textContent = new Date().toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  }
});

const avatar = document.querySelector('.topbar-avatar');
const modal = document.getElementById('userModal');
const closeBtn = document.getElementById('closeUserModal');

if (avatar && modal) {
  avatar.addEventListener('click', () => {
    modal.classList.remove('hidden');
  });

  closeBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.add('hidden');
    }
  });
}