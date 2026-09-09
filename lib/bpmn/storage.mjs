export const STORAGE_KEY = 'bpmn-studio.workspace.v1';
// randomUUID is secure-context-only; getRandomValues also works in HTTP previews.
export function documentId(source = crypto) {
  if(source.randomUUID)return source.randomUUID();
  const bytes=source.getRandomValues(new Uint8Array(16));
  bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
export function freshDocument(name, xml) {
  return {id:documentId(),name,xml,updatedAt:new Date().toISOString(),revisions:[]};
}
export function readWorkspace(storage = localStorage) {
  const raw = storage.getItem(STORAGE_KEY);
  if(!raw) return null;
  const data = JSON.parse(raw);
  if(data.version !== 1 || !Array.isArray(data.documents)) throw new Error('Dữ liệu lưu trên máy không đúng định dạng.');
  data.documents = data.documents.filter(d => typeof d.id === 'string' && typeof d.xml === 'string' && typeof d.name === 'string').map(d => ({...d,revisions:Array.isArray(d.revisions) ? d.revisions : []}));
  return data;
}
export function writeWorkspace(documents, activeId, storage = localStorage) {
  storage.setItem(STORAGE_KEY,JSON.stringify({version:1,activeId,documents}));
}
export function withRevision(doc, xml, label) {
  return {...doc,xml,updatedAt:new Date().toISOString(),revisions:[{id:documentId(),label:label || 'Mốc phiên bản',xml,createdAt:new Date().toISOString()},...(doc.revisions || [])].slice(0,12)};
}
