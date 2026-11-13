(function () {
  const statusEl = document.getElementById('showcaseStatus');
  const container = document.getElementById('showcaseContainer');
  const navBrand = document.getElementById('navBrand');

  const parts = window.location.pathname.split('/').filter(Boolean);
  const showcaseId = parts[parts.length - 1];

  async function init() {
    try {
      const res = await fetch('/api/showcase/' + encodeURIComponent(showcaseId));
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Showcase not found.');

      if (data.offer?.brandName && navBrand) {
        navBrand.textContent = data.offer.brandName;
      }

      const business = data.showcase.businessName || 'Product';
      const product = data.showcase.productName || 'Studio Showcase';
      document.title = `${business} — ${product} | SnapStudio`;

      statusEl.style.display = 'none';

      window.SnapStudioView.renderShowcase(container, {
        showcase: data.showcase,
        offer: data.offer,
        showcaseUrl: window.location.href,
        isPublicShowcase: true
      });
    } catch (err) {
      statusEl.className = 'status-banner error';
      statusEl.innerHTML = `
        <span>⚠️</span>
        <div style="flex:1;">
          <strong>Unable to load showcase:</strong> ${window.SnapStudioView ? window.SnapStudioView.esc(err.message) : err.message}<br/>
          <a href="/" class="btn btn-sm btn-secondary mt-8">← Return to Studio Homepage</a>
        </div>
      `;
      statusEl.style.display = 'flex';
    }
  }

  init();
})();
