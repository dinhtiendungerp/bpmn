/* The upstream dependency-injection services expose open BPMN extension objects. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import BpmnModeler from 'bpmn-js/lib/Modeler';
import { BpmnPropertiesPanelModule, BpmnPropertiesProviderModule, CamundaPlatformPropertiesProviderModule } from 'bpmn-js-properties-panel';
import TokenSimulation from 'bpmn-js-token-simulation';
import Minimap from 'diagram-js-minimap';
import { moddleExtensions } from './extensions.mjs';
import { translate, type PaletteEntry } from './catalog';

export function createModeler(container:HTMLElement, isReadonly:()=>boolean) {
  function ReadonlyRules(this:any, eventBus:any) {
    eventBus.on('commandStack.canExecute',10000,() => isReadonly() ? false : undefined);
  }
  ReadonlyRules.$inject=['eventBus'];
  return new BpmnModeler({container,
    additionalModules:[BpmnPropertiesPanelModule,BpmnPropertiesProviderModule,CamundaPlatformPropertiesProviderModule,TokenSimulation,Minimap,{translate:['value',translate],__init__:['studioReadonly'],studioReadonly:['type',ReadonlyRules]}],
    moddleExtensions,
    textRenderer:{defaultStyle:{fontFamily:'Segoe UI, Arial, sans-serif',fontSize:16},externalStyle:{fontSize:14}},
    bpmnRenderer:{defaultFillColor:'#eef4ff',defaultStrokeColor:'#5477b4',defaultLabelColor:'#263c5b'}
  } as any);
}

export async function preflightXML(modeler:any, xml:string) {
  if(new TextEncoder().encode(xml).byteLength > 8*1024*1024) throw new Error('File vượt 8 MB. Hãy tách quy trình để thao tác ổn định.');
  if(/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('File chứa DTD hoặc entity không được hỗ trợ.');
  const {rootElement,warnings}=await modeler.get('moddle').fromXML(xml);
  if(rootElement.$type !== 'bpmn:Definitions') throw new Error('Đây không phải file BPMN 2.0 Definitions.');
  if((rootElement.rootElements || []).some((e:any) => e.$type === 'bpmn:Choreography')) throw new Error('Choreography chưa được hỗ trợ. Trình biên tập hiện hỗ trợ Process và Collaboration.');
  if((rootElement.rootElements || []).some((e:any) => e.conversations?.length)) throw new Error('Conversation chưa được hỗ trợ. File hiện tại được giữ nguyên.');
  if(!rootElement.diagrams?.length) throw new Error('File chưa có BPMNDI (tọa độ sơ đồ). Hãy xuất lại kèm thông tin bố cục.');
  if(warnings.length) throw new Error('File có thuộc tính hoặc cấu trúc không đọc được; chưa mở để tránh mất dữ liệu. '+warnings[0].message);
  return rootElement;
}

export function startCreate(modeler:any, entry:PaletteEntry, event:MouseEvent|TouchEvent) {
  const elementFactory=modeler.get('elementFactory');
  let shape;
  if(entry.type === 'bpmn:Participant') shape=elementFactory.createParticipantShape();
  else {
    const bo=modeler.get('bpmnFactory').create(entry.type,{...entry.attrs});
    if(entry.event) bo.eventDefinitions=[modeler.get('bpmnFactory').create(entry.event)];
    shape=elementFactory.createShape({type:entry.type,businessObject:bo,...(entry.expanded ? {isExpanded:true,width:350,height:200} : {})});
  }
  modeler.get('create').start(event,shape);
}

export function focusElement(modeler:any, element:any) {
  if(!element) return;
  const canvas=modeler.get('canvas');
  // Drill into the proper BPMN plane before focusing on a nested subprocess.
  let parent=element;
  while(parent.parent) parent=parent.parent;
  if(parent.id !== canvas.getRootElement()?.id) canvas.setRootElement(parent);
  if(element.waypoints) {
    const xs=element.waypoints.map((p:any)=>p.x),ys=element.waypoints.map((p:any)=>p.y);
    element={...element,x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)};
  }
  if(element.x == null) {canvas.zoom('fit-viewport','auto');return;}
  const box=canvas.viewbox(),scale=Math.max(box.scale,0.85);
  const w=box.outer.width/scale,h=box.outer.height/scale;
  canvas.viewbox({x:element.x+(element.width||0)/2-w/2,y:element.y+(element.height||0)/2-h/2,width:w,height:h});
}
