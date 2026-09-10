/** Authored BPMN examples. Coordinates are intentionally stable for portable BPMNDI. */
export const escapeXml = (value = '') => String(value).replace(/[<>&"']/g, c => ({ '<':'&lt;', '>':'&gt;', '&':'&amp;', '"':'&quot;', "'":'&apos;' })[c]);

export function diagram({ id, name, lanes = [], nodes, flows, width = 1100, height = 462, external }) {
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

const purchasing = diagram({ id:'Purchase', name:'Yêu cầu mua hàng', lanes:['Người yêu cầu','Người phê duyệt','Hệ thống ERP'],width:1130,
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
    {id:'Flow_Resubmit',from:'Task_Revise',to:'Task_Review',points:[[803,128],[803,105],[496,105],[496,286]],name:'Gửi lại',label:[570,111]},
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
    {id:'W_Fail',from:'W_Result',to:'W_Hold',points:[[676,319],[752,319]],name:'Không đạt',label:[640,268]},
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
    {id:'T_Timeout',type:'boundaryEvent',name:'Sau 24 giờ',label:[460,206],x:410,y:184,w:36,h:36,lane:0,attrs:'attachedToRef="T_Approve" cancelActivity="false"',inner:'<bpmn:timerEventDefinition id="T_TimerDefinition"><bpmn:timeDuration xsi:type="bpmn:tFormalExpression">PT24H</bpmn:timeDuration></bpmn:timerEventDefinition>'},
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

const purchasePlanned = diagram({ id:'PurchasePlanned', name:'Mua hàng theo kế hoạch sản xuất', lanes:['Bộ phận Cung ứng','Phòng Kế toán','Bộ phận Kho'], width:1700, height:528,
  nodes:[
    {id:'PP_Start',type:'startEvent',name:'Có kế hoạch sản xuất',x:150,y:160,lane:0,doc:'Kế hoạch sản xuất và lệnh sản xuất đã phát hành là đầu vào cho việc tính nhu cầu nguyên vật liệu.'},
    {id:'PP_MRP',type:'serviceTask',name:'Chạy MRP\nlên nhu cầu NVL',x:250,y:141,lane:0,doc:'Hệ thống tính nhu cầu nguyên vật liệu dựa trên kế hoạch sản xuất, tồn kho hiện có và lượng đang về.'},
    {id:'PP_PO',type:'userTask',name:'Tạo và gửi duyệt\nĐơn mua hàng',x:430,y:141,lane:0,doc:'Từ đề xuất của MRP, Cung ứng xác nhận và tạo Đơn mua hàng; gộp theo nhà cung cấp, đơn vị tính và ngày giao rồi gửi đi phê duyệt.'},
    {id:'PP_Price',type:'userTask',name:'Kiểm tra giá mua\nvới bảng giá',x:620,y:317,lane:1,doc:'Đối chiếu đơn giá trên Đơn mua hàng với bảng giá mua theo hợp đồng nguyên tắc.'},
    {id:'PP_G',type:'exclusiveGateway',name:'Giá hợp lệ?',x:810,y:329,lane:1,attrs:'default="PP_F6"',doc:'Đơn giá khớp bảng giá thì duyệt; lệch giá thì trả lại Cung ứng chỉnh sửa.'},
    {id:'PP_Appr',type:'userTask',name:'Duyệt Đơn mua hàng',x:920,y:317,lane:1,doc:'Đơn mua hàng chuyển trạng thái đã duyệt, sẵn sàng gửi nhà cung cấp.'},
    {id:'PP_Sched',type:'userTask',name:'Thông báo\nlịch nhập kho',x:1110,y:141,lane:0,doc:'Cung ứng thông báo lịch dự kiến nhập kho để Kho chuẩn bị nhân lực và mặt bằng.'},
    {id:'PP_Recv',type:'userTask',name:'Nhập kho theo lô\nvà vị trí',x:1300,y:493,lane:2,doc:'Kho tạo phiếu nhập, gán lô và vị trí kho, ghi nhận số lượng thực nhận rồi ghi sổ.'},
    {id:'PP_Inv',type:'userTask',name:'Ghi nhận\nhóa đơn đầu vào',x:1490,y:317,lane:1,doc:'Kế toán lập hóa đơn mua hàng căn cứ phiếu nhập kho, ghi nhận công nợ phải trả.'},
    {id:'PP_End',type:'endEvent',name:'Hoàn tất mua hàng',x:1680,y:336,lane:1}
  ],
  flows:[
    {id:'PP_F1',from:'PP_Start',to:'PP_MRP',points:[[186,178],[250,178]]},
    {id:'PP_F2',from:'PP_MRP',to:'PP_PO',points:[[376,178],[430,178]]},
    {id:'PP_F3',from:'PP_PO',to:'PP_Price',points:[[556,178],[590,178],[590,354],[620,354]]},
    {id:'PP_F4',from:'PP_Price',to:'PP_G',points:[[746,354],[810,354]]},
    {id:'PP_F5',from:'PP_G',to:'PP_Appr',name:'Hợp lệ',condition:'priceMatchesContract = true',points:[[860,354],[920,354]]},
    {id:'PP_F6',from:'PP_G',to:'PP_PO',name:'Lệch giá',points:[[835,329],[835,250],[493,250],[493,215]]},
    {id:'PP_F7',from:'PP_Appr',to:'PP_Sched',points:[[1046,354],[1080,354],[1080,178],[1110,178]]},
    {id:'PP_F8',from:'PP_Sched',to:'PP_Recv',points:[[1236,178],[1270,178],[1270,530],[1300,530]]},
    {id:'PP_F9',from:'PP_Recv',to:'PP_Inv',points:[[1426,530],[1460,530],[1460,354],[1490,354]]},
    {id:'PP_F10',from:'PP_Inv',to:'PP_End',points:[[1616,354],[1680,354]]}
  ]});

const qcIncoming = diagram({ id:'QcIncoming', name:'Kiểm tra chất lượng hàng mua', lanes:['Bộ phận Kho','Hệ thống','Phòng Quản lý chất lượng'], width:1700, height:528,
  nodes:[
    {id:'QI_Start',type:'startEvent',name:'Có kế hoạch nhập kho',x:150,y:160,lane:0},
    {id:'QI_Notify',type:'userTask',name:'Thông báo QC\nlên kế hoạch kiểm tra',x:250,y:141,lane:0,doc:'Kho thông báo bộ phận chất lượng để chuẩn bị nhân sự, dụng cụ và phương pháp lấy mẫu cho lô sắp về.'},
    {id:'QI_Hold',type:'serviceTask',name:'Gán trạng thái\nCách ly cho lô',x:430,y:317,lane:1,doc:'Sau khi Kho ghi sổ nhập, hệ thống tự gán trạng thái cách ly cho lô mới; lô chưa được phép xuất dùng.'},
    {id:'QI_Gen',type:'serviceTask',name:'Sinh phiếu\nkiểm tra chất lượng',x:610,y:317,lane:1,doc:'Theo điều kiện kích hoạt đã thiết lập cho mặt hàng, nhóm mặt hàng hoặc loại nhập, hệ thống sinh phiếu kiểm tra tương ứng.'},
    {id:'QI_Adj',type:'userTask',name:'Điều chỉnh phiếu QC\nnếu cần',x:790,y:493,lane:2,doc:'Rà soát và điều chỉnh chỉ tiêu kiểm tra, phương pháp lấy mẫu và số mẫu trước khi thực hiện.'},
    {id:'QI_Test',type:'userTask',name:'Thực hiện kiểm tra',x:970,y:493,lane:2,doc:'Kiểm tra cảm quan, lý hóa và vi sinh tùy loại nguyên vật liệu và yêu cầu của tiêu chuẩn áp dụng.'},
    {id:'QI_Rec',type:'userTask',name:'Cập nhật kết quả\nvào hệ thống',x:1150,y:493,lane:2,doc:'Nhập kết quả đo lường vào phiếu, đính kèm chứng từ kiểm tra và chứng từ phân tích của bên thứ ba nếu có.'},
    {id:'QI_G',type:'exclusiveGateway',name:'Kết quả kiểm tra?',x:1330,y:505,lane:2,attrs:'default="QI_F8"',doc:'Đạt thì kích hoạt lô; không đạt thì tách lô và chuyển sang quy trình trả hàng nhà cung cấp.'},
    {id:'QI_Act',type:'serviceTask',name:'Kích hoạt lô đạt',x:1440,y:317,lane:1,doc:'Ghi sổ phiếu kiểm tra; trạng thái lô tự chuyển từ cách ly sang kích hoạt, sẵn sàng xuất dùng.'},
    {id:'QI_Ret',type:'userTask',name:'Tách lô và\nchuyển trả nhà cung cấp',x:1440,y:493,lane:2,doc:'Tạo lô con cho phần không đạt để quản lý riêng, tránh lẫn với phần đạt, rồi chuyển sang quy trình trả hàng.'},
    {id:'QI_EndOk',type:'endEvent',name:'Lô sẵn sàng xuất dùng',x:1630,y:336,lane:1},
    {id:'QI_EndRet',type:'endEvent',name:'Chuyển quy trình trả hàng',x:1630,y:512,lane:2}
  ],
  flows:[
    {id:'QI_F1',from:'QI_Start',to:'QI_Notify',points:[[186,178],[250,178]]},
    {id:'QI_F2',from:'QI_Notify',to:'QI_Hold',points:[[376,178],[400,178],[400,354],[430,354]]},
    {id:'QI_F3',from:'QI_Hold',to:'QI_Gen',points:[[556,354],[610,354]]},
    {id:'QI_F4',from:'QI_Gen',to:'QI_Adj',points:[[736,354],[760,354],[760,530],[790,530]]},
    {id:'QI_F5',from:'QI_Adj',to:'QI_Test',points:[[916,530],[970,530]]},
    {id:'QI_F6',from:'QI_Test',to:'QI_Rec',points:[[1096,530],[1150,530]]},
    {id:'QI_F7',from:'QI_Rec',to:'QI_G',points:[[1276,530],[1330,530]]},
    {id:'QI_F8',from:'QI_G',to:'QI_Ret',name:'Không đạt',points:[[1380,530],[1440,530]]},
    {id:'QI_F9',from:'QI_G',to:'QI_Act',name:'Đạt',condition:'qcPassed = true',points:[[1355,505],[1355,354],[1440,354]]},
    {id:'QI_F10',from:'QI_Act',to:'QI_EndOk',points:[[1566,354],[1630,354]]},
    {id:'QI_F11',from:'QI_Ret',to:'QI_EndRet',points:[[1566,530],[1630,530]]}
  ]});

const salesStandard = diagram({ id:'SalesStandard', name:'Bán hàng thông thường', lanes:['Phòng Kinh doanh','Phòng Kế toán','Bộ phận Kho','Bộ phận Giao vận'], width:1880, height:704,
  nodes:[
    {id:'SS_Start',type:'startEvent',name:'Khách hàng đặt hàng',x:150,y:160,lane:0},
    {id:'SS_Chk',type:'userTask',name:'Kiểm tra hạn mức\nvà tồn kho',x:250,y:141,lane:0,doc:'Kiểm tra số dư công nợ và hạn mức tín dụng của khách hàng, khả năng đáp ứng tồn kho và điều kiện trả trước nếu có.'},
    {id:'SS_SO',type:'userTask',name:'Lập Đơn bán hàng\nvà ghi chú yêu cầu',x:430,y:141,lane:0,doc:'Lập đơn với khách hàng, mặt hàng, số lượng, ngày giao; đơn giá do hệ thống gợi ý từ bảng giá. Ghi chú yêu cầu riêng về hạn dùng và quy cách đóng gói.'},
    {id:'SS_Send',type:'userTask',name:'Gửi phê duyệt\nĐơn bán hàng',x:620,y:141,lane:0,doc:'Đơn chuyển sang Kế toán kiểm tra hạn mức tín dụng trước khi cho phép xuất hàng.'},
    {id:'SS_G',type:'exclusiveGateway',name:'Trong hạn mức\ntín dụng?',x:810,y:329,lane:1,attrs:'default="SS_F6"',doc:'Kế toán đối chiếu tổng tiền đơn cộng công nợ hiện có với hạn mức tín dụng.'},
    {id:'SS_Appr',type:'userTask',name:'Duyệt Đơn bán hàng',x:920,y:317,lane:1,doc:'Đơn tự chuyển trạng thái đã duyệt và sẵn sàng cho các bước xuất giao.'},
    {id:'SS_Ship',type:'serviceTask',name:'Sinh yêu cầu\nvận chuyển',x:1110,y:669,lane:3,doc:'Với khách hàng có phương thức giao cần vận chuyển, hệ thống tự sinh yêu cầu vận chuyển khi đơn được duyệt.'},
    {id:'SS_Pick',type:'userTask',name:'Xuất kho theo lô',x:1300,y:493,lane:2,doc:'Kho tạo phiếu xuất cho đơn đã duyệt; gán lô theo nguyên tắc hết hạn trước xuất trước.'},
    {id:'SS_Deliv',type:'userTask',name:'Giao hàng',x:1490,y:669,lane:3,doc:'Nhận hàng từ Kho theo phiếu xuất, sắp xếp lịch giao và phương tiện, giao cho khách hàng.'},
    {id:'SS_Inv',type:'userTask',name:'Phát hành\nhóa đơn bán hàng',x:1680,y:317,lane:1,doc:'Sau khi giao hàng, Kế toán lập hóa đơn căn cứ phiếu xuất kho đã ghi sổ.'},
    {id:'SS_End',type:'endEvent',name:'Hoàn tất bán hàng',x:1870,y:336,lane:1}
  ],
  flows:[
    {id:'SS_F1',from:'SS_Start',to:'SS_Chk',points:[[186,178],[250,178]]},
    {id:'SS_F2',from:'SS_Chk',to:'SS_SO',points:[[376,178],[430,178]]},
    {id:'SS_F3',from:'SS_SO',to:'SS_Send',points:[[556,178],[620,178]]},
    {id:'SS_F4',from:'SS_Send',to:'SS_G',points:[[746,178],[780,178],[780,354],[810,354]]},
    {id:'SS_F5',from:'SS_G',to:'SS_Appr',name:'Trong hạn mức',condition:'creditAvailable = true',points:[[860,354],[920,354]]},
    {id:'SS_F6',from:'SS_G',to:'SS_SO',name:'Vượt hạn mức',points:[[835,329],[835,250],[493,250],[493,215]]},
    {id:'SS_F7',from:'SS_Appr',to:'SS_Ship',points:[[1046,354],[1080,354],[1080,706],[1110,706]]},
    {id:'SS_F8',from:'SS_Ship',to:'SS_Pick',points:[[1173,669],[1173,530],[1300,530]]},
    {id:'SS_F9',from:'SS_Pick',to:'SS_Deliv',points:[[1426,530],[1460,530],[1460,706],[1490,706]]},
    {id:'SS_F10',from:'SS_Deliv',to:'SS_Inv',points:[[1553,669],[1553,354],[1680,354]]},
    {id:'SS_F11',from:'SS_Inv',to:'SS_End',points:[[1806,354],[1870,354]]}
  ]});

const salesReturn = diagram({ id:'SalesReturn', name:'Quản lý Đơn trả hàng bán', lanes:['Phòng Kinh doanh','Bộ phận Kho','Bộ phận Quản lý chất lượng','Phòng Kế toán'], width:1880, height:704,
  nodes:[
    {id:'SR_Start',type:'startEvent',name:'Khách hàng yêu cầu trả',x:150,y:160,lane:0},
    {id:'SR_Recv',type:'userTask',name:'Tiếp nhận\nyêu cầu trả',x:250,y:141,lane:0,doc:'Xác định lý do trả: hàng lỗi, hàng cận hạn dùng, sai đơn đặt hoặc điều chỉnh doanh số.'},
    {id:'SR_Create',type:'userTask',name:'Lập Đơn trả hàng bán',x:430,y:141,lane:0,doc:'Lập đơn tham chiếu phiếu giao hàng gốc; số lượng trả không vượt quá số lượng đã giao.'},
    {id:'SR_Appr',type:'userTask',name:'Phê duyệt Đơn trả',x:620,y:141,lane:0,doc:'Phê duyệt để kiểm soát tính chính đáng của việc trả hàng.'},
    {id:'SR_Wh',type:'userTask',name:'Nhận hàng trả về kho',x:810,y:317,lane:1,doc:'Kho tiếp nhận theo đơn trả và gán đúng lô đã xuất trước đây để bảo đảm truy vết.'},
    {id:'SR_Qc',type:'userTask',name:'Kiểm tra chất lượng\nhàng trả',x:1000,y:493,lane:2,doc:'Kiểm tra tình trạng hàng trả về để xác định còn bán lại được hay phải xử lý hư hỏng.'},
    {id:'SR_G',type:'exclusiveGateway',name:'Còn bán được?',x:1190,y:505,lane:2,attrs:'default="SR_F7"'},
    {id:'SR_Dmg',type:'userTask',name:'Xử lý hàng hư hỏng',x:1300,y:317,lane:1,doc:'Ghi nhận chi phí sửa chữa bao bì hoặc hủy hàng, phân bổ vào chi phí tương ứng.'},
    {id:'SR_Cn',type:'userTask',name:'Hóa đơn\nđiều chỉnh giảm',x:1490,y:669,lane:3,doc:'Phát hành hóa đơn điều chỉnh giảm cho khách hàng; công nợ phải thu giảm tương ứng.'},
    {id:'SR_Ar',type:'userTask',name:'Kiểm tra công nợ',x:1680,y:669,lane:3,doc:'Đối chiếu số dư công nợ khách hàng sau điều chỉnh giữa hóa đơn gốc và hóa đơn điều chỉnh.'},
    {id:'SR_End',type:'endEvent',name:'Hoàn tất trả hàng',x:1870,y:688,lane:3}
  ],
  flows:[
    {id:'SR_F1',from:'SR_Start',to:'SR_Recv',points:[[186,178],[250,178]]},
    {id:'SR_F2',from:'SR_Recv',to:'SR_Create',points:[[376,178],[430,178]]},
    {id:'SR_F3',from:'SR_Create',to:'SR_Appr',points:[[556,178],[620,178]]},
    {id:'SR_F4',from:'SR_Appr',to:'SR_Wh',points:[[746,178],[780,178],[780,354],[810,354]]},
    {id:'SR_F5',from:'SR_Wh',to:'SR_Qc',points:[[936,354],[970,354],[970,530],[1000,530]]},
    {id:'SR_F6',from:'SR_Qc',to:'SR_G',points:[[1126,530],[1190,530]]},
    {id:'SR_F7',from:'SR_G',to:'SR_Dmg',name:'Không đạt',points:[[1215,505],[1215,354],[1300,354]]},
    {id:'SR_F8',from:'SR_G',to:'SR_Cn',name:'Còn bán được',condition:'resellable = true',points:[[1215,555],[1215,706],[1490,706]]},
    {id:'SR_F9',from:'SR_Dmg',to:'SR_Cn',points:[[1426,354],[1460,354],[1460,706],[1490,706]]},
    {id:'SR_F10',from:'SR_Cn',to:'SR_Ar',points:[[1616,706],[1680,706]]},
    {id:'SR_F11',from:'SR_Ar',to:'SR_End',points:[[1806,706],[1870,706]]}
  ]});

const productionPlan = diagram({ id:'ProductionPlan', name:'Lập kế hoạch sản xuất', lanes:['Phòng Kinh doanh','Bộ phận Kế hoạch sản xuất','Ban Giám đốc sản xuất'], width:1520, height:528,
  nodes:[
    {id:'MP_Start',type:'startEvent',name:'Có dự báo doanh số',x:150,y:160,lane:0},
    {id:'MP_Fc',type:'userTask',name:'Cung cấp\ndự báo doanh số',x:250,y:141,lane:0,doc:'Dự báo doanh số của Kinh doanh là đầu vào cho kế hoạch sản xuất kỳ tới.'},
    {id:'MP_Copy',type:'userTask',name:'Sao chép dự báo\nsang kế hoạch SX',x:430,y:317,lane:1,doc:'Sao chép dữ liệu dự báo bán hàng thành nhu cầu sản xuất trong hệ thống.'},
    {id:'MP_Adj',type:'userTask',name:'Điều chỉnh\nkế hoạch chi tiết',x:620,y:493,lane:2,doc:'Điều chỉnh kế hoạch chi tiết theo doanh số dự báo và định hướng điều hành.'},
    {id:'MP_Mps',type:'serviceTask',name:'Chạy MPS cho\nthành phẩm và bán TP',x:810,y:317,lane:1,doc:'Hệ thống quét dữ liệu kế hoạch và tồn kho để đề xuất lịch sản xuất.'},
    {id:'MP_Cap',type:'userTask',name:'Kiểm tra\nnăng lực sản xuất',x:1000,y:493,lane:2,doc:'Đối chiếu lịch hệ thống đề xuất với năng lực thực tế của xưởng.'},
    {id:'MP_G',type:'exclusiveGateway',name:'Đủ năng lực?',x:1190,y:505,lane:2,attrs:'default="MP_F7"'},
    {id:'MP_Firm',type:'userTask',name:'Tạo Lệnh sản xuất',x:1300,y:317,lane:1,doc:'Tạo lệnh sản xuất từ màn hình kế hoạch sau khi lịch đã khả thi.'},
    {id:'MP_End',type:'endEvent',name:'Có lệnh sản xuất',x:1490,y:336,lane:1}
  ],
  flows:[
    {id:'MP_F1',from:'MP_Start',to:'MP_Fc',points:[[186,178],[250,178]]},
    {id:'MP_F2',from:'MP_Fc',to:'MP_Copy',points:[[376,178],[400,178],[400,354],[430,354]]},
    {id:'MP_F3',from:'MP_Copy',to:'MP_Adj',points:[[556,354],[590,354],[590,530],[620,530]]},
    {id:'MP_F4',from:'MP_Adj',to:'MP_Mps',points:[[746,530],[780,530],[780,354],[810,354]]},
    {id:'MP_F5',from:'MP_Mps',to:'MP_Cap',points:[[936,354],[970,354],[970,530],[1000,530]]},
    {id:'MP_F6',from:'MP_Cap',to:'MP_G',points:[[1126,530],[1190,530]]},
    {id:'MP_F7',from:'MP_G',to:'MP_Adj',name:'Chưa đủ',points:[[1215,681],[1215,760],[683,760],[683,681]]},
    {id:'MP_F8',from:'MP_G',to:'MP_Firm',name:'Đủ năng lực',condition:'capacityAvailable = true',points:[[1215,505],[1215,354],[1300,354]]},
    {id:'MP_F9',from:'MP_Firm',to:'MP_End',points:[[1426,354],[1490,354]]}
  ]});

const productionCosting = diagram({ id:'ProductionCosting', name:'Tính giá thành sản xuất', lanes:['Phòng Sản xuất','Phòng Kế toán'], width:1800, height:352,
  nodes:[
    {id:'PC_Start',type:'startEvent',name:'Đến kỳ tính giá thành',x:150,y:160,lane:0},
    {id:'PC_Out',type:'userTask',name:'Cập nhật Output\nvà Consumption',x:250,y:141,lane:0,doc:'Hằng ngày cập nhật sản lượng và tiêu hao thực tế từ báo cáo sản xuất.'},
    {id:'PC_Fin',type:'userTask',name:'Chuyển lệnh sản xuất\nsang Finished',x:440,y:141,lane:0,doc:'Chuyển trạng thái các lệnh sản xuất đã hoàn thành để chốt số liệu tính giá.'},
    {id:'PC_Lab',type:'userTask',name:'Ghi nhận chi phí\nnhân công và SX chung',x:630,y:317,lane:1,doc:'Hạch toán chi phí nhân công và sản xuất chung vào sổ nhật ký theo từng nhà máy.'},
    {id:'PC_Chk',type:'userTask',name:'Kiểm tra lệnh SX\ncuối kỳ',x:820,y:317,lane:1,doc:'Rà soát toàn bộ sản lượng và tiêu hao trước khi phân bổ chi phí.'},
    {id:'PC_Adj1',type:'serviceTask',name:'Adjust Cost\nvà Post to G/L',x:1010,y:317,lane:1,doc:'Cập nhật giá vốn nguyên vật liệu vào sổ cái.'},
    {id:'PC_Alloc',type:'userTask',name:'Phân bổ chi phí\ncho từng lệnh SX',x:1200,y:317,lane:1,doc:'Phân bổ chi phí nhân công và sản xuất chung cho từng lệnh sản xuất theo tiêu thức đã chọn.'},
    {id:'PC_Adj2',type:'serviceTask',name:'Adjust Cost\nlần hai',x:1390,y:317,lane:1,doc:'Đẩy kết quả phân bổ vào sổ cái để hoàn tất giá thành.'},
    {id:'PC_Rpt',type:'userTask',name:'Báo cáo\nInventory Valuation',x:1580,y:317,lane:1,doc:'Kiểm tra chi phí nguyên vật liệu và sản xuất chung đã phân bổ đúng, đối chiếu giá trị dở dang.'},
    {id:'PC_End',type:'endEvent',name:'Chốt giá thành kỳ',x:1770,y:336,lane:1}
  ],
  flows:[
    {id:'PC_F1',from:'PC_Start',to:'PC_Out',points:[[186,178],[250,178]]},
    {id:'PC_F2',from:'PC_Out',to:'PC_Fin',points:[[376,178],[440,178]]},
    {id:'PC_F3',from:'PC_Fin',to:'PC_Lab',points:[[566,178],[600,178],[600,354],[630,354]]},
    {id:'PC_F4',from:'PC_Lab',to:'PC_Chk',points:[[756,354],[820,354]]},
    {id:'PC_F5',from:'PC_Chk',to:'PC_Adj1',points:[[946,354],[1010,354]]},
    {id:'PC_F6',from:'PC_Adj1',to:'PC_Alloc',points:[[1136,354],[1200,354]]},
    {id:'PC_F7',from:'PC_Alloc',to:'PC_Adj2',points:[[1326,354],[1390,354]]},
    {id:'PC_F8',from:'PC_Adj2',to:'PC_Rpt',points:[[1516,354],[1580,354]]},
    {id:'PC_F9',from:'PC_Rpt',to:'PC_End',points:[[1706,354],[1770,354]]}
  ]});

const bankPayment = diagram({ id:'BankPayment', name:'Chi tiền qua ngân hàng', lanes:['Bộ phận yêu cầu','Phòng Kế toán','Ban Giám đốc','Ngân hàng'], width:2000, height:704,
  nodes:[
    {id:'BP_Start',type:'startEvent',name:'Phát sinh nhu cầu chi',x:150,y:160,lane:0},
    {id:'BP_Req',type:'userTask',name:'Lập đề nghị\nthanh toán',x:250,y:141,lane:0,doc:'Bộ phận có nhu cầu lập đề nghị thanh toán kèm chứng từ; trưởng bộ phận ký duyệt trước khi gửi Kế toán.'},
    {id:'BP_Ver',type:'userTask',name:'Tiếp nhận\nvà thẩm định',x:440,y:317,lane:1,doc:'Kế toán kiểm tra tính hợp lệ của bộ chứng từ và trình phê duyệt theo phân cấp.'},
    {id:'BP_G',type:'exclusiveGateway',name:'Hồ sơ hợp lệ?',x:630,y:329,lane:1,attrs:'default="BP_F5"'},
    {id:'BP_Jrn',type:'userTask',name:'Tạo bút toán chi\ntrên Payment Journal',x:740,y:317,lane:1,doc:'Tạo bút toán thanh toán bằng tiền mặt hoặc chuyển khoản, tham chiếu hóa đơn và đề nghị đã duyệt.'},
    {id:'BP_Xml',type:'serviceTask',name:'Kết xuất lệnh\nvà gửi ngân hàng',x:930,y:317,lane:1,doc:'Kết xuất tệp lệnh thanh toán từ hệ thống rồi nạp lên cổng ngân hàng, hoặc gửi thẳng nếu đã tích hợp trực tiếp.'},
    {id:'BP_Appr',type:'userTask',name:'Duyệt lệnh chi\ntrên hệ thống ngân hàng',x:1120,y:493,lane:2,doc:'Người có thẩm quyền duyệt lệnh trên hệ thống ngân hàng để lệnh được thực hiện.'},
    {id:'BP_Pay',type:'userTask',name:'Đi lệnh chuyển tiền',x:1310,y:669,lane:3,doc:'Ngân hàng thực hiện chuyển tiền theo lệnh đã được duyệt.'},
    {id:'BP_Stmt',type:'serviceTask',name:'Trả thông tin\nsao kê về hệ thống',x:1500,y:669,lane:3,doc:'Thông tin sao kê được gửi về màn hình đối chiếu ngân hàng trong hệ thống.'},
    {id:'BP_Rec',type:'userTask',name:'Đối chiếu sao kê\nvà hạch toán',x:1690,y:317,lane:1,doc:'Kế toán đối chiếu các lệnh đã hoàn thành, hệ thống ghi nhận hạch toán và in phiếu chi theo mẫu quy định.'},
    {id:'BP_End',type:'endEvent',name:'Hoàn tất chi tiền',x:1880,y:336,lane:1}
  ],
  flows:[
    {id:'BP_F1',from:'BP_Start',to:'BP_Req',points:[[186,178],[250,178]]},
    {id:'BP_F2',from:'BP_Req',to:'BP_Ver',points:[[376,178],[410,178],[410,354],[440,354]]},
    {id:'BP_F3',from:'BP_Ver',to:'BP_G',points:[[566,354],[630,354]]},
    {id:'BP_F4',from:'BP_G',to:'BP_Jrn',name:'Hợp lệ',condition:'documentsComplete = true',points:[[680,354],[740,354]]},
    {id:'BP_F5',from:'BP_G',to:'BP_Req',name:'Thiếu chứng từ',points:[[655,329],[655,250],[313,250],[313,215]]},
    {id:'BP_F6',from:'BP_Jrn',to:'BP_Xml',points:[[866,354],[930,354]]},
    {id:'BP_F7',from:'BP_Xml',to:'BP_Appr',points:[[1056,354],[1090,354],[1090,530],[1120,530]]},
    {id:'BP_F8',from:'BP_Appr',to:'BP_Pay',points:[[1246,530],[1280,530],[1280,706],[1310,706]]},
    {id:'BP_F9',from:'BP_Pay',to:'BP_Stmt',points:[[1436,706],[1500,706]]},
    {id:'BP_F10',from:'BP_Stmt',to:'BP_Rec',points:[[1563,669],[1563,354],[1690,354]]},
    {id:'BP_F11',from:'BP_Rec',to:'BP_End',points:[[1816,354],[1880,354]]}
  ]});

const periodClose = diagram({ id:'PeriodClose', name:'Đối chiếu và đóng sổ cuối kỳ', lanes:['Kế toán tổng hợp','Kế toán trưởng','Ban Giám đốc'], width:1910, height:528,
  nodes:[
    {id:'PZ_Start',type:'startEvent',name:'Kết thúc kỳ kế toán',x:150,y:160,lane:0},
    {id:'PZ_Sum',type:'userTask',name:'Tổng hợp\nbút toán điều chỉnh',x:250,y:141,lane:0,doc:'Tổng hợp các bút toán điều chỉnh phát sinh trong kỳ từ các phần hành.'},
    {id:'PZ_Jrn',type:'userTask',name:'Lập bút toán\ntrên General Journal',x:440,y:141,lane:0,doc:'Nhập bút toán điều chỉnh vào sổ nhật ký chung kèm diễn giải và chứng từ tham chiếu.'},
    {id:'PZ_A1',type:'userTask',name:'Kế toán trưởng\nphê duyệt',x:630,y:317,lane:1,doc:'Kế toán trưởng soát xét và phê duyệt bút toán điều chỉnh.'},
    {id:'PZ_G',type:'exclusiveGateway',name:'Giá trị trọng yếu?',x:820,y:329,lane:1,attrs:'default="PZ_F6"'},
    {id:'PZ_A2',type:'userTask',name:'Ban Giám đốc\nphê duyệt',x:930,y:493,lane:2,doc:'Bút toán vượt ngưỡng trọng yếu cần thêm phê duyệt của Ban Giám đốc.'},
    {id:'PZ_Post',type:'userTask',name:'Ghi sổ\nbút toán điều chỉnh',x:1120,y:141,lane:0,doc:'Ghi sổ bút toán sau khi đã có đủ phê duyệt theo phân cấp.'},
    {id:'PZ_Re',type:'userTask',name:'Đối chiếu lại\nsau điều chỉnh',x:1310,y:141,lane:0,doc:'Đối chiếu lại số liệu sổ sách sau khi các bút toán điều chỉnh đã ghi sổ.'},
    {id:'PZ_Close',type:'userTask',name:'Đóng kỳ\nvà mở kỳ mới',x:1500,y:141,lane:0,doc:'Đóng kỳ kế toán, khai báo kỳ mới và bộ số chứng từ cho năm tài chính tiếp theo.'},
    {id:'PZ_Conf',type:'userTask',name:'Xác nhận đóng sổ',x:1690,y:317,lane:1,doc:'Kế toán trưởng xác nhận hoàn tất đóng sổ cuối kỳ.'},
    {id:'PZ_End',type:'endEvent',name:'Đã đóng sổ',x:1880,y:336,lane:1}
  ],
  flows:[
    {id:'PZ_F1',from:'PZ_Start',to:'PZ_Sum',points:[[186,178],[250,178]]},
    {id:'PZ_F2',from:'PZ_Sum',to:'PZ_Jrn',points:[[376,178],[440,178]]},
    {id:'PZ_F3',from:'PZ_Jrn',to:'PZ_A1',points:[[566,178],[600,178],[600,354],[630,354]]},
    {id:'PZ_F4',from:'PZ_A1',to:'PZ_G',points:[[756,354],[820,354]]},
    {id:'PZ_F5',from:'PZ_G',to:'PZ_A2',name:'Trọng yếu',condition:'materialAmount = true',points:[[845,379],[845,530],[930,530]]},
    {id:'PZ_F6',from:'PZ_G',to:'PZ_Post',name:'Không trọng yếu',points:[[845,329],[845,178],[1120,178]]},
    {id:'PZ_F7',from:'PZ_A2',to:'PZ_Post',points:[[993,493],[993,178],[1120,178]]},
    {id:'PZ_F8',from:'PZ_Post',to:'PZ_Re',points:[[1246,178],[1310,178]]},
    {id:'PZ_F9',from:'PZ_Re',to:'PZ_Close',points:[[1436,178],[1500,178]]},
    {id:'PZ_F10',from:'PZ_Close',to:'PZ_Conf',points:[[1626,178],[1660,178],[1660,354],[1690,354]]},
    {id:'PZ_F11',from:'PZ_Conf',to:'PZ_End',points:[[1816,354],[1880,354]]}
  ]});

export const templates = [
  {id:'purchasing',name:'Yêu cầu mua hàng',category:'Mua hàng',description:'Gửi duyệt, bổ sung và tạo đơn mua trên ERP.',icon:'ShoppingCart',color:'blue',xml:purchasing},
  {id:'warehouse',name:'Nhập kho & kiểm tra QC',category:'Kho vận',description:'Nhận hàng, kiểm tra chất lượng và đưa vào bin.',icon:'Warehouse',color:'teal',xml:warehouse},
  {id:'approval',name:'Phê duyệt song song',category:'Phê duyệt',description:'Hai bên xác nhận độc lập, hợp nhất kết quả.',icon:'GitBranch',color:'violet',xml:approval},
  {id:'collaboration',name:'Đặt hàng nhà cung cấp',category:'Cộng tác',description:'Hai pool với Message Flow đúng ngữ nghĩa BPMN.',icon:'MessagesSquare',color:'amber',xml:collaboration},
  {id:'timer',name:'Nhắc duyệt quá hạn',category:'Ngoại lệ',description:'Boundary Timer không ngắt tác vụ phê duyệt.',icon:'AlarmClock',color:'rose',xml:exception},
  {id:'PurchasePlanned',name:'Mua hàng theo kế hoạch sản xuất',category:'Mua hàng',description:'Chạy MRP, duyệt giá theo hợp đồng, nhập kho và ghi nhận công nợ.',icon:'ClipboardList',color:'blue',xml:purchasePlanned},
  {id:'QcIncoming',name:'Kiểm tra chất lượng hàng mua',category:'Chất lượng',description:'Cách ly lô, sinh phiếu kiểm, tách lô đạt và không đạt.',icon:'ShieldCheck',color:'teal',xml:qcIncoming},
  {id:'SalesStandard',name:'Bán hàng thông thường',category:'Bán hàng',description:'Kiểm hạn mức tín dụng, duyệt đơn, xuất kho, giao hàng và xuất hóa đơn.',icon:'Receipt',color:'violet',xml:salesStandard},
  {id:'SalesReturn',name:'Quản lý Đơn trả hàng bán',category:'Bán hàng',description:'Nhận hàng trả, kiểm chất lượng và phát hành hóa đơn điều chỉnh giảm.',icon:'Undo2',color:'amber',xml:salesReturn},
  {id:'ProductionPlan',name:'Lập kế hoạch sản xuất',category:'Sản xuất',description:'Từ dự báo doanh số tới lệnh sản xuất, có vòng điều chỉnh năng lực.',icon:'CalendarRange',color:'blue',xml:productionPlan},
  {id:'ProductionCosting',name:'Tính giá thành sản xuất',category:'Sản xuất',description:'Chốt lệnh sản xuất, phân bổ chi phí và đối chiếu giá trị tồn kho.',icon:'Calculator',color:'teal',xml:productionCosting},
  {id:'BankPayment',name:'Chi tiền qua ngân hàng',category:'Kế toán',description:'Đề nghị thanh toán, thẩm định, đi lệnh ngân hàng và đối chiếu sao kê.',icon:'Banknote',color:'violet',xml:bankPayment},
  {id:'PeriodClose',name:'Đối chiếu và đóng sổ cuối kỳ',category:'Kế toán',description:'Bút toán điều chỉnh, phê duyệt theo phân cấp và đóng kỳ kế toán.',icon:'BookCheck',color:'rose',xml:periodClose},
  {id:'blank',name:'Quy trình trống',category:'Tự thiết kế',description:'Bắt đầu từ một Start Event.',icon:'Plus',color:'slate',xml:blank}
];
