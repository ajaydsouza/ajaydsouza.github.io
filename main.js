(() => {
  const PRIMARY_FEED = 'blog';
  const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

  const isHttpUrl = (url) => typeof url === 'string' && /^https?:\/\//i.test(url);

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key === 'text') node.textContent = value;
      else node.setAttribute(key, value);
    }
    children.filter(Boolean).forEach((child) => node.append(child));
    return node;
  }

  function postLink(post) {
    const title = typeof post.title === 'string' && post.title.trim() ? post.title : '(untitled)';
    if (!isHttpUrl(post.link)) return el('span', { text: title });
    return el('a', { href: post.link, text: title });
  }

  function postDate(post) {
    const date = new Date(post.date);
    if (!post.date || Number.isNaN(date.getTime())) return null;
    return el('time', { class: 'post-meta', datetime: date.toISOString(), text: dateFormat.format(date) });
  }

  function validPosts(feed) {
    return Array.isArray(feed && feed.posts) ? feed.posts.filter((p) => p && typeof p === 'object') : [];
  }

  function safeSrcset(srcset) {
    if (typeof srcset !== 'string') return '';
    const parts = srcset.split(',').map((s) => s.trim()).filter(Boolean);
    return parts.every((p) => /^https?:\/\/\S+ \d+w$/i.test(p)) ? parts.join(', ') : '';
  }

  function postImage(image) {
    if (!image || !isHttpUrl(image.src)) return null;
    const attrs = { class: 'post-image', src: image.src, alt: typeof image.alt === 'string' ? image.alt : '', loading: 'lazy', decoding: 'async' };
    const srcset = safeSrcset(image.srcset);
    if (srcset) {
      attrs.srcset = srcset;
      attrs.sizes = '(max-width: 680px) calc(100vw - 2rem), 632px';
    }
    if (Number.isInteger(image.width) && Number.isInteger(image.height)) {
      attrs.width = image.width;
      attrs.height = image.height;
    }
    return el('img', attrs);
  }

  function renderPrimary(feed) {
    const card = document.querySelector('.blog-post');
    const container = card && card.querySelector('.post-content');
    const post = validPosts(feed)[0];
    if (!container || !post) return false;
    const excerpt = typeof post.excerpt === 'string' && post.excerpt ? el('p', { class: 'post-excerpt', text: post.excerpt }) : null;
    container.replaceChildren(...[el('h3', {}, postLink(post)), postDate(post), excerpt].filter(Boolean));
    const image = postImage(post.image);
    if (image) {
      image.addEventListener('error', () => image.remove(), { once: true });
      card.prepend(image);
    }
    card.classList.toggle('is-linked', isHttpUrl(post.link));
    return true;
  }

  function renderSecondary(feeds) {
    const container = document.getElementById('additional-feeds-container');
    if (!container) return false;
    const items = feeds
      .map((feed) => {
        const posts = validPosts(feed);
        if (!posts.length) return null;
        return el('div', { class: 'additional-feed-item' },
          el('h3', { text: typeof feed.title === 'string' ? feed.title : '' }),
          el('ul', { class: 'feed-post-list' }, ...posts.map((post) => el('li', {}, postLink(post), postDate(post)))));
      })
      .filter(Boolean);
    if (!items.length) return false;
    container.replaceChildren(...items);
    return true;
  }

  function showFallback(selector) {
    const container = document.querySelector(selector);
    const fallback = container && container.querySelector('noscript');
    if (fallback) container.innerHTML = fallback.textContent;
  }

  async function init() {
    let feeds = [];
    try {
      const signal = typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(8000) : undefined;
      const resp = await fetch('feed-data.json', { cache: 'no-cache', signal });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      if (Array.isArray(data && data.feeds)) feeds = data.feeds.filter((f) => f && typeof f === 'object');
    } catch (error) {
      console.warn('Feed data unavailable:', error);
    }

    if (!renderPrimary(feeds.find((f) => f.key === PRIMARY_FEED))) showFallback('.blog-post .post-content');
    if (!renderSecondary(feeds.filter((f) => f.key !== PRIMARY_FEED))) showFallback('#additional-feeds-container');
    document.querySelectorAll('.skeleton-image').forEach((node) => node.remove());
  }

  init();
})();
