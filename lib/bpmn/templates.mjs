/** Authored BPMN examples. Coordinates are intentionally stable for portable BPMNDI. */
export const escapeXml = (value = '') => String(value).replace(/[<>&"']/g, c => ({ '<':'&lt;', '>':'&gt;', '&':'&amp;', '"':'&quot;', "'":'&apos;' })[c]);

function diagram({ id, name, lanes = [], nodes, flows, width = 1100, height = 462, external }) {
  const pool = lanes.length > 0;
  const flowXml = flows.map(f => `<bpmn:sequenceFlow id="${f.id}" sourceRef="${f.from}" targetRef="${f.to}"${f.name ? ` name="${escapeXml(f.name)}"` : ''}>${f.condition ? `<bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">${escapeXml(f.condition)}</bpmn:conditionExpression>` : ''}</bpmn:sequenceFlow>`).join('');
  const nodeXml = nodes.map(n => {
    const incoming = flows.filter(f => f.to === n.id).map(f => `<bpmn:incoming>${f.id}</bpmn:incoming>`).join('');
    const outgoing = flows.filter(f => f.from === n.id).map(f => `<bpmn:outgoing>${f.id}</bpmn:outgoing>`).join('');
    return `<bpmn:${n.type} id="${n.id}" name="${escapeXml(n.name)}"${n.attrs ? ' '+n.attrs : ''}><bpmn:documentation>${escapeXml(n.doc || '')}</bpmn:documentation>${incoming}${outgoing}${n.inner || ''}</bpmn:${n.type}>`;
  }).join('');
  const laneXml = pool ? `<bpmn:laneSet id="${id}_lanes">${lanes.map((name,i) => `<bpmn:lane id="${id}_lane_${i}" name="${escapeXml(name)}">${nodes.filter(n => n.lane === i).map(n => `<bpmn:flowNodeRef>${n.id}</bpmn:flowNodeRef>`).join('')}</bpmn:lane>`).join('')}</bpmn:laneSet>` : '';
  const collaboration = pool ? `<bpmn:collaboration id="${id}_collab"><bpmn:participant id="${id}_pool" name="${escapeXml(name)}" processRef="${id}"/>${external ? `<bpmn:participant id="${id}_external" name="${escapeXml(external.name)}"/><bpmn:messageFlow id="${id}_message" sourceRef="${external.from}" targetRef="${id}_external" name="${escapeXml(external.message)}"/>` : ''}</bpmn:collaboration>` : '';
  const laneHeight = height / (lanes.length || 1);
  const poolDI = pool ? `<bpmndi:BPMNShape id="${id}_pool_di" bpmnElement="${id}_pool" isHorizontal="true" bioc:fill="#ffffff" bioc:stroke="#9aaac1"><dc:Bounds x="70" y="90" width="${width}" height="${height}"/></bpmndi:BPMNShape>${lanes.map((_,i) => `<bpmndi:BPMNShape id="${id}_lane_${i}_di" bpmnElement="${id}_lane_${i}" isHorizontal="true" bioc:fill="${i%2 ? '#f6f9fd':'#ffffff'}" bioc:stroke="#c6d1df"><dc:Bounds x="100" y="${90+i*laneHeight}" width="${width-30}" height="${laneHeight}"/></bpmndi:BPMNShape>`).join('')}` : '';
  const shapes = nodes.map(n => {
    const event = n.type.includes('Event'); const gateway = n.type.includes('Gateway');
    const fill = n.fill || (n.type === 'endEvent' ? '#fff0f0' : event ? '#e4f5ee' : gateway ? '#fff8e6' : '#eef4ff');
    const stroke = n.stroke || (n.type === 'endEvent' ? '#b95560' : event ? '#298273' : gateway ? '#b3812f' : '#5c81c2');
    const w = n.w || (event ? 36 : gateway ? 50 : 126); const h = n.h || (event ? 36 : gateway ? 50 : 74);
    return `<bpmndi:BPMNShape id="${n.id}_di" bpmnElement="${n.id}"${n.expanded ? ' isExpanded="true"' : ''} bioc:fill="${fill}" bioc:stroke="${stroke}"><dc:Bounds x="${n.x}" y="${n.y}" width="${w}" height="${h}"/>${event || gateway ? `<bpmndi:BPMNLabel><dc:Bounds x="${n.label?.[0] ?? n.x+w/2-62}" y="${n.label?.[1] ?? n.y+h+9}" width="124" height="36"/></bpmndi:BPMNLabel>` : ''}</bpmndi:BPMNShape>`;
  }).join('');
  const edges = flows.map(f => `<bpmndi:BPMNEdge id="${f.id}_di" bpmnElement="${f.id}" bioc:stroke="#7e90aa">${f.points.map(([x,y]) => `<di:waypoint x="${x}" y="${y}"/>`).join('')}${f.label ? `<bpmndi:BPMNLabel><dc:Bounds x="${f.label[0]}" y="${f.label[1]}" width="100" height="24"/></bpmndi:BPMNLabel>` : ''}</bpmndi:BPMNEdge>`).join('');
  const externalDI = external ? `<bpmndi:BPMNShape id="${id}_external_di" bpmnElement="${id}_external" isHorizontal="true" bioc:fill="#f2f5fa" bioc:stroke="#9aaac1"><dc:Bounds x="70" y="${height+155}" width="${width}" height="65"/></bpmndi:BPMNShape><bpmndi:BPMNEdge id="${id}_message_di" bpmnElement="${id}_message"><di:waypoint x="${external.x}" y="${external.y}"/><di:waypoint x="${external.x}" y="${height+155}"/></bpmndi:BPMNEdge>` : '';
  return `<?xml version="1.0" encoding="UTF-8"?>\n<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:bioc="http://bpmn.io/schema/bpmn/biocolor/1.0" id="${id}_definitions" targetNamespace="https://bpmn-studio.local/process" exporter="BPMN Studio" exporterVersion="1.0.0">${collaboration}<bpmn:process id="${id}" name="${escapeXml(name)}" isExecutable="false">${laneXml}${nodeXml}${flowXml}</bpmn:process><bpmndi:BPMNDiagram id="${id}_diagram"><bpmndi:BPMNPlane id="${id}_plane" bpmnElement="${pool ? id+'_collab' : id}">${poolDI}${shapes}${edges}${externalDI}</bpmndi:BPMNPlane></bpmndi:BPMNDiagram></bpmn:definitions>`;
}

const purchasing = diagram({ id:'Purchase', name:'Yêu cầu mua hàng', lanes:['Người yêu cầu','Người phê duyệt','Hệ thống ERP'],
  nodes:[
    {id:'Start_Request',type:'startEvent',name:'Phát sinh nhu cầu',label:[140,207],x:172,y:147,lane:0,doc:'Quy trình bắt đầu khi bộ phận có nhu cầu mua hàng.'},
    {id:'Task_Request',type:'userTask',name:'Lập yêu cầu\nmua hàng',x:244,y:128,lane:0,doc:'Người yêu cầu khai báo mặt hàng, số lượng, ngày cần hàng và mục đích. Gửi yêu cầu sau khi kiểm tra thông tin.'},
    {id:'Task_Review',type:'userTask',name:'Kiểm tra &\nphê duyệt',x:433,y:286,lane:1,doc:'Người phê duyệt kiểm tra nhu cầu, hạn mức và ngân sách. Ghi rõ lý do nếu yêu cầu cần bổ sung.'},
    {id:'Gateway_Approved',type:'exclusiveGateway',name:'Được duyệt?',label:[690,355],x:627,y:298,lane:1,attrs:'default="Flow_Revise"',doc:'Chỉ một nhánh được chọn. Nếu approved = true, tạo đơn mua; nhánh mặc định yêu cầu bổ sung.'},
    {id:'Task_Revise',type:'userTask',name:'Bổ sung\nyêu cầu',x:740,y:128,lane:0,doc:'Bổ sung thông tin theo phản hồi, sau đó gửi lại bước phê duyệt.'},
    {id:'Task_PO',type:'serviceTask',name:'Tạo đơn mua\ntrên ERP',x:740,y:436,lane:2,doc:'Điểm tích hợp dự kiến: tạo Purchase Order sau khi yêu cầu được duyệt. Cần cấu hình connector hoặc worker để thực thi thật.'},
    {id:'Task_Notify',type:'sendTask',name:'Gửi thông báo\nkết quả',x:923,y:436,lane:2,doc:'Thông báo số đơn mua cho người yêu cầu. Mô phỏng không gửi email hoặc tạo dữ liệu ERP.'},
    {id:'End_Request',type:'endEvent',name:'Hoàn tất',x:1100,y:455,lane:2,doc:'Yêu cầu mua hàng hoàn tất sau khi thông báo kết quả.'}
  ],flows:[
    {id:'Flow_Start',from:'Start_Request',to:'Task_Request',points:[[208,165],[244,165]]},
    {id:'Flow_Submit',from:'Task_Request',to:'Task_Review',points:[[370,165],[401,165],[401,323],[433,323]],name:'Gửi duyệt',label:[280,218]},
    {id:'Flow_Decide',from:'Task_Review',to:'Gateway_Approved',points:[[559,323],[627,323]]},
    {id:'Flow_Revise',from:'Gateway_Approved',to:'Task_Revise',points:[[652,298],[652,165],[740,165]],name:'Cần bổ sung',label:[660,213]},
    {id:'Flow_Resubmit',from:'Task_Revise',to:'Task_Review',points:[[803,128],[803,105],[496,105],[496,286]],name:'Gửi lại',label:[570,76]},
    {id:'Flow_Approved',from:'Gateway_Approved',to:'Task_PO',points:[[652,348],[652,473],[740,473]],name:'Đồng ý',condition:'approved = true',label:[653,403]},
    {id:'Flow_PO',from:'Task_PO',to:'Task_Notify',points:[[866,473],[923,473]]},
    {id:'Flow_Done',from:'Task_Notify',to:'End_Request',points:[[1049,473],[1100,473]]}
  ]});

const warehouse = diagram({id:'Warehouse', name:'Nhập kho & kiểm tra QC', lanes:['Nhân viên kho','Bộ phận chất lượng','Kế toán kho'],width:1120,
  nodes:[
    {id:'W_Start',type:'startEvent',name:'Hàng đến kho',x:150,y:147,lane:0},
    {id:'W_Receive',type:'manualTask',name:'Nhận hàng &\nghi nhận lô',x:242,y:128,lane:0,doc:'Đối chiếu hàng nhận và chứng từ. Ghi nhận Lot, số lượng và Pallet nếu có.'},
    {id:'W_QC',type:'userTask',name:'Thực hiện QC',x:438,y:282,lane:1,doc:'Kiểm tra chất lượng theo quy định. Tồn kho thương mại chưa được xuất bán trước khi QC đạt.'},
    {id:'W_Result',type:'exclusiveGateway',name:'QC đạt?',x:626,y:294,lane:1,attrs:'default="W_Fail"'},
    {id:'W_Hold',type:'userTask',name:'Cách ly &\nlập phiếu lỗi',x:752,y:282,lane:1},
    {id:'W_Rejected',type:'endEvent',name:'Chờ xử lý lỗi',x:954,y:301,lane:1},
    {id:'W_Putaway',type:'manualTask',name:'Đưa hàng\nvào bin',x:752,y:128,lane:0},
    {id:'W_Post',type:'serviceTask',name:'Cập nhật tồn kho\nkhả dụng',x:933,y:436,lane:2},
    {id:'W_End',type:'endEvent',name:'Hoàn tất',x:1110,y:455,lane:2}
  ],flows:[
    {id:'W_F1',from:'W_Start',to:'W_Receive',points:[[186,165],[242,165]]},
    {id:'W_F2',from:'W_Receive',to:'W_QC',points:[[368,165],[400,165],[400,319],[438,319]]},
    {id:'W_F3',from:'W_QC',to:'W_Result',points:[[564,319],[626,319]]},
    {id:'W_Fail',from:'W_Result',to:'W_Hold',points:[[676,319],[752,319]],name:'Không đạt',label:[678,289]},
    {id:'W_F5',from:'W_Hold',to:'W_Rejected',points:[[878,319],[954,319]]},
    {id:'W_Pass',from:'W_Result',to:'W_Putaway',points:[[651,294],[651,165],[752,165]],name:'Đạt',condition:'qcPassed = true',label:[660,222]},
    {id:'W_F7',from:'W_Putaway',to:'W_Post',points:[[878,165],[900,165],[900,473],[933,473]]},
    {id:'W_F8',from:'W_Post',to:'W_End',points:[[1059,473],[1110,473]]}
  ]});

const approval = diagram({id:'ParallelApproval',name:'Phê duyệt song song',lanes:['Người yêu cầu','Tài chính & quản lý','Hệ thống'],width:1070,
  nodes:[
    {id:'A_Start',type:'startEvent',name:'Gửi đề nghị',x:150,y:147,lane:0},
    {id:'A_Submit',type:'userTask',name:'Chuẩn bị\nhồ sơ chi phí',x:242,y:128,lane:0},
    {id:'A_Split',type:'parallelGateway',name:'Duyệt đồng thời',label:[315,204],x:432,y:140,lane:0},
    {id:'A_Finance',type:'userTask',name:'Tài chính\nkiểm tra',x:570,y:253,lane:1},
    {id:'A_Manager',type:'userTask',name:'Quản lý\nxác nhận',x:570,y:333,w:126,h:60,lane:1},
    {id:'A_Join',type:'parallelGateway',name:'Đủ xác nhận',label:[768,248],x:790,y:294,lane:1},
    {id:'A_Record',type:'serviceTask',name:'Ghi nhận\nphê duyệt',x:884,y:436,lane:2},
    {id:'A_End',type:'endEvent',name:'Hoàn tất',x:1060,y:455,lane:2}
  ],flows:[
    {id:'A_F1',from:'A_Start',to:'A_Submit',points:[[186,165],[242,165]]},
    {id:'A_F2',from:'A_Submit',to:'A_Split',points:[[368,165],[432,165]]},
    {id:'A_F3',from:'A_Split',to:'A_Finance',points:[[482,165],[527,165],[527,290],[570,290]]},
    {id:'A_F4',from:'A_Split',to:'A_Manager',points:[[457,190],[457,363],[570,363]]},
    {id:'A_F5',from:'A_Finance',to:'A_Join',points:[[696,290],[745,290],[745,319],[790,319]]},
    {id:'A_F6',from:'A_Manager',to:'A_Join',points:[[696,363],[815,363],[815,344]]},
    {id:'A_F7',from:'A_Join',to:'A_Record',points:[[840,319],[865,319],[865,473],[884,473]]},
    {id:'A_F8',from:'A_Record',to:'A_End',points:[[1010,473],[1060,473]]}
  ]});

const collaboration = diagram({id:'Supplier',name:'Đặt hàng nhà cung cấp',lanes:['Bộ phận mua hàng','Hệ thống ERP'],height:308,width:940,
  nodes:[
    {id:'C_Start',type:'startEvent',name:'Đơn đã duyệt',x:150,y:147,lane:0},
    {id:'C_Prepare',type:'userTask',name:'Kiểm tra\nđơn mua',x:245,y:128,lane:0},
    {id:'C_Send',type:'sendTask',name:'Gửi đơn\nnhà cung cấp',x:454,y:282,lane:1},
    {id:'C_Archive',type:'serviceTask',name:'Lưu lịch sử\ngửi đơn',x:660,y:282,lane:1},
    {id:'C_End',type:'endEvent',name:'Đã gửi',x:875,y:301,lane:1}
  ],flows:[
    {id:'C_F1',from:'C_Start',to:'C_Prepare',points:[[186,165],[245,165]]},
    {id:'C_F2',from:'C_Prepare',to:'C_Send',points:[[371,165],[408,165],[408,319],[454,319]]},
    {id:'C_F3',from:'C_Send',to:'C_Archive',points:[[580,319],[660,319]]},
    {id:'C_F4',from:'C_Archive',to:'C_End',points:[[786,319],[875,319]]}
  ],external:{name:'Nhà cung cấp',from:'C_Send',message:'Purchase Order',x:517,y:356}});

const exception = diagram({id:'Timer',name:'Nhắc duyệt quá hạn',lanes:['Người phê duyệt','Hệ thống thông báo'],height:308,width:940,
  nodes:[
    {id:'T_Start',type:'startEvent',name:'Nhận yêu cầu',x:150,y:147,lane:0},
    {id:'T_Approve',type:'userTask',name:'Xử lý\nphê duyệt',x:320,y:128,lane:0},
    {id:'T_Timeout',type:'boundaryEvent',name:'Sau 24 giờ',label:[286,221],x:410,y:184,w:36,h:36,lane:0,attrs:'attachedToRef="T_Approve" cancelActivity="false"',inner:'<bpmn:timerEventDefinition id="T_TimerDefinition"><bpmn:timeDuration xsi:type="bpmn:tFormalExpression">PT24H</bpmn:timeDuration></bpmn:timerEventDefinition>'},
    {id:'T_End',type:'endEvent',name:'Đã xử lý',x:680,y:147,lane:0},
    {id:'T_Notify',type:'sendTask',name:'Gửi nhắc\nphê duyệt',x:550,y:282,lane:1},
    {id:'T_Reminded',type:'endEvent',name:'Đã nhắc',x:810,y:301,lane:1}
  ],flows:[
    {id:'T_F1',from:'T_Start',to:'T_Approve',points:[[186,165],[320,165]]},
    {id:'T_F2',from:'T_Approve',to:'T_End',points:[[446,165],[680,165]]},
    {id:'T_F3',from:'T_Timeout',to:'T_Notify',points:[[428,220],[428,319],[550,319]]},
    {id:'T_F4',from:'T_Notify',to:'T_Reminded',points:[[676,319],[810,319]]}
  ]});

const blank = diagram({id:'NewProcess',name:'Quy trình mới',nodes:[{id:'Start_New',type:'startEvent',name:'Bắt đầu',x:220,y:230}],flows:[]});

export const templates = [
  {id:'purchasing',name:'Yêu cầu mua hàng',category:'Mua hàng',description:'Gửi duyệt, bổ sung và tạo đơn mua trên ERP.',icon:'ShoppingCart',color:'blue',xml:purchasing},
  {id:'warehouse',name:'Nhập kho & kiểm tra QC',category:'Kho vận',description:'Nhận hàng, kiểm tra chất lượng và đưa vào bin.',icon:'Warehouse',color:'teal',xml:warehouse},
  {id:'approval',name:'Phê duyệt song song',category:'Phê duyệt',description:'Hai bên xác nhận độc lập, hợp nhất kết quả.',icon:'GitBranch',color:'violet',xml:approval},
  {id:'collaboration',name:'Đặt hàng nhà cung cấp',category:'Cộng tác',description:'Hai pool với Message Flow đúng ngữ nghĩa BPMN.',icon:'MessagesSquare',color:'amber',xml:collaboration},
  {id:'timer',name:'Nhắc duyệt quá hạn',category:'Ngoại lệ',description:'Boundary Timer không ngắt tác vụ phê duyệt.',icon:'AlarmClock',color:'rose',xml:exception},
  {id:'blank',name:'Quy trình trống',category:'Tự thiết kế',description:'Bắt đầu từ một Start Event.',icon:'Plus',color:'slate',xml:blank}
];
