#!/usr/bin/env python3
"""SR 4 stap 8 — genereert de US-tekstfixtures (<pagina>.txt) uit de SR 2a-HTML van de gemeten storefront.
Bron: var/storefront-referentie/sr2a-2026-09-03/html/<pagina>__1440__en__anoniem.html (lokaal/NAS, niet in git).
Gebruik (vanuit de repo-root): python3 apps/web/tests/fixtures/us-tekst/genereer.py [pagina …]  (zonder argument: alle 5)
Regels (spiegel van statische-paginas.spec.ts): tekstknopen letterlijk aaneen (geen spatie bij inline-taggrenzen), een
regeleinde bij blok-tags, daarna whitespace samengevouwen tot één spatie; script/style/noscript/svg/select en Weglot-
subbomen overgeslagen; per pagina start-/eindmarker en uit te sluiten subbomen (coupon: het inwisselformulier)."""
import os, re, sys
from html.parser import HTMLParser

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', '..'))
H = os.path.join(ROOT, 'var/storefront-referentie/sr2a-2026-09-03/html/%s__1440__en__anoniem.html')
PAGES = {
    'about-us': ('page-about-us', '<main', '<footer class="theme:footer"', []),
    'dawah': ('page-dawah', '<main', '<footer class="theme:footer"', []),
    'downloads': ('page-downloads', '<main', '<footer class="theme:footer"', []),
    'coupon': ('page-coupon', '<main', '<footer class="theme:footer"', ['coupon-container']),
    'qa': ('page-qa', 'faq-block-1', '<footer', []),
}
SKIP = {'script', 'style', 'noscript', 'svg', 'select'}
VOID = {'br', 'img', 'input', 'hr', 'meta', 'link', 'source', 'wbr', 'area', 'col', 'embed', 'param', 'track'}
BLOCK = {'p', 'div', 'li', 'ul', 'ol', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'br', 'section', 'figure', 'details', 'summary', 'button', 'label', 'form', 'main', 'article', 'header', 'footer', 'nav', 'tr', 'td', 'th', 'blockquote'}


class P(HTMLParser):
    def __init__(self, excl):
        super().__init__(convert_charrefs=True)
        self.skip = []
        self.out = []
        self.depth = 0
        self.excl = excl

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        cls = (a.get('class') or '') + ' ' + (a.get('id') or '')
        if tag in BLOCK:
            self.out.append('\n')
        if tag in VOID:
            return
        self.depth += 1
        if tag in SKIP or 'weglot' in cls or 'wg-' in cls or any(e in cls for e in self.excl):
            self.skip.append(self.depth)

    def handle_startendtag(self, tag, attrs):
        if tag in BLOCK:
            self.out.append('\n')

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        if tag in BLOCK:
            self.out.append('\n')
        if self.skip and self.skip[-1] == self.depth:
            self.skip.pop()
        self.depth -= 1

    def handle_data(self, d):
        if not self.skip:
            self.out.append(d)


def tekst(slug):
    f, start, end, excl = PAGES[slug]
    h = open(H % f, encoding='utf8').read()
    i = h.find(start)
    i = h.rfind('<', 0, i + 1) if start.startswith('<') else h.rfind('<section', 0, i)
    j = h.find(end, i)
    p = P(excl)
    p.feed(h[i:j])
    return re.sub(r'\s+', ' ', ''.join(p.out)).strip()


if __name__ == '__main__':
    for slug in sys.argv[1:] or PAGES:
        out = os.path.join(os.path.dirname(__file__), f'{slug}.txt')
        t = tekst(slug)
        open(out, 'w', encoding='utf8').write(t + '\n')
        print(slug, len(t.split()), 'woorden →', os.path.relpath(out, ROOT))
