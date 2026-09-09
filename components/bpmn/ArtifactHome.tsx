"use client";
import {useEffect,useState} from 'react';
import BpmnStudio from './Studio';
/** The deliverable opens as an artifact; the editor is an explicit separate mode. */
export default function ArtifactHome(){
 const [edit,setEdit]=useState(false);
 useEffect(()=>setEdit(new URLSearchParams(location.search).get('edit')==='1'),[]);
 if(edit)return <BpmnStudio/>;
 return <iframe title="Yêu cầu mua hàng · BPMN tương tác" src="/diagrams/purchasing.html?present=1" style={{position:'fixed',inset:0,border:0,width:'100%',height:'100dvh'}}/>;
}
