import {buildStandaloneHTML} from './standalone.mjs';
/* eslint-disable @typescript-eslint/no-explicit-any */
export function download(data:string|Blob, filename:string, type='text/plain;charset=utf-8') {
  const blob=typeof data === 'string' ? new Blob([data],{type}) : data;
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),10000);
}
export const fileName = (name:string) => (name.replace(/[\\/:*?"<>|]/g,'-').trim() || 'quy-trinh');

export async function exportPNG(modeler:any,name:string) {
  const {svg}=await modeler.saveSVG();
  const image=new Image(),url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
  try {
    await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('Không thể kết xuất ảnh.'));image.src=url;});
    const scale=Math.min(2,8192/Math.max(image.width,image.height));
    const canvas=document.createElement('canvas');canvas.width=Math.ceil(image.width*scale+64);canvas.height=Math.ceil(image.height*scale+64);
    const ctx=canvas.getContext('2d');if(!ctx) throw new Error('Trình duyệt không hỗ trợ Canvas.');
    ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,32,32,image.width*scale,image.height*scale);
    const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Xuất PNG thất bại.')),'image/png'));
    download(blob,fileName(name)+'.png');
  } finally {URL.revokeObjectURL(url);}
}

export function exportMarkdown(modeler:any,name:string) {
  const entries=modeler.get('elementRegistry').getAll().filter((e:any)=>e.type!=='label'&&e.businessObject?.$instanceOf('bpmn:FlowNode'));
  const lines=[`# ${name}`,'','Tài liệu quy trình xuất từ BPMN Studio.',''];
  entries.forEach((e:any,i:number)=>{const bo=e.businessObject;lines.push(`## ${i+1}. ${(bo.name||e.id).replace(/\n/g,' ')}`,'',`- Mã: \`${e.id}\``,`- Loại: ${e.type.replace('bpmn:','')}`,`- Vai trò: ${(bo.lanes||[]).map((l:any)=>l.name||l.id).join(', ') || 'Chưa gán lane'}`,'',...(bo.documentation||[]).map((d:any)=>d.text||''),'');for(const f of bo.outgoing||[])lines.push(`- → ${f.targetRef?.name?.replace(/\n/g,' ')||f.targetRef?.id}${f.name?' — '+f.name:''}${f.conditionExpression?.body?' | Điều kiện: `'+f.conditionExpression.body+'`':''}`);lines.push('');});
  download(lines.join('\n'),fileName(name)+'.md');
}

export async function createInteractiveHTML(modeler:any,name:string) {
  const [response,templateResponse]=await Promise.all([fetch('/vendor/bpmn-viewer.min.js'),fetch('/vendor/archify/template.html')]);
  if(!response.ok||!templateResponse.ok) throw new Error('Không tải được bộ xem để đóng gói.');
  const [viewer,template]=await Promise.all([response.text(),templateResponse.text()]);
  const {xml}=await modeler.saveXML({format:true});
  return buildStandaloneHTML({xml,name,viewer,template,editorURL:'/?edit=1'});
}

export async function exportInteractiveHTML(modeler:any,name:string) {download(await createInteractiveHTML(modeler,name),fileName(name)+'.html','text/html;charset=utf-8');}
