import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import identity from '../src/extension_identity.ts';

const output = new URL('../.output/public/', import.meta.url);
const origin = 'https://keymove.minddevops.eu';
const pages = [
  ['index.html', '/'],
  ['patterns.html', '/patterns'],
  ['getting-started.html', '/getting-started'],
  ['privacy-policy.html', '/privacy-policy'],
];

// og:image:width and height must describe the shipped card (PNG IHDR: width, height at 16, 20).
const socialCardPng = readFileSync(new URL('social-card.png', output));
const socialCard = {
  width: socialCardPng.readUInt32BE(16),
  height: socialCardPng.readUInt32BE(20),
};

for (const [filename, route] of pages) {
  const html = readFileSync(new URL(filename, output), 'utf8');
  const dom = new JSDOM(html, { url: origin + route });
  const document = dom.window.document;
  assert.equal(document.querySelectorAll('h1').length, 1, `${filename}: one primary heading`);
  assert(
    (document.querySelector('main')?.textContent?.trim().length ?? 0) > 500,
    `${filename}: content must be readable without JavaScript`,
  );
  assert.equal(document.querySelector('link[rel=canonical]')?.getAttribute('href'), origin + route);
  assert(
    document.querySelector('header a[href="./patterns"], header a[href="./"]'),
    `${filename}: static navigation must be present`,
  );
  assert(document.querySelector('footer a[href="./privacy-policy"]'));
  assert.equal(
    document.querySelector('footer a[href^="mailto:"]')?.getAttribute('href'),
    identity.contactUrl,
    `${filename}: footer contact link`,
  );
  assert(!html.includes('/@fs/'), `${filename}: no development asset paths`);
  assert(!document.querySelector('meta[name=robots][content*=noindex]'));
  // Link previews (LinkedIn, Slack, X) on every public page.
  const meta = name =>
    document.querySelector(`meta[property="${name}"], meta[name="${name}"]`)?.content;
  assert.equal(meta('og:type'), 'website', `${filename}: og:type`);
  assert.equal(meta('og:site_name'), 'KeyMove', `${filename}: og:site_name`);
  assert.equal(meta('og:url'), origin + route, `${filename}: og:url matches the canonical`);
  assert.equal(meta('og:title'), document.title, `${filename}: og:title`);
  assert.equal(meta('og:description'), meta('description'), `${filename}: og:description`);
  assert.equal(meta('og:image'), origin + '/social-card.png', `${filename}: og:image`);
  assert.equal(meta('og:image:width'), String(socialCard.width), `${filename}: og:image:width`);
  assert.equal(meta('og:image:height'), String(socialCard.height), `${filename}: og:image:height`);
  assert(meta('og:image:alt'), `${filename}: og:image:alt`);
  assert.equal(meta('twitter:card'), 'summary_large_image', `${filename}: twitter:card`);
  assert(document.querySelector('meta[name=description]')?.content);
  for (const link of document.querySelectorAll('a[href]')) {
    const url = new URL(link.getAttribute('href'), origin + route);
    if (url.origin !== origin) continue;
    const target = pages.find(([, path]) => path === url.pathname);
    if (!target) continue;
    const targetDom = new JSDOM(readFileSync(new URL(target[0], output), 'utf8'));
    if (url.hash)
      assert(
        targetDom.window.document.getElementById(decodeURIComponent(url.hash.slice(1))),
        `${filename}: broken anchor ${link.getAttribute('href')}`,
      );
    targetDom.window.close();
  }
  for (const element of document.querySelectorAll('[src], [poster], link[href]')) {
    const source =
      element.getAttribute('src') ?? element.getAttribute('poster') ?? element.getAttribute('href');
    if (!source || source.startsWith('data:')) continue;
    const url = new URL(source, origin + route);
    if (url.origin !== origin || element.getAttribute('rel') === 'canonical') continue;
    assert(
      existsSync(fileURLToPath(new URL('.' + url.pathname, output))),
      `${filename}: missing asset ${source}`,
    );
  }
  if (route === '/patterns') assert.equal(document.querySelectorAll('.pattern-card').length, 19);
  if (route === '/') {
    const structuredData = document.querySelectorAll('script[type="application/ld+json"]');
    assert.equal(structuredData.length, 1);
    assert.deepEqual(JSON.parse(structuredData[0].textContent), {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'KeyMove',
      url: origin + '/',
    });
    assert(document.querySelector('a[href="./getting-started"]'));
    assert(
      !document.querySelector('.walkthrough video')?.getAttribute('src'),
      'Video download must wait for interaction',
    );
    assert(
      !document.querySelector('iframe')?.getAttribute('src'),
      'Demo must wait for the parent listener',
    );
  }
  dom.window.close();
}

// Unknown addresses get 404.html with status 404; it must not be indexed. It is served at any
// depth, so its links and assets must be absolute.
assert.match(
  readFileSync(new URL('../website/wrangler.jsonc', import.meta.url), 'utf8'),
  /"not_found_handling":\s*"404-page"/,
  'wrangler.jsonc must serve 404.html for unknown addresses',
);
{
  const html = readFileSync(new URL('404.html', output), 'utf8');
  const dom = new JSDOM(html, { url: origin + '/missing/page' });
  const document = dom.window.document;
  assert(document.querySelector('meta[name=robots][content*=noindex]'), '404.html: noindex');
  assert(!document.querySelector('link[rel=canonical]'), '404.html: no canonical');
  assert.equal(document.querySelectorAll('h1').length, 1, '404.html: one primary heading');
  for (const element of document.querySelectorAll('a[href], [src], link[href]')) {
    const reference = element.getAttribute('href') ?? element.getAttribute('src');
    assert(reference?.startsWith('/'), `404.html: absolute reference ${reference}`);
    const { pathname } = new URL(reference, origin);
    assert(
      element.tagName === 'A'
        ? pages.some(([, route]) => route === pathname)
        : existsSync(fileURLToPath(new URL('.' + pathname, output))),
      `404.html: broken reference ${reference}`,
    );
  }
  dom.window.close();
}

const sitemap = new JSDOM(readFileSync(new URL('sitemap.xml', output), 'utf8'), {
  contentType: 'text/xml',
});
assert.deepEqual(
  [...sitemap.window.document.querySelectorAll('loc')].map(node => node.textContent),
  pages.map(([, route]) => origin + route),
);
sitemap.window.close();
assert(
  readFileSync(new URL('robots.txt', output), 'utf8').includes(`Sitemap: ${origin}/sitemap.xml`),
);
assert(readFileSync(new URL('demo.html', output), 'utf8').includes('content="noindex"'));
const license = readFileSync(new URL('LICENSE.txt', output), 'utf8');
const security = readFileSync(new URL('.well-known/security.txt', output), 'utf8');
const expires = security.match(/^Expires: (.+)$/m)?.[1];
assert(expires && Date.parse(expires) > Date.now(), 'Review and renew the security.txt expiry');
assert(security.includes(`Canonical: ${origin}/.well-known/security.txt`));
assert(
  security.includes('Contact: https://github.com/valentindimitrov/keymove/security/advisories/new'),
);
const robots = readFileSync(new URL('robots.txt', output), 'utf8');
assert(
  !/^Disallow:\s*\/(?:\s|assets|demo)/m.test(robots),
  'Keep assets and demo crawlable for rendering and noindex',
);
assert(existsSync(new URL('_headers', output)), 'Cloudflare response headers must ship');
assert(
  license.includes('The DM Sans Project Authors') &&
    license.includes('The Manrope Project Authors'),
);
console.log(
  'Static content, metadata, link previews, the 404 page, structured data, internal anchors, assets, sitemap, robots, demo exclusion, and font licenses verified.',
);
