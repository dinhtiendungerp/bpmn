import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {buildStandaloneHTML} from '../lib/bpmn/standalone.mjs';
import {templates} from '../lib/bpmn/templates.mjs';
const template=readFileSync(new URL('../public/vendor/archify/template.html',import.meta.url),'utf8');
const html=buildStandaloneHTML({xml:templates[0].xml,name:'Mua hàng',viewer:'/* test viewer */',template});

test('All scripts in exported BPMN/Archify HTML parse, including the download bootstrap',()=>{
 const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
 assert.equal(scripts.length,4);
 for(const script of scripts)new vm.Script(script[1]);
});
test('Downloaded artifact packs exactly one reusable original, with unchanged Unicode BPMN',()=>{
 const payload=html.match(/<script id="bpmn-original-artifact" type="text\/plain">([^<]+)<\/script>/)?.[1];assert(payload);
 const original=Buffer.from(payload,'base64').toString('utf8');
 assert(!/<script id="bpmn-original-artifact" type="text\/plain">[A-Za-z0-9+/=]+<\/script>/.test(original));
 const xml=Buffer.from(original.match(/const bpmnXml=decode\('([^']+)'\)/)[1],'base64').toString('utf8');
 assert.equal(xml,templates[0].xml);
});
test('The actual upstream interaction runtime is preserved after BPMN initializes',()=>{
 const source=template.slice(template.indexOf('    var Archify = {};'),template.lastIndexOf('</script>')).trim();
 assert(html.includes(source));
 for(const label of ['Trace a directed route','Open semantic radar','Open semantic lens','Play guided story'])assert(html.includes(label));
 assert(html.includes('window.__bpmnReady.then'));
 assert(!html.includes('fonts.googleapis.com'));
});
