import fs from 'node:fs';

const publicDir = new URL('../public/', import.meta.url);

// A snapshot carries map metadata and the existing client, not repository source.
// Escape '<' in the data block so untrusted descriptions cannot close its script.
export function snapshotHtml(map) {
  const template = fs.readFileSync(new URL('index.html', publicDir), 'utf8');
  const css = fs.readFileSync(new URL('styles.css', publicDir), 'utf8');
  const client = fs.readFileSync(new URL('app.js', publicDir), 'utf8');
  const data = JSON.stringify(map).replaceAll('<', '\\u003c');
  return template
    .replace('<link rel="stylesheet" href="./styles.css" />', () => `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>`)
    .replace('<script type="module" src="./app.js"></script>', () => `<script id="buildmapSnapshot" type="application/json">${data}</script>\n<script type="module">${client.replace(/<\/script/gi, '<\\/script')}</script>`);
}
