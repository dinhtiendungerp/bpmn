import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
const viewerTemplate=readFileSync(new URL('../public/vendor/archify/template.html',import.meta.url),'utf8');
import {createModdle} from '../lib/bpmn/moddle.mjs';
import {templates} from '../lib/bpmn/templates.mjs';
import {flowNodes,collectRelated,findPath} from '../lib/bpmn/graph.mjs';
import {lintDiagram} from '../lib/bpmn/lint.mjs';
import {documentId,freshDocument,readWorkspace,writeWorkspace,withRevision} from '../lib/bpmn/storage.mjs';
import {buildStandaloneHTML} from '../lib/bpmn/standalone.mjs';

test('Document IDs work in HTTP contexts without crypto.randomUUID',()=>{
  const httpCrypto={getRandomValues:bytes=>crypto.getRandomValues(bytes)};
  const ids=Array.from({length:100},()=>documentId(httpCrypto));
  assert.equal(new Set(ids).size,100);
  assert(ids.every(id=>/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)));
});

test('Production engine registry preserves Camunda template attributes without collisions',async()=>{
  const xml=templates[0].xml.replace('<bpmn:definitions ', '<bpmn:definitions xmlns:camunda="http://camunda.org/schema/1.0/bpmn" ').replace('id="Task_Request" name=', 'id="Task_Request" camunda:modelerTemplate="purchase-request" camunda:modelerTemplateVersion="2" name=');
  const moddle=createModdle();const parsed=await moddle.fromXML(xml);
  assert.deepEqual(parsed.warnings,[]);
  const task=flowNodes(parsed.rootElement).find(n=>n.id==='Task_Request');
  assert.equal(task.get('camunda:modelerTemplate'),'purchase-request');
  const saved=await moddle.toXML(parsed.rootElement);
  const restored=await createModdle().fromXML(saved.xml);
  assert.deepEqual(restored.warnings,[]);
  assert.equal(flowNodes(restored.rootElement).find(n=>n.id==='Task_Request').get('camunda:modelerTemplateVersion'),2);
});

for(const template of templates)test(`BPMN round trip preserves references and DI: ${template.id}`,async()=>{
  const moddle=createModdle();const first=await moddle.fromXML(template.xml);
  assert.deepEqual(first.warnings,[]);
  const {xml}=await moddle.toXML(first.rootElement,{format:true});const second=await moddle.fromXML(xml);
  assert.deepEqual(second.warnings,[]);
  const signature=definitions=>({
    flows:flowNodes(definitions).filter(n=>n.$type==='bpmn:SequenceFlow').map(f=>[f.id,f.sourceRef.id,f.targetRef.id,f.conditionExpression?.body]),
    lanes:definitions.rootElements.filter(r=>r.$type==='bpmn:Process').flatMap(r=>(r.laneSets||[]).flatMap(l=>l.lanes.map(l=>[l.id,l.flowNodeRef.map(n=>n.id)]))),
    di:definitions.diagrams.flatMap(d=>d.plane.planeElement.map(e=>[e.bpmnElement.id,e.bounds?[e.bounds.x,e.bounds.y,e.bounds.width,e.bounds.height]:e.waypoint.map(p=>[p.x,p.y])]))
  });
  assert.deepEqual(signature(first.rootElement),signature(second.rootElement));
  if(template.id!=='blank')assert.deepEqual(await lintDiagram(second.rootElement),[]);
});

test('Parallel gateway conditions are rejected; exclusive branches need explicit decisions',async()=>{
  const moddle=createModdle();const {rootElement}=await moddle.fromXML(templates.find(t=>t.id==='approval').xml);
  const split=flowNodes(rootElement).find(n=>n.id==='A_Split');
  split.outgoing[0].conditionExpression=moddle.create('bpmn:FormalExpression',{body:'approved'});
  assert((await lintDiagram(rootElement)).some(i=>i.code==='parallel-condition'&&i.severity==='error'));
});
test('Boundary timer retains non-interrupting semantics and ISO duration',async()=>{
  const {rootElement}=await createModdle().fromXML(templates.find(t=>t.id==='timer').xml);
  const boundary=flowNodes(rootElement).find(n=>n.id==='T_Timeout');
  assert.equal(boundary.cancelActivity,false);assert.equal(boundary.attachedToRef.id,'T_Approve');assert.equal(boundary.eventDefinitions[0].timeDuration.body,'PT24H');
});
test('Collaboration uses a message between distinct participants',async()=>{
  const {rootElement}=await createModdle().fromXML(templates.find(t=>t.id==='collaboration').xml);
  const c=rootElement.rootElements.find(r=>r.$type==='bpmn:Collaboration');
  assert.equal(c.participants.length,2);assert.equal(c.messageFlows.length,1);assert.equal(c.messageFlows[0].targetRef.id,c.participants[1].id);
});
test('Directed route search handles cycles and excludes message flows',()=>{
  const a={id:'a',outgoing:[],incoming:[]},b={id:'b',outgoing:[],incoming:[]},c={id:'c',outgoing:[],incoming:[]};
  const connect=(source,target,id,type='bpmn:SequenceFlow')=>{const f={id,source,target,type};source.outgoing.push(f);target.incoming.push(f);};
  connect(a,b,'ab');connect(b,a,'ba');connect(b,c,'msg','bpmn:MessageFlow');
  assert.deepEqual(findPath(a,b),['a','ab','b']);assert.deepEqual(findPath(a,c),[]);
  assert.deepEqual([...collectRelated(a)].sort(),['a','ab','b','ba']);
});
test('Version restore keeps independent snapshots and bounds history',()=>{
  let d=freshDocument('Test','original');
  for(let i=0;i<15;i++)d=withRevision(d,'xml-'+i,'version-'+i);
  assert.equal(d.revisions.length,12);assert.equal(d.revisions[0].xml,'xml-14');assert.equal(d.revisions[11].xml,'xml-3');
  const prior=d;const next=withRevision(d,'new');assert.equal(prior.revisions[0].xml,'xml-14');assert.equal(next.revisions[0].xml,'new');
});
test('Workspace supports Unicode and surfaces quota failure',()=>{
  const values=new Map();const storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
  const d=freshDocument('Phê duyệt mua hàng','<xml/>');writeWorkspace([d],d.id,storage);
  assert.equal(readWorkspace(storage).documents[0].name,d.name);
  assert.throws(()=>writeWorkspace([d],d.id,{setItem(){throw new Error('QuotaExceededError');}}),/QuotaExceeded/);
});
test('Offline HTML embeds Unicode XML safely and uses no remote dependency',()=>{
  const name='Mua hàng </title><script>alert(1)</script>',xml=templates[0].xml;
  const html=buildStandaloneHTML({xml,name,template:viewerTemplate,data:[{id:'Task_Request',name:'Tiếng Việt',doc:'<script>bad</script>',out:[]}],viewer:'/* viewer bundle */'});
  assert(html.includes('&lt;/title&gt;'));assert(!html.includes('<script>alert(1)</script>'));
  assert(!/<script[^>]+src=/.test(html));assert(html.includes('Play guided story'));assert(!html.includes('<script>bad</script>'));
});
