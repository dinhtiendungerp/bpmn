/** BPMN -> Archify semantic SVG bridge. Runs inside the self-contained artifact. */
export async function mountBpmnArtifact(xml, suppliedViews = []) {
  const ns = 'http://www.w3.org/2000/svg';
  const make = (tag, attrs = {}, content) => {
    const el = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, String(value)));
    if (content !== undefined) el.textContent = content;
    return el;
  };
  const kindId = value => value.replace(/([a-z])([A-Z])/g,'$1-$2').toLowerCase();
  const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
  const kinds = {
    StartEvent:['Bắt đầu','frontend'],EndEvent:['Kết thúc','security'],
    IntermediateCatchEvent:['Sự kiện nhận','cloud'],IntermediateThrowEvent:['Sự kiện phát','cloud'],
    BoundaryEvent:['Sự kiện biên','cloud'],UserTask:['Người thực hiện','frontend'],
    ManualTask:['Thủ công','frontend'],ServiceTask:['Tự động / dịch vụ','backend'],
    SendTask:['Gửi thông điệp','messagebus'],ReceiveTask:['Nhận thông điệp','messagebus'],
    ScriptTask:['Script','backend'],BusinessRuleTask:['Quy tắc nghiệp vụ','backend'],
    Task:['Tác vụ','backend'],ExclusiveGateway:['Lựa chọn XOR','cloud'],
    ParallelGateway:['Song song AND','cloud'],InclusiveGateway:['Lựa chọn OR','cloud'],
    EventBasedGateway:['Chờ sự kiện','cloud'],ComplexGateway:['Gateway phức hợp','cloud'],
    SubProcess:['Quy trình con','backend'],CallActivity:['Gọi quy trình','backend'],
    Transaction:['Giao dịch','backend'],Participant:['Bên tham gia','external'],
    DataObjectReference:['Dữ liệu','database'],DataStoreReference:['Kho dữ liệu','database'],
    TextAnnotation:['Ghi chú','external']
  };
  const stage = document.getElementById('bpmn-render-stage');
  // The unmodified bpmn-js viewer renders all Process/Collaboration symbols.
  const renderer = new BpmnJS({ container:stage,
    textRenderer:{defaultStyle:{fontFamily:'Segoe UI, Arial, sans-serif',fontSize:14},externalStyle:{fontSize:14}}
  });
  try {
    await renderer.importXML(xml);
    const registry = renderer.get('elementRegistry');
    const root = renderer.get('canvas').getRootElement();
    const parsedName=renderer.getDefinitions().rootElements.find(e=>e.$type==='bpmn:Process'&&e.name)?.name;
    if(parsedName){document.querySelector('h1').textContent=parsedName;document.title=parsedName+' · BPMN';}
    const visible = registry.getAll().filter(e => {
      if (e.type === 'label' || e === root || e.hidden) return false;
      let top = e; while (top.parent) top = top.parent;
      return top === root;
    });
    const semantic = visible.filter(e => !e.waypoints && (
      e.businessObject?.$instanceOf('bpmn:FlowNode') ||
      ['bpmn:DataObjectReference','bpmn:DataStoreReference','bpmn:TextAnnotation'].includes(e.type) ||
      (e.type === 'bpmn:Participant' && (!e.businessObject.processRef || visible.some(f => f.type === 'bpmn:MessageFlow' && (f.source===e || f.target===e))))
    ));
    const ids = new Set(semantic.map(e=>e.id));
    const relations = visible.filter(e => e.waypoints && ids.has(e.source?.id) && ids.has(e.target?.id));
    const svg = make('svg', {xmlns:ns,role:'img','aria-labelledby':'archify-diagram-title archify-diagram-description','data-animation':'trace','data-preset':'signal-flow','data-bpmn-artifact':'true'});
    svg.append(make('title',{id:'archify-diagram-title'},document.querySelector('h1')?.textContent || 'BPMN'));
    svg.append(make('desc',{id:'archify-diagram-description'},'BPMN 2.0 · Process & Collaboration. Story và PATH để khám phá luồng; không thực thi nghiệp vụ.'));
    const svgDefs = make('defs');
    svg.append(svgDefs);
    const liveSvg = stage.querySelector('.djs-container > svg');
    liveSvg?.querySelectorAll(':scope > defs > *').forEach(def => svgDefs.append(def.cloneNode(true)));
    const labelFor = (parent, e) => {
      const label = e.label;
      if(!label) return;
      const visual = registry.getGraphics(label)?.querySelector('.djs-visual');
      if(!visual) return;
      const g = make('g',{transform:`translate(${label.x} ${label.y})`,'data-bpmn-label':e.id});
      g.append(visual.cloneNode(true)); parent.append(g);
    };
    const visualFor = e => {
      const original = registry.getGraphics(e)?.querySelector('.djs-visual');
      if(!original) return null;
      const g = make('g',e.waypoints?{}:{transform:`translate(${e.x} ${e.y})`});
      // Copy SVG geometry only.
      for(const child of original.children) g.append(child.cloneNode(true));
      // bpmn-js can place marker definitions BEFORE the real connection path.
      // Keep them outside semantic groups so Archify traces the source-to-target
      // geometry, never a tiny arrowhead hidden inside <defs>.
      g.querySelectorAll('defs').forEach(defs=>{
        for(const definition of [...defs.children]) svgDefs.append(definition);
        defs.remove();
      });
      return g;
    };
    const containers = make('g',{'data-bpmn-containers':''});
    visible.filter(e=>!e.waypoints&&!ids.has(e.id)).sort((a,b)=>b.width*b.height-a.width*a.height).forEach(e=>{
      const g=visualFor(e);if(!g)return;
      if(['bpmn:Participant','bpmn:Lane'].includes(e.type)) {
        g.setAttribute('data-graph-role','structural-frame');
        g.setAttribute('data-bpmn-container',e.type);
        g.querySelectorAll('rect').forEach(shape=>{shape.style.fill='var(--lane-fill)';shape.style.stroke='var(--lane-stroke)';});
      }
      containers.append(g);labelFor(containers,e);
    });
    svg.append(containers);
    // One edge record per authored relationship; BPMN default/conditional markers stay intact.
    visible.filter(e=>e.waypoints).forEach((e,index)=>{
      const g=visualFor(e);if(!g)return;
      const flowName=clean(e.businessObject.name)||({'bpmn:SequenceFlow':'Sequence Flow','bpmn:MessageFlow':'Message Flow','bpmn:Association':'Association'}[e.type]||e.type.replace('bpmn:',''));
      const detail=e.businessObject.conditionExpression?.body;
      const edgeLabel=flowName+(e.source.businessObject.default?.id===e.id?' · mặc định':'')+(detail?' · '+clean(detail):'');
      const attrs=ids.has(e.source?.id)&&ids.has(e.target?.id)?{'data-edge-from':e.source.id,'data-edge-to':e.target.id,'data-edge-key':index,'data-edge-id':e.id,'data-edge-label':edgeLabel}:{};
      const path=g.querySelector(':scope > path') || g.querySelector('path');
      if(path){Object.entries(attrs).forEach(([k,v])=>path.setAttribute(k,String(v)));path.setAttribute('data-animate','edge');path.style.setProperty('--step',String(Math.min(index,12)));path.setAttribute('data-composition-points',e.waypoints.map(p=>`${p.x},${p.y}`).join(' '));path.style.stroke='var(--arrow)';}
      g.setAttribute('data-bpmn-edge-type',e.type);svg.append(g);
      if(e.label){const lg=make('g',attrs);lg.setAttribute('data-detail','context');labelFor(lg,e);svg.append(lg);}
    });
    // Flatten semantic groups: Archify camera/overlays use SVG-space getBBox().
    semantic.forEach((e,index)=>{
      const bo=e.businessObject, type=e.type.replace('bpmn:',''), [kindLabel,tone]=kinds[type]||[type,'external'];
      const name=clean(bo.name||bo.text)||e.id;
      const role=(bo.lanes||[]).map(l=>clean(l.name)||l.id).join(' / ');
      const doc=(bo.documentation||[]).map(d=>d.text||'').join('\n');
      const events=(bo.eventDefinitions||[]).map(d=>d.$type.replace('bpmn:','').replace('EventDefinition','')).join(' / ');
      const attrs={id:`node-${e.id}`,'data-node-id':e.id,'data-node-label':name,'data-node-kind':kindId(type),'data-node-sublabel':doc||kindLabel,'data-node-context':role,'data-node-tag':events||kindLabel,'data-bpmn-type':type,tabindex:0,role:'button','aria-label':`Focus ${name}, ${kindLabel}${role?', '+role:''}`,'aria-pressed':'false'};
      const g=make('g',attrs),visual=visualFor(e);if(!visual)return;
      g.append(make('title',{},[name,kindLabel,role,doc].filter(Boolean).join(' · ')));
      visual.setAttribute('data-bpmn-symbol','');
      const main=visual.querySelector('rect,circle,polygon,path');
      const originalFill=main?.style.fill;
      if(main){main.classList.add(`c-${tone}`);main.setAttribute('data-animate','node');main.style.setProperty('--step',String(Math.min(index,12)));main.style.fill=type==='TextAnnotation'||(type==='Participant'&&bo.processRef)?'none':`var(--${tone}-fill)`;main.style.stroke=`var(--${tone}-stroke)`;}
      // Preserve event, gateway, activity markers independently from the body fill.
      visual.querySelectorAll('path,circle,polyline,line,polygon,rect').forEach(shape=>{
        if(shape===main)return;
        if(shape.style.stroke && shape.style.stroke!=='none') shape.style.stroke=(shape.style.stroke===originalFill||/white|255, 255, 255|#fff/i.test(shape.style.stroke))?'var(--bg)':`var(--${tone}-stroke)`;
        if(shape.style.fill && shape.style.fill!=='none' && shape.style.fill!=='transparent') shape.style.fill=(shape.style.fill===originalFill||/white|255, 255, 255|#fff/i.test(shape.style.fill))?'var(--bg)':`var(--${tone}-stroke)`;
      });
      if(e.businessObject.$instanceOf('bpmn:Task')&&e.height>=68){visual.append(make('text',{'data-detail':'fine',x:e.width/2,y:e.height-6,'text-anchor':'middle','font-size':10,class:'t-muted'},type.replace(/([a-z])([A-Z])/g,'$1 $2')));}
      g.append(visual);labelFor(g,e);
      // Expanded subprocess backgrounds must sit below their internal flows.
      if(['SubProcess','Transaction'].includes(type)&&!e.collapsed)svg.insertBefore(g,svg.querySelector('[data-bpmn-edge-type]'));
      else svg.append(g);
    });
    // All native definitions are present now, including those copied from visuals.
    svgDefs.querySelectorAll('marker path, marker circle, marker polyline, marker polygon').forEach(el=>{
      const fill=el.style.fill || el.getAttribute('fill');
      const stroke=el.style.stroke || el.getAttribute('stroke');
      if (fill && fill!=='none') el.style.fill = /white|255, 255, 255|#fff/i.test(fill)?'var(--bg)':'var(--arrow)';
      if (stroke && stroke!=='none') el.style.stroke='var(--arrow)';
    });
    svg.querySelectorAll('text').forEach(text=>{text.style.fill='var(--text)';text.style.fontFamily='Segoe UI, Arial, sans-serif';});
    // Text nodes are label details; essential BPMN shape/marker semantics are never hidden.
    svg.querySelectorAll('[data-bpmn-symbol] text').forEach(text=>text.setAttribute('data-node-label',''));
    const allBounds=visible.filter(e=>!e.waypoints).flatMap(e=>[e,...(e.label?[e.label]:[])]);
    const minX=Math.min(...allBounds.map(e=>e.x),0)-36,minY=Math.min(...allBounds.map(e=>e.y),0)-32;
    const maxX=Math.max(...allBounds.map(e=>e.x+e.width),800)+36,maxY=Math.max(...allBounds.map(e=>e.y+e.height),400);
    const width=maxX-minX, legendY=maxY+60;
    const legend=make('g',{'data-legend':'','data-legend-bridge':''});
    legend.append(make('text',{x:minX+36,y:legendY-24,class:'t-primary','font-size':14},'BPMN · Loại phần tử'));
    let lx=minX+36,ly=legendY;
    [...new Set(semantic.map(e=>e.type.replace('bpmn:','')))].forEach(kind=>{
      const [label,tone]=kinds[kind]||[kind,'external'];const w=label.length*8+64;
      if(lx+w>maxX-24){lx=minX+36;ly+=32;}
      const g=make('g',{'data-legend-semantic-kind':kindId(kind),'data-legend-kind':kindId(kind),'data-legend-label':label,'data-legend-x':lx,'data-legend-baseline':ly,'data-legend-width':w});
      g.append(make('rect',{x:lx,y:ly-11,width:16,height:11,rx:2,class:`c-${tone}`}));g.append(make('text',{x:lx+24,y:ly,class:'t-muted','font-size':13},label));legend.append(g);lx+=w;
    });
    svg.append(legend);svg.setAttribute('viewBox',`${minX} ${minY} ${width} ${ly-minY+55}`);
    svg.setAttribute('width',String(width));svg.setAttribute('height',String(ly-minY+55));
    document.getElementById('bpmn-placeholder').replaceWith(svg);
    // Generate grounded chapters only when no curated chapter file was supplied.
    let views=suppliedViews.filter(v=>v.focus?.length && v.focus.every(id=>ids.has(id)));
    if(!views.length){
      const flows=relations.filter(e=>e.type==='bpmn:SequenceFlow');
      const starts=semantic.filter(e=>e.type==='bpmn:StartEvent');
      const ends=new Set(semantic.filter(e=>e.type==='bpmn:EndEvent').map(e=>e.id));
      const paths=[];
      for(const start of starts){const queue=[[start.id]];let visits=0;while(queue.length&&paths.length<3&&visits++<2000){const path=queue.shift(),tail=path.at(-1);if(ends.has(tail)){paths.push(path);continue;}for(const f of flows.filter(e=>e.source.id===tail)){if(!path.includes(f.target.id))queue.push([...path,f.target.id]);}}}
      views=paths.map((focus,i)=>({id:`path-${i+1}`,label:paths.length===1?'Từ bắt đầu đến kết thúc':`Luồng ${i+1} · ${clean(semantic.find(e=>e.id===focus.at(-1))?.businessObject.name)||'Kết thúc'}`,note:'Khám phá một đường đi theo Sequence Flow. Không thực thi điều kiện hay đồng bộ token.',focus}));
      if(!views.length&&semantic.length)views=[{id:'overview',label:'Các bước trong quy trình',note:'Tổng quan phần tử; thứ tự xem không suy diễn quan hệ thực thi.',focus:semantic.slice(0,40).map(e=>e.id)}];
    }
    document.getElementById('archify-guided-views-data').textContent=JSON.stringify(views);
    document.documentElement.setAttribute('data-bpmn-ready','true');
    return {nodes:semantic.length,edges:relations.length};
  } finally { renderer.destroy();stage.remove(); }
}
