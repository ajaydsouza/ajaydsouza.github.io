import json, urllib.request, xml.etree.ElementTree as ET
import re, time, html
from urllib.parse import urlparse

FEEDS = [
    {"key": "blog", "url": "https://ajaydsouza.com/feed/", "alt_url": "https://ajaydsouza.com/"},
    {"key": "webberzone", "url": "https://webberzone.com/feed/", "alt_url": "https://webberzone.com/"},
    {"key": "techtites", "url": "https://techtites.com/feed/", "alt_url": "https://techtites.com/"},
]

USER_AGENT = "ajay-social-feed-fetcher/1.0"
RESULT = {"updated": int(time.time()), "feeds": {}}


def strip_html(text):
    text = re.sub(r"<[^>]+>", "", text or "")
    text = html.unescape(text)
    return text


def clean_description(text):
    text = strip_html(text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"^.*?was first posted on.*$", "", text, flags=re.MULTILINE)
    text = re.sub(r"^.*?Use of this feed is for personal.*$", "", text, flags=re.MULTILINE)
    text = re.sub(r"^.*?the site is guilty of copyright.*$", "", text, flags=re.MULTILINE)
    text = re.sub(r"^.*?you are not reading this article.*$", "", text, flags=re.MULTILINE)
    text = re.sub(r"^.*?was originally posted on.*$", "", text, flags=re.MULTILINE)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def fetch_feed(feed_url):
    req = urllib.request.Request(feed_url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


def parse_feed(xml_bytes, feed_url):
    root = ET.fromstring(xml_bytes)
    ns = {"content": "http://purl.org/rss/1.0/modules/content/"}
    items = root.findall(".//item")
    if not items:
        return None
    item = items[0]
    title = item.findtext("title", "")
    link = item.findtext("link", "")
    desc = item.findtext("description", "")
    encoded = item.find("content:encoded", ns)
    description = encoded.text if encoded is not None and encoded.text else desc
    return {
        "title": title or "(untitled)",
        "link": link or feed_url,
        "description": clean_description(description or ""),
    }


for feed in FEEDS:
    print(f"Fetching {feed['key']}...")
    try:
        xml = fetch_feed(feed["url"])
        post = parse_feed(xml, feed["alt_url"])
        if post:
            RESULT["feeds"][feed["key"]] = post
            print(f"  OK: {post['title'][:60]}")
        else:
            print("  No items found")
    except Exception as e:
        print(f"  Failed: {e}")

with open("feed-data.json", "w", encoding="utf-8") as f:
    json.dump(RESULT, f, indent=2, ensure_ascii=False)

print(f"\nWrote feed-data.json with {len(RESULT['feeds'])} feeds")
