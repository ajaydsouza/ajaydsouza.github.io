import html
import json
import re
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser

CONFIG_PATH = "config.json"
OUTPUT_PATH = "feed-data.json"
USER_AGENT = "ajay-social-feed-fetcher/2.0"

BOILERPLATE = re.compile(
    r"was first posted on|was originally posted on|Use of this feed is for personal"
    r"|the site is guilty of copyright|you are not reading this article",
    re.IGNORECASE,
)


def is_http_url(url):
    return isinstance(url, str) and re.match(r"^https?://", url, re.IGNORECASE) is not None


def strip_html(text):
    text = re.sub(r"<(script|style)\b.*?</\1>", " ", text or "", flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r"</?(p|br|div|li|ul|ol|h[1-6]|blockquote|figure|figcaption|pre|table|tr)\b[^>]*>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", text)
    return html.unescape(text)


def make_excerpt(raw, words):
    lines = [line for line in strip_html(raw).splitlines() if not BOILERPLATE.search(line)]
    tokens = " ".join(lines).split()
    if len(tokens) <= words:
        return " ".join(tokens)
    return " ".join(tokens[:words]).rstrip(",;:.-–—") + "…"


def parse_date(value):
    if not value:
        return None
    try:
        return parsedate_to_datetime(value.strip()).isoformat()
    except (TypeError, ValueError, IndexError):
        return None


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


class TagCollector(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.meta = {}
        self.images = []

    def handle_starttag(self, tag, attrs):
        attrs = {k: v for k, v in attrs if v is not None}
        if tag == "meta" and attrs.get("property", "").startswith("og:image"):
            self.meta.setdefault(attrs["property"], attrs.get("content", ""))
        elif tag == "img":
            self.images.append(attrs)


def collect_tags(markup):
    parser = TagCollector()
    try:
        parser.feed(markup or "")
    except Exception:
        pass
    return parser


def clean_srcset(srcset):
    candidates = []
    for part in (srcset or "").split(","):
        bits = part.split()
        if len(bits) == 2 and is_http_url(bits[0]) and re.fullmatch(r"\d+w", bits[1]):
            candidates.append(f"{bits[0]} {bits[1]}")
    return ", ".join(candidates)


def to_int(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def find_image(post_url, content):
    content_images = [img for img in collect_tags(content).images if is_http_url(img.get("src"))]
    try:
        meta = collect_tags(fetch(post_url).decode("utf-8", "replace")).meta
    except Exception as e:
        print(f"  Could not read {post_url}: {e}")
        meta = {}

    src = meta.get("og:image", "")
    if is_http_url(src):
        stem = re.sub(r"\.\w+$", "", src.rsplit("/", 1)[-1])
        match = next((img for img in content_images if stem in img.get("srcset", "")), {})
        image = {
            "src": src,
            "srcset": clean_srcset(match.get("srcset")),
            "alt": meta.get("og:image:alt", ""),
            "width": to_int(meta.get("og:image:width")),
            "height": to_int(meta.get("og:image:height")),
        }
    elif content_images:
        first = content_images[0]
        image = {
            "src": first["src"],
            "srcset": clean_srcset(first.get("srcset")),
            "alt": first.get("alt", ""),
            "width": to_int(first.get("width")),
            "height": to_int(first.get("height")),
        }
    else:
        return None
    return {k: v for k, v in image.items() if v}


def parse_feed(xml_bytes, feed):
    root = ET.fromstring(xml_bytes)
    ns = {"content": "http://purl.org/rss/1.0/modules/content/"}
    words = feed.get("excerptWords", 0)
    posts = []
    for item in root.findall(".//item")[: feed.get("count", 1)]:
        link = (item.findtext("link") or "").strip()
        encoded = item.find("content:encoded", ns)
        raw = encoded.text if encoded is not None and encoded.text else item.findtext("description", "")
        post = {
            "title": html.unescape((item.findtext("title") or "").strip()) or "(untitled)",
            "link": link if is_http_url(link) else feed["site"],
            "date": parse_date(item.findtext("pubDate")),
        }
        if words:
            post["excerpt"] = make_excerpt(raw, words)
        if feed.get("image") and is_http_url(link):
            image = find_image(link, raw)
            if image:
                post["image"] = image
        posts.append(post)
    return posts


def load_json(path):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return None


def main():
    config = load_json(CONFIG_PATH)
    if not config or not config.get("feeds"):
        sys.exit(f"{CONFIG_PATH} is missing or has no feeds")

    existing = load_json(OUTPUT_PATH) or {}
    previous = {f.get("key"): f for f in existing.get("feeds", []) if isinstance(f, dict)}
    feeds = []

    for feed in config["feeds"]:
        print(f"Fetching {feed['key']}...")
        try:
            posts = parse_feed(fetch(feed["rssFeed"]), feed)
        except Exception as e:
            posts = []
            print(f"  Failed: {e}")
        if not posts:
            # Keep the last good copy so a transient outage doesn't blank the section.
            if feed["key"] in previous:
                print("  Keeping previous data")
                feeds.append(previous[feed["key"]])
            continue
        print(f"  OK: {len(posts)} post(s), first: {posts[0]['title'][:60]}")
        feeds.append({"key": feed["key"], "title": feed["title"], "site": feed["site"], "posts": posts})

    if existing.get("feeds") == feeds:
        print("\nFeed data unchanged; not writing file")
        return

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump({"updated": int(time.time()), "feeds": feeds}, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"\nWrote {OUTPUT_PATH} with {len(feeds)} feeds")


if __name__ == "__main__":
    main()
