#!/usr/bin/env node
/** Produce an offline interactive BPMN artifact without launching a browser. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {createModdle} from '../lib/bpmn/moddle.mjs';
import {buildStandaloneHTML} from '../lib/bpmn/standalone.mjs';
import {flowNodes} from '../lib/bpmn/graph.mjs';

const [input,output,...args]=process.argv.slice(2);
if(!input||!output){console.error('Usage: node scripts/render-bpmn.mjs input.bpmn output.html [title]');process.exit(1);}
const xml=await readFile(resolve(input),'utf8');
if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw new Error('DTD/entity declarations are not supported.');
const {rootElement,warnings}=await createModdle().fromXML(xml);
if(warnings.length)throw new Error(warnings.map(w=>w.message).join('\n'));
if(!rootElement.diagrams?.length)throw new Error('BPMNDI layout is required.');
if(rootElement.rootElements.some(r=>r.$type==='bpmn:Choreography'||r.conversations?.length))throw new Error('Process and Collaboration only; Choreography and Conversation are not supported.');
const data=flowNodes(rootElement).filter(n=>n.$instanceOf('bpmn:FlowNode')).map(n=>({id:n.id,name:n.name||n.id,type:n.$type.replace('bpmn:',''),doc:(n.documentation||[]).map(d=>d.text).join('\n'),out:(n.outgoing||[]).map(f=>({id:f.targetRef.id,name:f.name||'Tiếp theo'}))}));
const name=args.join(' ')||rootElement.rootElements.find(r=>r.name)?.name||'Quy trình BPMN';
const viewer=(await readFile(new URL('../public/vendor/bpmn-viewer.min.js',import.meta.url),'utf8')).replace(/<\/script/gi,'<\\/script');
const template=await readFile(new URL('../public/vendor/archify/template.html',import.meta.url),'utf8');
await mkdir(dirname(resolve(output)),{recursive:true});
await writeFile(resolve(output),buildStandaloneHTML({xml,name,viewer,template}));
console.log(`Created ${resolve(output)} (${data.length} flow nodes, offline interactive HTML).`);
