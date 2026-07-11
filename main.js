document.addEventListener('DOMContentLoaded', async () => {
  try {
    const response = await fetch('config.json');
    const config = await response.json();
    const profileImage = document.getElementById('gravatar-image');
    if (config.profile && config.profile.gravatarEmail) {
      const cleanEmail = config.profile.gravatarEmail.trim().toLowerCase();
      const gravatarHash = CryptoJS.SHA256(cleanEmail);
      profileImage.src = `https://www.gravatar.com/avatar/${gravatarHash}?s=160`;
    }
  } catch (error) {
    console.error('Error setting Gravatar image:', error);
  }
});

async function initializeContent() {
  try {
    const response = await fetch('config.json');
    const config = await response.json();

    document.title = config.profile.name;

    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', config.profile.tagline || config.profile.bio || '');
    }

    document.getElementById('profile-name').textContent = config.profile.name;
    document.getElementById('profile-tagline').textContent = config.profile.tagline;
    document.getElementById('bio-text').textContent = config.profile.bio;

    // --- Social icons ---
    const socialIcons = document.querySelector('.social-icons');
    const svgCache = {};

    async function loadSvgIcon(platform) {
      if (svgCache[platform]) return svgCache[platform];
      const localStorageKey = `svg_${platform}`;
      try {
        const cachedSvg = localStorage.getItem(localStorageKey);
        if (cachedSvg) { svgCache[platform] = cachedSvg; return cachedSvg; }
      } catch (e) { /* ignore */ }

      try {
        const resp = await fetch(`icons/${platform}.svg`);
        if (!resp.ok) throw new Error('Not found');
        const svgText = await resp.text();
        svgCache[platform] = svgText;
        try { localStorage.setItem(localStorageKey, svgText); } catch (e) { /* ignore */ }
        return svgText;
      } catch (error) {
        if (platform !== 'default') return loadSvgIcon('default');
        return `<svg class="social-icon" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>`;
      }
    }

    async function createSocialIcons() {
      for (const [platform, url] of Object.entries(config.social)) {
        if (!url) continue;
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.setAttribute('aria-label', `Visit ${platform} profile`);
        try {
          a.innerHTML = await loadSvgIcon(platform);
        } catch (e) {
          a.innerHTML = `<span class="social-icon-text">${platform.charAt(0).toUpperCase()}</span>`;
        }
        socialIcons.appendChild(a);
      }
    }
    createSocialIcons();

    // --- Link cards ---
    const linksGrid = document.querySelector('.links-grid');
    config.links.forEach(link => {
      if (config.contact && link.url === config.contact.url) return;
      const a = document.createElement('a');
      a.href = link.url;
      a.className = 'link-card';
      a.innerHTML = `
        <div class="link-card-title">${link.title}</div>
        ${link.description ? `<div class="link-card-desc">${link.description}</div>` : ''}
      `;
      a.setAttribute('aria-label', `Visit ${link.title}`);
      linksGrid.appendChild(a);
    });

    // --- Footer buttons ---
    const supportBtn = document.getElementById('support-button');
    supportBtn.href = config.support.url;
    supportBtn.textContent = config.support.buttonText;
    supportBtn.setAttribute('aria-label', config.support.buttonText);

    const contactBtn = document.getElementById('contact-button');
    if (config.contact && config.contact.url && config.contact.buttonText) {
      contactBtn.href = config.contact.url;
      contactBtn.textContent = config.contact.buttonText;
      contactBtn.setAttribute('aria-label', config.contact.buttonText);
      contactBtn.style.display = '';
    } else {
      contactBtn.style.display = 'none';
    }

    // --- Blog post ---
    if (config.blog && config.blog.rssFeed) {
      const CACHE_KEY = 'blog_post_cache';
      const CACHE_EXPIRY = 24 * 60 * 60 * 1000;

      const displayBlogPost = (post) => {
        document.querySelector('.post-content').innerHTML = `
          <h3><a href="${post.link}" target="_blank" rel="noopener">${post.title}</a></h3>
          <p class="post-excerpt">${post.description.split(' ').slice(0, config.blog.wordCount || 75).join(' ')}&hellip;</p>
        `;
      };

      const displayFallback = () => {
        document.querySelector('.post-content').innerHTML = `
          <p class="post-excerpt">Visit my blog at <a href="${config.blog.rssFeed.split('/feed')[0]}" style="color:var(--accent-color)">${config.blog.rssFeed.split('/feed')[0]}</a></p>
        `;
      };

      const loadFeeds = async () => {
        try {
          const resp = await fetch('feed-data.json');
          if (!resp.ok) throw new Error('Unavailable');
          return await resp.json();
        } catch (e) { return null; }
      };

      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          const cache = JSON.parse(cached);
          const now = Date.now();
          if (cache.timestamp && (now - cache.timestamp < CACHE_EXPIRY) && cache.post) {
            displayBlogPost(cache.post);
          } else {
            fetchAndDisplay();
          }
        } catch (e) {
          fetchAndDisplay();
        }
      } else {
        fetchAndDisplay();
      }

      async function fetchAndDisplay() {
        const data = await loadFeeds();
        if (data && data.feeds && data.feeds.blog) {
          const post = data.feeds.blog;
          displayBlogPost(post);
          try { localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), post })); } catch (e) { /* ignore */ }
        } else {
          displayFallback();
        }
      }

      // --- Additional feeds ---
      if (config.blog.additionalFeeds && config.blog.additionalFeeds.length > 0) {
        const additionalContainer = document.getElementById('additional-feeds-container');
        additionalContainer.innerHTML = '';

        async function renderAdditionalFeeds() {
          const data = await loadFeeds();
          if (!data || !data.feeds) return;

          const feedKeyMap = {
            'https://webberzone.com/feed/': 'webberzone',
            'https://techtites.com/feed/': 'techtites',
          };

          config.blog.additionalFeeds.forEach((feedConfig) => {
            const feedKey = feedKeyMap[feedConfig.rssFeed];
            if (!feedKey) return;

            const post = data.feeds[feedKey];
            if (!post) return;

            const item = document.createElement('div');
            item.className = 'additional-feed-item';
            item.innerHTML = `
              <h3>${feedConfig.title}</h3>
              <p class="feed-excerpt">${post.title}</p>
              <div class="feed-meta"><a href="${post.link}" target="_blank" rel="noopener">Read more →</a></div>
            `;
            additionalContainer.appendChild(item);
          });

          if (!additionalContainer.children.length) {
            additionalContainer.innerHTML = '<p class="loading-text">No feed updates available.</p>';
          }
        }

        renderAdditionalFeeds();
      } else {
        const additionalSection = document.querySelector('.additional-feeds-section');
        if (additionalSection) additionalSection.style.display = 'none';
      }
    } else {
      document.querySelector('.blog-section').remove();
    }

  } catch (error) {
    console.error('Error loading configuration:', error);
  }
}

initializeContent();
