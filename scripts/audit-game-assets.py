"""Audit every catalog entry and its initial assets; this is not a gameplay test.

Run from the repository root. Saves an explicit per-game JSON report outside public/.
No game JavaScript is executed, and saves/accounts are never opened.
"""
import concurrent.futures
import json
from html.parser import HTMLParser
from pathlib import Path
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
ORIGIN = 'https://games.neon-arcade.invalid'
IGNORED = re.compile(r'googletagmanager|google-analytics|cloudflareinsights|doubleclick|googlesyndication|connect\.facebook|cdn\.r9x\.in|/st39/sdk@', re.I)


class Assets(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = set()
        self.base = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'base' and self.base is None:
            self.base = attrs.get('href')
        value = None
        if tag in ('script', 'iframe', 'embed'):
            value = attrs.get('src')
        elif tag == 'object':
            value = attrs.get('data')
        elif tag == 'param' and attrs.get('name', '').lower() == 'movie':
            value = attrs.get('value')
        elif tag == 'link' and 'stylesheet' in attrs.get('rel', '').split():
            value = attrs.get('href')
        if value and not IGNORED.search(value):
            self.urls.add(value)


def check(url):
    parsed = urllib.parse.urlsplit(url)
    if parsed.netloc == 'games.neon-arcade.invalid':
        path = ROOT / 'public' / urllib.parse.unquote(parsed.path).lstrip('/')
        return {'url': url, 'status': 200 if path.is_file() else 404, 'local': True}
    if parsed.scheme not in ('http', 'https'):
        return {'url': url, 'status': None, 'note': 'Embedded data or browser-managed URL'}
    try:
        address = urllib.parse.quote(url, safe=":/%?=&+#@!$'()*+,;[]~")
        request = urllib.request.Request(address, method='HEAD')
        try:
            response = urllib.request.urlopen(request, timeout=15)
        except urllib.error.HTTPError as error:
            if error.code not in (403, 405):
                raise
            response = urllib.request.urlopen(urllib.request.Request(address, headers={'Range': 'bytes=0-0'}), timeout=15)
        with response:
            return {'url': url, 'status': response.status, 'type': response.headers.get('Content-Type', '')}
    except urllib.error.HTTPError as error:
        return {'url': url, 'status': error.code, 'error': str(error)}
    except Exception as error:
        return {'url': url, 'status': 0, 'error': str(error)}


def main():
    catalog = json.loads((ROOT / 'public/catalog.json').read_text(encoding='utf-8'))
    entries, urls = [], set()
    for game in catalog['games']:
        local = game['url'].startswith('/')
        path = ROOT / 'public' / game['url'].lstrip('/')
        record = {'id': game['id'], 'name': game['name'], 'url': game['url'], 'entryExists': path.is_file() if local else None, 'assets': [], 'gameplayVerified': False}
        if not local:
            record['assets'] = [game['url']]
            urls.add(game['url'])
        elif path.is_file():
            parser = Assets()
            parser.feed(path.read_text(encoding='utf-8', errors='replace'))
            base = urllib.parse.urljoin(ORIGIN + game['url'], parser.base or '')
            record['assets'] = sorted({urllib.parse.urljoin(base, value) for value in parser.urls})
            urls.update(record['assets'])
        entries.append(record)
    print(f'Catalog scanned: {len(entries)} games, {len(urls)} unique initial assets', flush=True)
    output = ROOT.parent / 'game-asset-audit-20261019.json'
    previous = json.loads(output.read_text(encoding='utf-8')) if '--reuse-successes' in sys.argv and output.exists() else {}
    results = {asset['url']: {**asset, 'reusedFromPreviousRun': True} for asset in previous.get('assets', []) if asset['status'] is not None and 200 <= asset['status'] < 300 and not asset.get('local') and asset['url'] in urls}
    pending = sorted(urls - results.keys())
    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:
        for index, result in enumerate(pool.map(check, pending), 1):
            results[result['url']] = result
            if index % 100 == 0:
                print(f'Checked {index}/{len(pending)} changed, local or previously failed assets', flush=True)
    for record in entries:
        record['failedAssets'] = [url for url in record['assets'] if results[url]['status'] is not None and not 200 <= results[url]['status'] < 300]
    report = {'date': '2026-10-19', 'scope': 'Catalog entry files and directly referenced scripts, stylesheets, embeds and SWFs. HTTP availability is not proof of gameplay.', 'games': entries, 'assets': list(results.values())}
    output.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')
    affected = [entry for entry in entries if entry['failedAssets'] or entry['entryExists'] is False]
    print(f'Report saved. {len(affected)} games need further investigation; none are automatically marked playable.', flush=True)
    for entry in affected:
        print(ascii(entry['name']), ascii([(results[url]['status'], url) for url in entry['failedAssets']]), flush=True)


if __name__ == '__main__':
    main()
