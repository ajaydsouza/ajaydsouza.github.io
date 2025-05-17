// Theme selection and dynamic loading
(async function () {
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
        script.onload = function () {
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

    // Function to load SVG from file with localStorage caching
    async function loadSvgIcon(platform) {
      // Check memory cache first (fastest)
      if (svgCache[platform]) return svgCache[platform];

      // Check localStorage cache second (persists between page loads)
      const localStorageKey = `svg_${platform}`;
      try {
        const cachedSvg = localStorage.getItem(localStorageKey);
        if (cachedSvg) {
          console.log(`Using cached SVG for ${platform} from localStorage`);
          svgCache[platform] = cachedSvg; // Update memory cache
          return cachedSvg;
        }
      } catch (error) {
        console.warn('localStorage access error:', error);
        // Continue if localStorage isn't available
      }

      // Fetch from server if not cached
      try {
        const response = await fetch(`icons/${platform}.svg`);
        if (!response.ok) throw new Error(`SVG not found for ${platform}`);
        const svgText = await response.text();

        // Store in both caches
        svgCache[platform] = svgText;
        try {
          localStorage.setItem(localStorageKey, svgText);
        } catch (error) {
          console.warn('Error storing SVG in localStorage:', error);
          // Continue even if localStorage save fails
        }

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

      // Helper function to create a clean feed URL
      const ensureHttps = (url) => {
        // Ensure the URL starts with https
        return url.replace(/^http:/i, 'https:');
      };

      // Function to create JSONP request as a fallback method
      const fetchWithJsonp = (url) => {
        return new Promise((resolve, reject) => {
          const callbackName = 'jsonpCallback_' + Math.round(100000 * Math.random());
          const script = document.createElement('script');

          window[callbackName] = (data) => {
            delete window[callbackName];
            document.body.removeChild(script);
            resolve(data);
          };

          script.onerror = () => {
            delete window[callbackName];
            document.body.removeChild(script);
            reject(new Error('JSONP request failed'));
          };

          script.src = `${url}&callback=${callbackName}`;
          document.body.appendChild(script);

          setTimeout(() => {
            if (window[callbackName]) {
              delete window[callbackName];
              document.body.removeChild(script);
              reject(new Error('JSONP request timed out'));
            }
          }, 10000); // 10 second timeout
        });
      };

      // If no cache or expired cache, fetch fresh data
      const feedUrl = ensureHttps(config.blog.rssFeed);
      const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`;
      console.log('Fetching main blog post from:', apiUrl);

      // First try with normal fetch
      fetch(apiUrl)
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          if (data.status !== 'ok') {
            throw new Error(`API error! Status: ${data.status}`);
          }

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
          // If fetch fails, try JSONP as fallback
          console.warn('Fetch failed for main blog, trying JSONP fallback:', error);

          fetchWithJsonp(apiUrl)
            .then(data => {
              if (data.status !== 'ok') {
                throw new Error(`API error! Status: ${data.status}`);
              }

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
                  console.log('Blog post data cached successfully via JSONP');
                } catch (error) {
                  console.error('Error caching blog data:', error);
                }
              } else {
                throw new Error('No items in RSS feed');
              }
            })
            .catch(jsonpError => {
              console.error('Both fetch and JSONP failed for main blog:', jsonpError);
              displayFallbackContent();
            });
        });

      // Handle additional feeds
      if (config.blog.additionalFeeds && Array.isArray(config.blog.additionalFeeds) && config.blog.additionalFeeds.length > 0) {
        const additionalFeedsContainer = document.getElementById('additional-feeds-container');
        additionalFeedsContainer.innerHTML = ''; // Clear loading message

        // Function to load and display an additional feed
        const loadAdditionalFeed = async (feedConfig, index) => {
          // Create a unique cache key for this feed
          const feedCacheKey = `additional_feed_cache_${index}`;

          // Create container for this feed
          const feedContainer = document.createElement('div');
          feedContainer.className = 'additional-feed-item';
          feedContainer.innerHTML = `<h3>${feedConfig.title}</h3><div class="feed-content">Loading...</div>`;
          additionalFeedsContainer.appendChild(feedContainer);

          const feedContentElement = feedContainer.querySelector('.feed-content');

          // Function to display feed post
          const displayFeedPost = (post) => {
            feedContentElement.innerHTML = `
              <h4>${post.title}</h4>
              <p>${post.description.split(' ').slice(0, feedConfig.wordCount || 50).join(' ')}...</p>
              <a href="${post.link}" class="read-more" target="_blank" aria-label="Read more about ${post.title}">Read More →</a>
            `;
          };

          // Check localStorage cache first
          try {
            const cachedFeedData = localStorage.getItem(feedCacheKey);
            if (cachedFeedData) {
              const cachedFeed = JSON.parse(cachedFeedData);
              const now = new Date().getTime();

              if (cachedFeed.timestamp && (now - cachedFeed.timestamp < CACHE_EXPIRY) && cachedFeed.post) {
                console.log(`Using cached data for ${feedConfig.title}`);
                displayFeedPost(cachedFeed.post);
                return; // Exit early using cache
              }
            }
          } catch (error) {
            console.warn(`Error accessing cache for ${feedConfig.title}:`, error);
          }

          // Helper function to create a clean feed URL
          const ensureHttps = (url) => {
            // Ensure the URL starts with https
            return url.replace(/^http:/i, 'https:');
          };

          // Function to create JSONP request as a fallback method
          const fetchWithJsonp = (url) => {
            return new Promise((resolve, reject) => {
              // Function name that will be called by the JSONP response
              const callbackName = 'jsonpCallback_' + Math.round(100000 * Math.random());

              // Create script element
              const script = document.createElement('script');

              // Set up the callback function that will be called by the script
              window[callbackName] = (data) => {
                delete window[callbackName];
                document.body.removeChild(script);
                resolve(data);
              };

              // Configure error handling
              script.onerror = () => {
                delete window[callbackName];
                document.body.removeChild(script);
                reject(new Error('JSONP request failed'));
              };

              // Set the src attribute to fetch the data
              script.src = `${url}&callback=${callbackName}`;
              document.body.appendChild(script);

              // Set a timeout for the request
              setTimeout(() => {
                if (window[callbackName]) {
                  delete window[callbackName];
                  document.body.removeChild(script);
                  reject(new Error('JSONP request timed out'));
                }
              }, 10000); // 10 second timeout
            });
          };

          // Fetch fresh data if cache not available or expired
          try {
            // Primary method using fetch
            const feedUrl = ensureHttps(feedConfig.rssFeed);
            const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`;
            console.log(`Fetching ${feedConfig.title} from:`, apiUrl);

            try {
              const response = await fetch(apiUrl);
              if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
              }

              const data = await response.json();

              if (data.status !== 'ok') {
                throw new Error(`API error! Status: ${data.status}`);
              }

              if (data.items && data.items.length > 0) {
                const post = data.items[0];
                displayFeedPost(post);

                // Save to cache
                try {
                  const cacheData = {
                    timestamp: new Date().getTime(),
                    post: post
                  };
                  localStorage.setItem(feedCacheKey, JSON.stringify(cacheData));
                  console.log(`${feedConfig.title} feed data cached successfully`);
                } catch (cacheError) {
                  console.warn(`Error caching ${feedConfig.title} data:`, cacheError);
                }
              } else {
                throw new Error('No items in RSS feed');
              }
            } catch (fetchError) {
              // Fallback to JSONP if fetch fails (likely due to CORS)
              console.warn(`Fetch failed for ${feedConfig.title}, trying JSONP fallback:`, fetchError);

              try {
                const jsonpUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`;
                const jsonpData = await fetchWithJsonp(jsonpUrl);

                if (jsonpData.status !== 'ok') {
                  throw new Error(`API error! Status: ${jsonpData.status}`);
                }

                if (jsonpData.items && jsonpData.items.length > 0) {
                  const post = jsonpData.items[0];
                  displayFeedPost(post);

                  // Save to cache
                  try {
                    const cacheData = {
                      timestamp: new Date().getTime(),
                      post: post
                    };
                    localStorage.setItem(feedCacheKey, JSON.stringify(cacheData));
                    console.log(`${feedConfig.title} feed data cached successfully via JSONP`);
                  } catch (cacheError) {
                    console.warn(`Error caching ${feedConfig.title} data:`, cacheError);
                  }
                } else {
                  throw new Error('No items in RSS feed');
                }
              } catch (jsonpError) {
                // Both fetch and JSONP failed
                throw new Error(`Both fetch and JSONP failed: ${jsonpError.message}`);
              }
            }
          } catch (error) {
            console.error(`Error fetching ${feedConfig.title}:`, error);
            feedContentElement.innerHTML = `<p>Failed to load feed. <a href="${feedConfig.rssFeed}" target="_blank">Visit directly</a> (${error.message})</p>`;
          }
        };

        // Load each additional feed
        config.blog.additionalFeeds.forEach((feedConfig, index) => {
          loadAdditionalFeed(feedConfig, index);
        });
      } else {
        // If no additional feeds, hide the section
        const additionalFeedsSection = document.querySelector('.additional-feeds-section');
        if (additionalFeedsSection) {
          additionalFeedsSection.style.display = 'none';
        }
      }
    } else {
      console.error('Blog RSS feed not provided in config.json');
      document.querySelector('.blog-section').remove();
      // Also hide additional feeds section if main blog is removed
      const additionalFeedsSection = document.querySelector('.additional-feeds-section');
      if (additionalFeedsSection) {
        additionalFeedsSection.remove();
      }
    }

  } catch (error) {
    console.error('Error loading configuration:', error);
  }
}

// Initialize the page
initializeContent();
