// Delt sidebar + auth til alle Vixx-sider

const SIDEBAR_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; color: #1a1a2e; display: flex; }
  .sidebar { width: 230px; min-height: 100vh; background: #0f172a; display: flex; flex-direction: column; position: fixed; top: 0; left: 0; bottom: 0; z-index: 50; }
  .sidebar-header { color: white; padding: 22px 20px 16px; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; flex-direction: column; gap: 12px; }
  .sidebar-brand { display: flex; align-items: center; gap: 10px; }
  .brand-ikon { width: 32px; height: 32px; background: #6366f1; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1rem; flex-shrink: 0; }
  .sidebar-titel { font-size: 1rem; font-weight: 700; color: white; }
  .sidebar-shopnavn { font-size: 0.75rem; opacity: 0.45; color: white; }
  .sidebar-logud { margin-top: 12px; background: rgba(255,255,255,0.08); border: none; color: rgba(255,255,255,0.6); padding: 8px 12px; border-radius: 8px; cursor: pointer; font-size: 0.78rem; width: 100%; text-align: left; transition: background 0.15s; }
  .sidebar-logud:hover { background: rgba(255,255,255,0.14); }
  .sidebar-nav { flex: 1; padding: 12px 10px; display: flex; flex-direction: column; gap: 2px; overflow-y: auto; }
  .nav-section-label { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 1px; color: rgba(255,255,255,0.25); padding: 12px 10px 4px; font-weight: 600; }
  .nav-item { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 8px; color: rgba(255,255,255,0.6); text-decoration: none; font-size: 0.88rem; font-weight: 500; transition: all 0.15s; cursor: pointer; }
  .nav-item:hover { background: rgba(255,255,255,0.07); color: white; }
  .nav-item.aktiv { background: rgba(99,102,241,0.2); color: #a5b4fc; }
  .nav-ikon { font-size: 1rem; width: 20px; text-align: center; opacity: 0.8; }
  .nav-pro-badge { margin-left: auto; background: #dcfce7; color: #16a34a; font-size: 0.6rem; font-weight: 700; padding: 2px 6px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.3px; }
  .vixx-main { margin-left: 230px; flex: 1; min-height: 100vh; padding: 32px 32px 64px; max-width: calc(100vw - 230px); }
  .spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(0,0,0,0.1); border-top-color: #6366f1; border-radius: 50%; animation: spin 0.7s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .badge { background: #fee2e2; color: #dc2626; border-radius: 99px; padding: 2px 8px; font-size: 0.75rem; font-weight: 600; }
  .badge.groen { background: #dcfce7; color: #16a34a; }
  .sektion { margin-bottom: 40px; }
  .sektion-header { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; }
  .sektion-header h2 { font-size: 1rem; font-weight: 700; color: #0f172a; }
  .sektion-divider { flex: 1; height: 1px; background: #e2e8f0; }
  .markeds-kort { background: white; border-radius: 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04); border: 1px solid #f1f5f9; margin-bottom: 16px; overflow: hidden; }
  .markeds-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; cursor: pointer; user-select: none; }
  .markeds-header:hover { background: #fafafa; }
  .markeds-header h2 { font-size: 0.95rem; font-weight: 600; margin: 0; }
  .markeds-header .markeds-pil { font-size: 0.8rem; color: #aaa; transition: transform 0.2s; }
  .markeds-header .markeds-undertekst { font-size: 0.82rem; color: #888; margin-top: 3px; }
  .markeds-body { padding: 0 24px 24px; display: none; }
  .markeds-body.aaben { display: block; }
  .markeds-loading { color: #888; font-size: 0.88rem; display: flex; align-items: center; gap: 10px; padding: 8px 0; }
  .tom { color: #aaa; font-size: 0.9rem; padding: 12px 0; }
  .send-knap { width: 100%; padding: 10px; border: none; background: #6366f1; color: white; border-radius: 8px; font-size: 0.88rem; font-weight: 600; cursor: pointer; transition: background 0.2s; }
  .send-knap:hover { background: #4f46e5; }
  .send-knap:disabled { background: #ccc; cursor: not-allowed; }
`;

function injectSidebarCSS() {
  const style = document.createElement('style');
  style.textContent = SIDEBAR_CSS;
  document.head.appendChild(style);
}

function renderSidebar(activePage) {
  injectSidebarCSS();

  const nav = {
    dashboard: 'dashboard.html',
    marketing: 'marketing.html',
    seo: 'seo.html'
  };

  const items = [
    { section: 'Oversigt' },
    { id: 'dashboard', ikon: '📊', label: 'Dashboard', href: nav.dashboard },
    { id: 'kunder', ikon: '👥', label: 'Kunder', href: nav.dashboard + '#kunder' },
    { section: '✦ Pro' },
    { id: 'marketing', ikon: '⭐', label: 'Kundeklub & Marketing', href: nav.marketing, pro: true },
    { id: 'seo', ikon: '🔎', label: 'SEO', href: nav.seo, pro: true },
    { section: 'Analyse' },
    { id: 'segmentering', ikon: '🎯', label: 'Segmentering', href: nav.dashboard + '#segmentering' },
    { id: 'produkter', ikon: '📦', label: 'Produkter', href: nav.dashboard + '#produkter' },
    { id: 'oekonomi', ikon: '💰', label: 'Økonomi', href: nav.dashboard + '#oekonomi' },
  ];

  const html = `
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="sidebar-brand">
          <div class="brand-ikon">◈</div>
          <span class="sidebar-titel">Vixx</span>
        </div>
        <span class="sidebar-shopnavn" id="sidebar-shopnavn">—</span>
        <button class="sidebar-logud" onclick="vixxLogud()">↩ Log ud</button>
      </div>
      <nav class="sidebar-nav">
        ${items.map(item => {
          if (item.section) return `<div class="nav-section-label">${item.section}</div>`;
          const aktiv = item.id === activePage ? ' aktiv' : '';
          const pro = item.pro ? `<span class="nav-pro-badge">Pro</span>` : '';
          return `<a class="nav-item${aktiv}" href="${item.href}"><span class="nav-ikon">${item.ikon}</span> ${item.label}${pro}</a>`;
        }).join('')}
      </nav>
    </aside>`;

  const container = document.getElementById('sidebar-container');
  if (container) container.innerHTML = html;
}

function vixxCheckAuth() {
  const token = localStorage.getItem('token');
  if (!token) { window.location.href = 'login.html'; return null; }
  return token;
}

function vixxLogud() {
  localStorage.removeItem('token');
  window.location.href = 'login.html';
}
