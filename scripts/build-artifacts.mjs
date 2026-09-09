import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {templates} from '../lib/bpmn/templates.mjs';
import {buildStandaloneHTML} from '../lib/bpmn/standalone.mjs';
import {chapters} from '../lib/bpmn/example-chapters.mjs';
const viewer=await readFile(new URL('../public/vendor/bpmn-viewer.min.js',import.meta.url),'utf8');
const template=await readFile(new URL('../public/vendor/archify/template.html',import.meta.url),'utf8');
await mkdir(new URL('../public/diagrams/',import.meta.url),{recursive:true});
for(const t of templates){
 await writeFile(new URL(`../examples/bpmn/${t.id}.bpmn`,import.meta.url),t.xml);
 await writeFile(new URL(`../public/diagrams/${t.id}.html`,import.meta.url),buildStandaloneHTML({xml:t.xml,name:t.name,viewer,template,views:chapters[t.id]||[],editorURL:'/?edit=1'}));
}
console.log(`Built ${templates.length} independent BPMN/Archify artifacts.`);
