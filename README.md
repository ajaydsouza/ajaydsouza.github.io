# Ajay D'Souza

## About Me

I'm Ajay D'Souza — a WordPress plugin developer and entrepreneur. I create plugins that help make WordPress websites better, faster, and more efficient. I'm the developer behind popular plugins like Contextual Related Posts and Top 10. I'm passionate about open source software and helping others succeed with WordPress.

## Links

- [My Website](https://ajaydsouza.com/)
- [My Blog](https://ajaydsouza.com/blog/)
- [My Plugins](https://profiles.wordpress.org/ajay/)
- [My GitHub](https://github.com/ajaydsouza/)
- [My LinkedIn](https://linkedin.com/in/ajaydsouza)
- [My X](https://x.com/ajaydsouza)
- [My WordPress](https://profiles.wordpress.org/ajaydsouza/)
- [My Bluesky](https://bsky.app/profile/ajayds.bsky.social)

## Contact Me

You can contact me at [https://ajaydsouza.com/contact](https://ajaydsouza.com/contact).

## Donate

You can donate to me at [https://ajaydsouza.com/donate](https://ajaydsouza.com/donate).

## How the site works

- `index.html` holds the profile, bio, social links and link cards as static HTML. Edit it directly.
- `config.json` lists the RSS feeds. `fetch-feeds.py` reads it and writes `feed-data.json`; the "Fetch RSS feeds" GitHub Action runs it daily and whenever either file changes.
- `main.js` only renders `feed-data.json` into the blog and "Other feeds" sections. Without JavaScript, those sections show plain links instead.
- `styles/ajaydsouza.css` holds the light and dark colour tokens; `styles/core.css` holds the layout.
- `assets/img/og-image.png` is the 1200×630 share image; `assets/img/logos/` holds the link-card logos.
- Feeds with `"image": true` in `config.json` also store the post's featured image (its `og:image`, with the matching `srcset` from the post content).

## License

MIT License

## Privacy Policy

You can find my privacy policy at [https://ajaydsouza.com/privacy](https://ajaydsouza.com/privacy).
