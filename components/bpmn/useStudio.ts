"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import {useCallback,useEffect,useRef,useState} from 'react';
import {toast} from 'sonner';
import {templates} from '@/lib/bpmn/templates.mjs';
import {freshDocument,readWorkspace,writeWorkspace,withRevision} from '@/lib/bpmn/storage.mjs';
import {lintDiagram} from '@/lib/bpmn/lint.mjs';
import {collectRelated,findPath,getStoryElements} from '@/lib/bpmn/graph.mjs';
import type {PaletteEntry} from '@/lib/bpmn/catalog';
import {download,fileName,exportPNG,exportMarkdown,exportInteractiveHTML} from '@/lib/bpmn/export';

export type Revision={id:string;label:string;xml:string;createdAt:string};
export type ProcessDocument={id:string;name:string;xml:string;updatedAt:string;revisions:Revision[]};
export type Issue={id:string;severity:string;code:string;message:string};
export function useStudio() {
  const canvasRef=useRef<HTMLDivElement>(null),modeler=useRef<any>(null),api=useRef<any>(null);
  const docsRef=useRef<ProcessDocument[]>([]),activeRef=useRef(''),busy=useRef(false),readonly=useRef(false),timer=useRef<ReturnType<typeof setTimeout>|null>(null),alive=useRef(true);
  const generation=useRef(0),validationGeneration=useRef(0),opening=useRef(false);
  const artifactImported=useRef(false);
  const [documents,setDocuments]=useState<ProcessDocument[]>([]),[activeId,setActiveId]=useState('');
  const [ready,setReady]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[saved,setSaved]=useState('Đang mở…');
  const [elements,setElements]=useState<any[]>([]),[selected,setSelected]=useState<any>(null),[selectionCount,setSelectionCount]=useState(0),[issues,setIssues]=useState<Issue[]>([]);
  const [undo,setUndo]=useState(false),[redo,setRedo]=useState(false),[zoom,setZoom]=useState(100),[simulating,setSimulating]=useState(false),[presenting,setPresenting]=useState(false),[storyIndex,setStoryIndex]=useState(-1),[lens,setLens]=useState('all');
  const [revisionTick,setRevisionTick]=useState(0);

  const persist=useCallback((docs:ProcessDocument[]=docsRef.current,id=activeRef.current)=>{
    docsRef.current=docs;setDocuments(docs);
    try{writeWorkspace(docs,id);setSaved('Đã lưu trên máy');return true;}
    catch{setSaved('Chưa lưu được');toast.error('Bộ nhớ trình duyệt không khả dụng hoặc đã đầy. Hãy tải file BPMN để giữ thay đổi.',{id:'storage-error'});return false;}
  },[]);
  const flush=useCallback(async()=>{
    if(!modeler.current || busy.current || !activeRef.current)return;
    if(timer.current)clearTimeout(timer.current);timer.current=null;
    const id=activeRef.current,version=++generation.current;
    const {xml}=await modeler.current.saveXML({format:true});
    if(!alive.current||version!==generation.current||id!==activeRef.current)return;
    const docs=docsRef.current.map(d=>d.id===id?{...d,xml,updatedAt:new Date().toISOString()}:d);
    persist(docs,id);return xml;
  },[persist]);
  const refresh=useCallback(()=>{
    const m=modeler.current;if(!m||!m.getDefinitions())return;
    const list=m.get('elementRegistry').getAll().filter((e:any)=>e.type!=='label');
    setElements([...list]);setRevisionTick(x=>x+1);
    setUndo(m.get('commandStack').canUndo());setRedo(m.get('commandStack').canRedo());
    const request=++validationGeneration.current;
    lintDiagram(m.getDefinitions()).then(result=>{if(alive.current&&request===validationGeneration.current)setIssues(result);}).catch(e=>toast.error('Không kiểm tra được quy trình: '+e.message));
  },[]);
  const clearHighlights=useCallback(()=>{
    const m=modeler.current;if(!m)return;
    const c=m.get('canvas');for(const e of m.get('elementRegistry').getAll())for(const marker of ['studio-dim','studio-focus'])c.removeMarker(e,marker);
    setLens('all');
  },[]);

  useEffect(()=>{
    alive.current=true;let disposed=false;let m:any;let observer:ResizeObserver|undefined;
    const beforeUnload=(e:BeforeUnloadEvent)=>{if(timer.current){e.preventDefault();e.returnValue='';}};
    const init=async()=>{
      try{
        let stored: {documents:ProcessDocument[];activeId:string}|null = null;
        try{stored=readWorkspace();}catch{toast.warning('Không đọc được phiên làm việc đã lưu. Hãy xuất file đang mở để sao lưu.',{duration:8000});}
        const docs=stored?.documents?.length?stored.documents:[freshDocument(templates[0].name,templates[0].xml)];
        const doc=docs.find((d:ProcessDocument)=>d.id===stored?.activeId)||docs[0];
        docsRef.current=docs;activeRef.current=doc.id;setDocuments(docs);setActiveId(doc.id);
        const module=await import('@/lib/bpmn/modeler');if(disposed||!canvasRef.current)return;api.current=module;
        m=module.createModeler(canvasRef.current,()=>readonly.current);modeler.current=m;busy.current=true;
        await module.preflightXML(m,doc.xml);await m.importXML(doc.xml);if(disposed)return;
        m.get('canvas').zoom('fit-viewport','auto');m.get('minimap').open();observer=new ResizeObserver(()=>{if(!disposed)m.get('canvas').resized();});observer.observe(canvasRef.current!);
        m.on('selection.changed',(e:any)=>{setSelected(e.newSelection[0]||null);setSelectionCount(e.newSelection.length);});
        m.on('canvas.viewbox.changed',(e:any)=>setZoom(Math.round(e.viewbox.scale*100)));
        m.on('tokenSimulation.toggleMode',(e:any)=>setSimulating(e.active));
        m.on('commandStack.changed',()=>{
          if(busy.current||disposed)return;
          refresh();setSaved('Đang lưu…');if(timer.current)clearTimeout(timer.current);
          timer.current=setTimeout(()=>{timer.current=null;void flush().catch(e=>{setSaved('Chưa lưu được');toast.error(e.message);});},650);
        });
        busy.current=false;setReady(true);setSaved('Lưu tự động trên máy');refresh();
        setZoom(Math.round(m.get('canvas').zoom()*100));
      }catch(e:any){setError(e.message||'Không khởi tạo được trình biên tập.');setSaved('Không mở được');busy.current=false;}
      finally{if(!disposed)setLoading(false);}
    };
    void init();window.addEventListener('beforeunload',beforeUnload);
    return()=>{alive.current=false;disposed=true;if(timer.current)clearTimeout(timer.current);window.removeEventListener('beforeunload',beforeUnload);observer?.disconnect();m?.destroy();modeler.current=null;};
  },[flush,refresh]);

  const openXML=useCallback(async(xml:string,name:string,id?:string)=>{
    const m=modeler.current;if(!m||busy.current||opening.current)return false;opening.current=true;
    try{await api.current.preflightXML(m,xml);}catch(e:any){opening.current=false;toast.error(e.message);return false;}
    try{await flush();}catch(e:any){opening.current=false;toast.error(e.message);return false;}busy.current=true;setLoading(true);++generation.current;
    const previous=await m.saveXML({format:true});
    try{
      m.get('toggleMode').toggleMode(false);m.get('canvasLock').unlock();readonly.current=false;setPresenting(false);setSimulating(false);setStoryIndex(-1);clearHighlights();
      const result=await m.importXML(xml);
      if(result.warnings?.length)throw new Error('Có phần tử không thể vẽ: '+result.warnings[0].message);
      const doc=id?{...docsRef.current.find(d=>d.id===id)!,name,xml,updatedAt:new Date().toISOString()}:freshDocument(name,xml);
      const docs=id?docsRef.current.map(d=>d.id===id?doc:d):[...docsRef.current,doc];
      activeRef.current=doc.id;setActiveId(doc.id);persist(docs,doc.id);
      m.get('canvas').zoom('fit-viewport','auto');setSelected(null);setSelectionCount(0);refresh();return true;
    }catch(e:any){await m.importXML(previous.xml);m.get('canvas').zoom('fit-viewport','auto');refresh();toast.error('Chưa thay đổi quy trình. '+e.message);return false;}
    finally{opening.current=false;busy.current=false;setLoading(false);}
  },[flush,persist,refresh,clearHighlights]);
  useEffect(()=>{
    if(!ready||loading||artifactImported.current)return;
    artifactImported.current=true;
    try{
      const raw=sessionStorage.getItem('bpmn-studio.artifact-import');
      if(!raw)return;
      const incoming=JSON.parse(raw);
      sessionStorage.removeItem('bpmn-studio.artifact-import');
      if(typeof incoming.xml!=='string'||typeof incoming.name!=='string')return;
      void openXML(incoming.xml,incoming.name);
    }catch{toast.error('Không đọc được quy trình chuyển từ diagram. Hãy nhập file BPMN.');}
  },[ready,loading,openXML]);
  const switchDocument=async(id:string)=>{if(id===activeRef.current)return;await flush();const doc=docsRef.current.find(d=>d.id===id);if(doc)await openXML(doc.xml,doc.name,id);};
  const newFromTemplate=async(id:string)=>{const t=templates.find(t=>t.id===id)!;return openXML(t.xml,t.name);};
  const importFile=async(file:File)=>{if(file.size>8*1024*1024){toast.error('File vượt giới hạn 8 MB.');return;}return openXML(await file.text(),file.name.replace(/\.(bpmn|xml)$/i,''));};
  const rename=(name:string)=>{if(!name.trim())return;persist(docsRef.current.map(d=>d.id===activeRef.current?{...d,name:name.trim(),updatedAt:new Date().toISOString()}:d));};
  const checkpoint=async(label='Mốc phiên bản')=>{const xml=await flush();if(!xml)return;persist(docsRef.current.map(d=>d.id===activeRef.current?withRevision(d,xml,label):d));toast.success('Đã lưu mốc phiên bản.');};
  const restore=async(rev:Revision)=>{await checkpoint('Trước khi khôi phục');const doc=docsRef.current.find(d=>d.id===activeRef.current)!;return openXML(rev.xml,doc.name,doc.id);};
  const applyXML=async(xml:string)=>{await api.current.preflightXML(modeler.current,xml);await checkpoint('Trước khi sửa XML');const doc=docsRef.current.find(d=>d.id===activeRef.current)!;return openXML(xml,doc.name,doc.id);};
  const duplicate=async()=>{const xml=await flush();if(xml)await openXML(xml,(docsRef.current.find(d=>d.id===activeRef.current)?.name||'Quy trình')+' · bản sao');};
  const removeDocument=async(id:string)=>{
    if(id===activeRef.current){const other=docsRef.current.find(d=>d.id!==id);if(other){const ok=await openXML(other.xml,other.name,other.id);if(!ok)return;}else{const ok=await newFromTemplate('blank');if(!ok)return;}}
    persist(docsRef.current.filter(d=>d.id!==id));toast.success('Đã xóa quy trình khỏi máy này.');
  };
  const action=(name:string,options?:any)=>{if(!ready||busy.current)return;try{modeler.current.get('editorActions').trigger(name,options);}catch(e:any){toast.error(e.message||'Không thực hiện được thao tác.');}};
  const create=(entry:PaletteEntry,event:any)=>{if(!ready||readonly.current||simulating||busy.current)return;try{api.current.startCreate(modeler.current,entry,event.nativeEvent||event);}catch(e:any){toast.error(e.message);}};
  const focus=(id:string)=>{const m=modeler.current,e=m?.get('elementRegistry').get(id);if(!e)return;api.current.focusElement(m,e);m.get('selection').select(e);};
  const highlight=(kind:string,id?:string)=>{
    const m=modeler.current;if(!m)return;clearHighlights();if(kind==='all')return;
    const all=m.get('elementRegistry').getAll(),chosen=id?m.get('elementRegistry').get(id):m.get('selection').get()[0];
    let ids:Set<string>;
    if(kind==='upstream'||kind==='downstream'){if(!chosen){toast.info('Chọn một bước để xem các bước liên quan.');return;}ids=collectRelated(chosen,kind==='upstream'?'incoming':'outgoing');}
    else if(kind.startsWith('lane:')){const lane=m.get('elementRegistry').get(kind.slice(5));ids=new Set((lane?.businessObject.flowNodeRef||[]).map((n:any)=>n.id));ids.add(lane?.id);all.filter((e:any)=>e.waypoints&&ids.has(e.source?.id)&&ids.has(e.target?.id)).forEach((e:any)=>ids.add(e.id));}
    else return;
    for(const e of all){if(e.type==='label')continue;const isContainer=e.type==='bpmn:Participant'||e.type==='bpmn:Lane'||e.type==='bpmn:Process'||e.type==='bpmn:Collaboration';if(!isContainer)m.get('canvas').addMarker(e,ids.has(e.id)?'studio-focus':'studio-dim');}
    setLens(kind);
  };
  const route=(from:string,to:string)=>{const m=modeler.current,a=m?.get('elementRegistry').get(from),b=m?.get('elementRegistry').get(to);if(!a||!b){toast.info('Chọn điểm đầu và điểm cuối.');return;}const ids=findPath(a,b);clearHighlights();if(!ids.length){toast.info('Không có đường đi Sequence Flow theo chiều đã chọn.');return;}const set=new Set(ids);for(const e of m.get('elementRegistry').getAll())if(e.businessObject?.$instanceOf('bpmn:FlowNode')||e.type==='bpmn:SequenceFlow')m.get('canvas').addMarker(e,set.has(e.id)?'studio-focus':'studio-dim');focus(from);setLens('route');toast.success('Đã làm nổi bật một đường đi có hướng.');};
  const toggleSimulation=()=>{if(!ready||busy.current)return;clearHighlights();modeler.current.get('canvasLock').unlock();readonly.current=false;setPresenting(false);setStoryIndex(-1);modeler.current.get('toggleMode').toggleMode();};
  const togglePresentation=()=>{if(!ready||busy.current)return;modeler.current.get('toggleMode').toggleMode(false);setSimulating(false);readonly.current=!readonly.current;modeler.current.get('canvasLock')[readonly.current?'lock':'unlock']();setPresenting(readonly.current);setStoryIndex(-1);clearHighlights();setTimeout(()=>modeler.current?.get('canvas').zoom('fit-viewport','auto'),100);};
  const story=(delta:number)=>{const m=modeler.current,steps=getStoryElements(m?.get('elementRegistry').getAll()||[]);if(!steps.length)return;const next=Math.max(0,Math.min(steps.length-1,storyIndex+delta));setStoryIndex(next);focus(steps[next].id);};
  const setColor=(fill:string,stroke:string)=>{if(selected&&!simulating&&!readonly.current)modeler.current.get('modeling').setColor(modeler.current.get('selection').get(),{fill,stroke});};
  const fit=()=>modeler.current?.get('canvas').zoom('fit-viewport','auto');
  const changeZoom=(factor:number)=>{const c=modeler.current?.get('canvas');if(c)c.zoom(Math.max(.15,Math.min(4,c.zoom()*factor)));};
  const exportFile=async(type:string)=>{
    if(!ready)return;
    const m=modeler.current,name=docsRef.current.find(d=>d.id===activeRef.current)?.name||'Quy trình';
    try{await flush();if(type==='bpmn'){const {xml}=await m.saveXML({format:true});download(xml,fileName(name)+'.bpmn','application/xml');}else if(type==='svg'){const {svg}=await m.saveSVG();download(svg,fileName(name)+'.svg','image/svg+xml');}else if(type==='png')await exportPNG(m,name);else if(type==='html')await exportInteractiveHTML(m,name);else if(type==='md')exportMarkdown(m,name);toast.success('Đã tạo file '+type.toUpperCase()+'.');}catch(e:any){toast.error(e.message||'Xuất file thất bại.');}
  };
  const active=documents.find(d=>d.id===activeId);
  return {canvasRef,modeler,documents,active,activeId,ready,loading,error,saved,elements,selected,selectionCount,issues,undo,redo,zoom,simulating,presenting,storyIndex,lens,revisionTick,
    flush,switchDocument,newFromTemplate,importFile,rename,checkpoint,restore,applyXML,duplicate,removeDocument,action,create,focus,highlight,route,toggleSimulation,togglePresentation,story,setColor,fit,changeZoom,exportFile,refresh};
}
export type StudioController=ReturnType<typeof useStudio>;
