import hashlib
import re

ASSETS = ["styles/fonts.css", "styles/core.css", "styles/ajaydsouza.css", "main.js"]
PAGES = ["index.html", "404.html"]


def main():
    versions = {a: hashlib.sha1(open(a, "rb").read()).hexdigest()[:8] for a in ASSETS}
    for page in PAGES:
        with open(page, encoding="utf-8") as f:
            text = f.read()
        for asset, version in versions.items():
            pattern = r'(href|src)="(/?)' + re.escape(asset) + r'(\?v=[0-9a-f]+)?"'
            text = re.sub(pattern, lambda m: f'{m.group(1)}="{m.group(2)}{asset}?v={version}"', text)
        with open(page, "w", encoding="utf-8") as f:
            f.write(text)
    for asset, version in versions.items():
        print(f"{asset} -> {version}")


if __name__ == "__main__":
    main()
