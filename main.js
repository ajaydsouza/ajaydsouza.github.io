// Theme selection and dynamic loading
(async function() {
  const availableThemes = ['bulky', 'kubrik', 'bright', 'dark', 'minimal', 'neon'];
  const params = new URLSearchParams(window.location.search);
  let theme = params.get('theme');
  
  // If no theme in URL, try to get it from config.json
  if (!theme) {
    try {
      const response = await fetch('config.json');
      const config = await response.json();
      theme = config.theme;
    } catch (error) {
      console.error('Error loading config.json:', error);
    }
  }
  
  // Normalize and validate
  if (!theme || !availableThemes.includes(theme)) {
    theme = 'minimal'; // Fallback to minimal if config.json fails or theme is invalid
  }
  
  // Create and append the theme link immediately
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `styles/${theme}.css`;
  link.id = 'theme-css';
  document.head.appendChild(link);

  // Preload other themes in the background
  availableThemes.forEach(otherTheme => {
    if (otherTheme !== theme) {
      const preloadLink = document.createElement('link');
      preloadLink.rel = 'preload';
      preloadLink.href = `styles/${otherTheme}.css`;
      preloadLink.as = 'style';
      document.head.appendChild(preloadLink);
    }
  });
})();

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const response = await fetch('config.json');
    const config = await response.json();
    const profileImage = document.getElementById('gravatar-image');
    if (config.profile && config.profile.gravatarEmail) {
      const cleanEmail = config.profile.gravatarEmail.trim().toLowerCase();
      const gravatarHash = CryptoJS.SHA256(cleanEmail);
      profileImage.src = `https://www.gravatar.com/avatar/${gravatarHash}?s=200`;
      if (config.gravatarHovercard) {
        profileImage.classList.add('hovercard');
        // Dynamically load the hovercards script and initialize
        const script = document.createElement('script');
        script.src = 'https://www.gravatar.com/js/hovercards/hovercards.min.js';
        script.onload = function() {
          if (window.Gravatar && typeof Gravatar.init === 'function') {
            Gravatar.init();
          }
        };
        document.head.appendChild(script);
      } else {
        profileImage.classList.remove('hovercard');
      }
    }
  } catch (error) {
    console.error('Error setting Gravatar image:', error);
  }
});

// Load and apply configuration
async function initializeContent() {
  try {
    const response = await fetch('config.json');
    const config = await response.json();

    // Set page title
    document.title = config.profile.name;

    // Set meta description dynamically
    var metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', config.profile.tagline || config.profile.bio || '');
    }

    // Set profile information
    document.getElementById('profile-name').textContent = config.profile.name;
    document.getElementById('profile-tagline').textContent = config.profile.tagline;
    document.getElementById('bio-text').textContent = config.profile.bio;

    // Generate social icons
    const socialIcons = document.querySelector('.social-icons');
    
    // Cache for loaded SVGs
    const svgCache = {};
    
    // Function to load SVG from file
    async function loadSvgIcon(platform) {
      // Return from cache if available
      if (svgCache[platform]) return svgCache[platform];
      
      try {
        const response = await fetch(`icons/${platform}.svg`);
        if (!response.ok) throw new Error(`SVG not found for ${platform}`);
        const svgText = await response.text();
        svgCache[platform] = svgText;
        return svgText;
      } catch (error) {
        console.error(`Error loading ${platform} icon:`, error);
        // Try to load default if not already trying to load default
        if (platform !== 'default') {
          return loadSvgIcon('default');
        }
        // Fallback if even default fails
        return `<svg class="social-icon" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>`;
      }
    }

    // Create social icons asynchronously
    async function createSocialIcons() {
      const platforms = Object.entries(config.social);
      
      for (const [platform, url] of platforms) {
        if (url) {
          const a = document.createElement('a');
          a.href = url;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.ariaLabel = `Visit ${platform} profile`;
          
          // Load SVG icon asynchronously
          try {
            const iconSvg = await loadSvgIcon(platform);
            a.innerHTML = iconSvg;
          } catch (error) {
            console.error(`Error loading icon for ${platform}:`, error);
            // Use a simple fallback if loading fails
            a.innerHTML = `<span class="social-icon-text">${platform.charAt(0).toUpperCase()}</span>`;
          }
          
          socialIcons.appendChild(a);
        }
      }
    }
    
    // Initialize social icons
    createSocialIcons();

    // Generate link buttons, but skip the Contact Me link if it matches config.contact.url
    const linksGrid = document.querySelector('.links-grid');
    config.links.forEach(link => {
      // Skip if this link is the contact link
      if (config.contact && link.url === config.contact.url) return;
      const a = document.createElement('a');
      a.href = link.url;
      a.className = 'link-button';
      a.textContent = link.title;
      a.ariaLabel = `Visit ${link.title}`;
      linksGrid.appendChild(a);
    });

    // Set support button
    const supportBtn = document.getElementById('support-button');
    supportBtn.href = config.support.url;
    supportBtn.textContent = config.support.buttonText;
    supportBtn.ariaLabel = config.support.buttonText;

    // Set contact button (footer) using config.contact only
    const contactBtn = document.getElementById('contact-button');
    if (config.contact && config.contact.url && config.contact.buttonText) {
      contactBtn.href = config.contact.url;
      contactBtn.textContent = config.contact.buttonText;
      contactBtn.ariaLabel = config.contact.buttonText;
      contactBtn.style.display = '';
    } else {
      contactBtn.style.display = 'none';
    }

    // Load blog post with localStorage caching (24-hour expiration)
    if (config.blog.rssFeed) {
      const CACHE_KEY = 'blog_post_cache';
      const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
      
      // Function to display blog post content
      const displayBlogPost = (post) => {
        document.querySelector('.post-content').innerHTML = `
          <h3>${post.title}</h3>
          <p>${post.description.split(' ').slice(0, config.blog.wordCount).join(' ')}...</p>
          <a href="${post.link}" class="read-more" aria-label="Read more about ${post.title}">Read More →</a>
        `;
      };
      
      // Function to display fallback content
      const displayFallbackContent = () => {
        document.querySelector('.post-content').innerHTML = `
          <p>Visit my blog at <a href="${config.blog.rssFeed.split('/feed')[0]}" aria-label="Visit Ajay D'Souza's blog">${config.blog.rssFeed.split('/feed')[0]}</a></p>
        `;
      };
      
      // Check localStorage for cached blog data
      const cachedData = localStorage.getItem(CACHE_KEY);
      
      if (cachedData) {
        try {
          const cache = JSON.parse(cachedData);
          const now = new Date().getTime();
          
          // Use cache if it's less than 24 hours old
          if (cache.timestamp && (now - cache.timestamp < CACHE_EXPIRY) && cache.post) {
            console.log('Using cached blog post data');
            displayBlogPost(cache.post);
            return; // Exit early, using cached data
          } else {
            console.log('Cache expired, fetching fresh blog post data');
          }
        } catch (error) {
          console.error('Error parsing cached blog data:', error);
        }
      }
      
      // If no cache or expired cache, fetch fresh data
      fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(config.blog.rssFeed)}`)
        .then(response => response.json())
        .then(data => {
          if (data.items && data.items.length > 0) {
            const post = data.items[0];
            displayBlogPost(post);
            
            // Save to localStorage with timestamp
            try {
              const cacheData = {
                timestamp: new Date().getTime(),
                post: post
              };
              localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
              console.log('Blog post data cached successfully');
            } catch (error) {
              console.error('Error caching blog data:', error);
            }
          } else {
            throw new Error('No items in RSS feed');
          }
        })
        .catch(error => {
          console.error('Error fetching blog post:', error);
          displayFallbackContent();
        });
    } else {
      console.error('Blog RSS feed not provided in config.json');
      document.querySelector('.blog-section').remove();
    }

  } catch (error) {
    console.error('Error loading configuration:', error);
  }
}

// Initialize the page
initializeContent();
