"use client";
import {useEffect,useState} from 'react';
import {createInteractiveHTML} from '@/lib/bpmn/export';
import {templates} from '@/lib/bpmn/templates.mjs';
import type {StudioController} from './useStudio';
export function Explorer({studio:s,open,onClose}:{studio:StudioController;open:boolean;onClose:()=>void}){
 const [html,setHtml]=useState(''),[error,setError]=useState('');
 useEffect(()=>{if(!open||!s.ready||s.loading)return;let cancelled=false;setHtml('');setError('');createInteractiveHTML(s.modeler.current,s.active?.name||'Quy trình').then(value=>{if(!cancelled)setHtml(value)}).catch(e=>{if(!cancelled)setError(e.message)});return()=>{cancelled=true}},[open,s.ready,s.loading,s.activeId,s.active?.name,s.modeler]);
 if(!open)return null;
 return <section className="explore-shell" aria-label="Khám phá quy trình"><nav><strong>BPMN <span>studio / Khám phá</span></strong><select aria-label="Quy trình đã lưu" value={s.activeId||''} disabled={s.loading} onChange={e=>void s.switchDocument(e.target.value)}>{s.documents.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select><select aria-label="Mở quy trình mẫu mới" value="" disabled={!s.ready||s.loading} onChange={e=>void s.newFromTemplate(e.target.value)}><option value="">＋ Mở mẫu bố cục mới</option>{templates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select><button onClick={()=>void s.exportFile('html')} disabled={!html||s.loading}>Xuất HTML tương tác</button><button className="explore-edit" onClick={onClose}>Chỉnh sửa BPMN</button></nav>{s.loading||!html?<div className="explore-loading">{error||'Đang mở quy trình tương tác…'}<button onClick={onClose}>Mở trình biên tập</button></div>:<iframe title="Lưu đồ BPMN tương tác" srcDoc={html} sandbox="allow-scripts allow-downloads allow-popups"/>}</section>
}
