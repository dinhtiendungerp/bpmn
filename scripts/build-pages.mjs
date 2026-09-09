#!/usr/bin/env node
/** Build a public static diagram site without the editor server or npm install. */
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {templates} from '../lib/bpmn/templates.mjs';
import {chapters} from '../lib/bpmn/example-chapters.mjs';
import {buildStandaloneHTML} from '../lib/bpmn/standalone.mjs';

const output = new URL('../_site/', import.meta.url);
const [viewer, template] = await Promise.all([
  readFile(new URL('../public/vendor/bpmn-viewer.min.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/vendor/archify/template.html', import.meta.url), 'utf8')
]);
await mkdir(new URL('diagrams/', output), {recursive:true});
for (const sample of templates) {
  const html = buildStandaloneHTML({
    xml:sample.xml, name:sample.name, viewer, template,
    views:chapters[sample.id] || []
  });
  await writeFile(new URL(`diagrams/${sample.id}.html`, output), html);
  await writeFile(new URL(`diagrams/${sample.id}.bpmn`, output), sample.xml);
}
// Relative paths also work at https://owner.github.io/repository/.
await writeFile(new URL('index.html', output), `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>BPMN Studio · Diagram tương tác</title></head>
<body><p><a href="diagrams/purchasing.html?present=1">Mở lưu đồ yêu cầu mua hàng</a></p>
<script>const target=new URL('diagrams/purchasing.html',location.href);target.search=location.search||'?present=1';target.hash=location.hash;location.replace(target.href);</script>
</body></html>`);
await writeFile(new URL('.nojekyll', output), '');
console.log(`Built ${templates.length} shareable BPMN diagrams in _site/.`);
