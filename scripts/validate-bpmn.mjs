#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import {createModdle} from '../lib/bpmn/moddle.mjs';
import {lintDiagram} from '../lib/bpmn/lint.mjs';
const files=process.argv.slice(2);
if(!files.length){console.error('Usage: node scripts/validate-bpmn.mjs file.bpmn [file.bpmn...]');process.exit(1);}
for(const file of files){
  try{
    const xml=await readFile(file,'utf8');
    if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw new Error('DTD/entity is unsupported.');
    const {rootElement,warnings}=await createModdle().fromXML(xml);
    const issues=await lintDiagram(rootElement);
    console.log(JSON.stringify({file,parseWarnings:warnings.map(w=>w.message),issues},null,2));
    if(warnings.length||issues.some(i=>i.severity==='error'))process.exitCode=1;
  }catch(e){console.error(file+': '+e.message);process.exitCode=1;}
}
