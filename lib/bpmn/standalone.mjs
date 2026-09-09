import {applyTemplate} from '../../vendor/archify/utils.mjs';
import {mountBpmnArtifact} from './artifact-runtime.mjs';
import {bpmnViewerLicense} from './licenses.mjs';
const encode = s => {const bytes=new TextEncoder().encode(s);let binary='';for(const b of bytes)binary+=String.fromCharCode(b);return btoa(binary);};
const json = x => JSON.stringify(x).replaceAll('<','\\u003c').replaceAll('>','\\u003e').replaceAll('&','\\u0026');

/** Uses the actual upstream Archify viewer, with a BPMN semantic SVG adapter. */
export function buildStandaloneHTML({xml,name,viewer,template,views=[],editorURL=''}) {
  if(!template)throw new Error('Thiếu template Archify.');
  let html=applyTemplate(template,{title:name,subtitle:'BPMN 2.0 · Process & Collaboration',svg:'<svg id="bpmn-placeholder" viewBox="0 0 1200 600"><text x="440" y="300" fill="currentColor">Đang mở lưu đồ BPMN…</text></svg>',cards:'',visualPreset:'signal-flow',locale:'en',guidedViews:views});
  // The original runtime initializes once, after the standard BPMN renderer finishes.
  html=html.replace('    var Archify = {};','    window.__bpmnReady.then(function () {\n    var Archify = {};');
  const last=html.lastIndexOf('</script>');
  html=html.slice(0,last)+'\n document.documentElement.setAttribute("data-bpmn-interactive", "true");\n }).catch(function(error){document.getElementById("bpmn-placeholder")?.remove();const panel=document.createElement("p");panel.setAttribute("role","alert");panel.textContent="Không mở được BPMN: "+error.message;document.querySelector(".diagram-container").prepend(panel);console.error(error);});\n'+html.slice(last);
  // Offline means no font/network requirement. Leave upstream source untouched on disk.
  html=html.replace(/  <!-- Async font load:[\s\S]*?<\/noscript>/,'');
  const extraCSS=`<style>
  #bpmn-render-stage{position:fixed;inset:140px 20px 70px;background:var(--bg);z-index:1}.djs-container{position:relative;width:100%;height:100%}.djs-container>svg{width:100%;height:100%}.djs-hit,.djs-outline{fill:none;stroke:none}
  svg[data-bpmn-artifact] [data-bpmn-container] rect{fill:var(--lane-fill)!important;stroke:var(--lane-stroke)!important}svg[data-bpmn-artifact] text{fill:var(--text)}
  .bpmn-file-menu{font:inherit}.bpmn-file-menu summary{list-style:none;cursor:pointer}.bpmn-file-menu[open]>div{position:absolute;right:16px;top:64px;padding:12px;background:var(--bg);border:1px solid var(--panel-border);border-radius:12px;display:grid;gap:8px;z-index:200;min-width:210px}.bpmn-file-menu a,.bpmn-file-menu button{font:inherit;font-size:13px;color:var(--text);text-decoration:none;text-align:left;padding:9px;border:1px solid var(--panel-border);border-radius:6px;background:var(--panel);cursor:pointer}.bpmn-file-menu hr{border:0;border-top:1px solid var(--panel-border)}
  .bjs-powered-by,.bjs-powered-by-lightbox{display:none!important}
  @media(min-width:768px){html[data-present="true"]:not([data-embed="true"]) .header{padding-right:34rem}}
  @media(max-width:520px){html[data-present="true"]:not([data-embed="true"]) .toolbar{left:.5rem;right:.5rem;max-width:calc(100% - 1rem);flex-wrap:wrap;justify-content:flex-end}html[data-present="true"]:not([data-embed="true"]) .header{padding-top:6.5rem}}
  .bpmn-note{font:12px 'Segoe UI',Arial,sans-serif;color:var(--text-muted);margin:8px 0;max-width:540px}.semantic-passport-detail{white-space:pre-line;max-height:160px;overflow:auto}
  @media print{.bpmn-file-menu{display:none}}
  </style>`;
  html=html.replace('</head>',extraCSS+'</head>');
  const toolbar='<details class="bpmn-file-menu toolbar-btn no-print"><summary>BPMN ▾</summary><div><button id="bpmn-download-html">Tải diagram HTML</button><button id="bpmn-download-xml">Tải BPMN XML</button><button id="bpmn-open-file">Mở file BPMN…</button><input id="bpmn-file-input" type="file" accept=".bpmn,.xml" hidden><a id="bpmn-editor" hidden>Chỉnh sửa BPMN</a><hr><small>Viewer: Archify · Ký hiệu: bpmn-js</small></div></details>';
  html=html.replace('<div class="toolbar" role="toolbar" aria-label="Diagram actions">','<div class="toolbar" role="toolbar" aria-label="Diagram actions">'+toolbar);
  const boot=`<div id="bpmn-render-stage" aria-label="Đang dựng BPMN"></div><script>${viewer.replace(/<\/script/gi,'<\\/script')}</script><script>
  const decode=s=>new TextDecoder().decode(Uint8Array.from(atob(s),c=>c.charCodeAt(0)));
  const bpmnXml=decode('${encode(xml)}');
  window.__bpmnReady=(${mountBpmnArtifact.toString()})(bpmnXml,${json(views)});
  function bpmnDownload(body,name,type){const u=URL.createObjectURL(new Blob([body],{type}));const a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),10000);}
  function bpmnPack(source){const bytes=new TextEncoder().encode(source);let bin='';for(const b of bytes)bin+=String.fromCharCode(b);const at=source.lastIndexOf('</body>');return source.slice(0,at)+'<script id="bpmn-original-artifact" type="text/plain">'+btoa(bin)+'</scr'+'ipt>'+source.slice(at);}
  const artifactName=()=>((document.querySelector('h1')?.textContent||${json(name)}).replace(/[\\\\/:*?"<>|]/g,'-').trim()||'quy-trinh');
  document.getElementById('bpmn-download-xml').onclick=()=>bpmnDownload(bpmnXml,artifactName()+'.bpmn','application/xml');
  document.getElementById('bpmn-download-html').onclick=()=>bpmnDownload(bpmnPack(decode(document.getElementById('bpmn-original-artifact').textContent)),artifactName()+'.html','text/html');
  const editorURL=${json(editorURL)};if(editorURL&&/^https?:$/.test(location.protocol)){const a=document.getElementById('bpmn-editor');a.href=editorURL;a.target='_top';a.hidden=false;a.onclick=e=>{try{sessionStorage.setItem('bpmn-studio.artifact-import',JSON.stringify({xml:bpmnXml,name:artifactName()}))}catch(err){e.preventDefault();alert('Không chuyển được quy trình. Hãy tải BPMN XML rồi nhập vào trình biên tập.')}};}
  document.getElementById('bpmn-open-file').onclick=()=>document.getElementById('bpmn-file-input').click();
  document.getElementById('bpmn-file-input').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>8*1024*1024)throw new Error('File vượt 8 MB');const xml=await file.text();if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw new Error('Không hỗ trợ DTD/entity');const original=decode(document.getElementById('bpmn-original-artifact').textContent);const bytes=new TextEncoder().encode(xml);let binary='';for(const b of bytes)binary+=String.fromCharCode(b);const next=original.replace(/const bpmnXml=decode\\('[^']*'\\)/,()=>"const bpmnXml=decode('"+btoa(binary)+"')");const url=URL.createObjectURL(new Blob([bpmnPack(next)],{type:'text/html'}));location.href=url;}catch(err){alert(err.message)}};
  </script>`;
  html=html.replace('  <script>\n    window.__bpmnReady',boot+'\n  <script>\n    window.__bpmnReady');
  // Single nesting level: downloaded files inject this same original source on load.
  html=html.replace('<head>', '<!-- Archify viewer: MIT License. Copyright (c) 2026 tt-a1i (Archify); Copyright (c) 2025 Cocoon AI. Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the Software), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED AS IS, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE. https://github.com/tt-a1i/archify -->\n<head>');
  html=html.replace('<head>','<!-- bpmn-js license\n'+bpmnViewerLicense+'-->\n<head>');
  const original=html;
  const bodyEnd=html.lastIndexOf('</body>');
  html=html.slice(0,bodyEnd)+`<script id="bpmn-original-artifact" type="text/plain">${encode(original)}</script>`+html.slice(bodyEnd);
  return html;
}
