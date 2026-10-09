import html
import json
import re
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime

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


def parse_feed(xml_bytes, feed):
    root = ET.fromstring(xml_bytes)
    ns = {"content": "http://purl.org/rss/1.0/modules/content/"}
    words = feed.get("excerptWords", 0)
    posts = []
    for item in root.findall(".//item")[: feed.get("count", 1)]:
        link = (item.findtext("link") or "").strip()
        post = {
            "title": html.unescape((item.findtext("title") or "").strip()) or "(untitled)",
            "link": link if is_http_url(link) else feed["site"],
            "date": parse_date(item.findtext("pubDate")),
        }
        if words:
            encoded = item.find("content:encoded", ns)
            raw = encoded.text if encoded is not None and encoded.text else item.findtext("description", "")
            post["excerpt"] = make_excerpt(raw, words)
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
