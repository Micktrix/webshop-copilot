// Cookie-samtykke — GDPR-kompatibel
// GA4 sættes til 'denied' som standard og aktiveres kun ved accept

(function () {
  // Sæt GA4 consent til denied som standard (skal ske FØR gtag config)
  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied'
  });

  const STORAGE_KEY = 'vixx_cookie_consent';
  const valg = localStorage.getItem(STORAGE_KEY);

  // Hvis allerede accepteret — aktivér Analytics og stop
  if (valg === 'accepted') {
    gtag('consent', 'update', { analytics_storage: 'granted' });
    return;
  }

  // Hvis allerede afvist — stop (Analytics forbliver blocked)
  if (valg === 'rejected') return;

  // Ingen valg endnu — vis banner
  const css = `
    #cookie-banner {
      position: fixed; bottom: 0; left: 0; right: 0; z-index: 9999;
      background: #0f172a; color: white; padding: 16px 24px;
      display: flex; align-items: center; justify-content: space-between;
      gap: 16px; flex-wrap: wrap;
      box-shadow: 0 -4px 20px rgba(0,0,0,0.2);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 0.88rem;
    }
    #cookie-banner p { margin: 0; color: rgba(255,255,255,0.75); line-height: 1.5; flex: 1; min-width: 200px; }
    #cookie-banner a { color: #a5b4fc; text-decoration: underline; }
    #cookie-banner-knapper { display: flex; gap: 10px; flex-shrink: 0; }
    #cookie-afvis { background: transparent; border: 1px solid rgba(255,255,255,0.2); color: rgba(255,255,255,0.6); padding: 8px 16px; border-radius: 7px; cursor: pointer; font-size: 0.85rem; }
    #cookie-accepter { background: #6366f1; border: none; color: white; padding: 8px 18px; border-radius: 7px; cursor: pointer; font-size: 0.85rem; font-weight: 600; }
    #cookie-afvis:hover { background: rgba(255,255,255,0.08); }
    #cookie-accepter:hover { background: #4f46e5; }
  `;

  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const banner = document.createElement('div');
  banner.id = 'cookie-banner';
  banner.innerHTML = `
    <p>Vi bruger cookies til at måle trafik via Google Analytics. Læs vores <a href="/privatlivspolitik.html">privatlivspolitik</a>.</p>
    <div id="cookie-banner-knapper">
      <button id="cookie-afvis">Afvis</button>
      <button id="cookie-accepter">Acceptér</button>
    </div>
  `;

  document.addEventListener('DOMContentLoaded', function () {
    document.body.appendChild(banner);

    document.getElementById('cookie-accepter').addEventListener('click', function () {
      localStorage.setItem(STORAGE_KEY, 'accepted');
      gtag('consent', 'update', { analytics_storage: 'granted' });
      banner.remove();
    });

    document.getElementById('cookie-afvis').addEventListener('click', function () {
      localStorage.setItem(STORAGE_KEY, 'rejected');
      banner.remove();
    });
  });
})();
