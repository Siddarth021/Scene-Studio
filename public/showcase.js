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
      if (data.offer?.brandName) {
        navBrand.textContent = data.offer.brandName;
        document.title = `${data.showcase.businessName} — Before/After Studio (${data.offer.brandName})`;
      }
      statusEl.style.display = 'none';
      window.SnapStudioView.renderShowcase(container, {
        showcase: data.showcase,
        offer: data.offer,
        showcaseUrl: window.location.href,
        isPublicShowcase: true
      });
    } catch (err) {
      statusEl.className = 'status-banner error';
      statusEl.textContent = err.message || 'Could not load showcase.';
    }
  }

  init();
})();
