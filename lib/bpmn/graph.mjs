/** Graph inspection deliberately excludes message flows from execution paths. */
export function flowNodes(definitions) {
  const all = [];
  const visit = scope => {
    for (const node of scope.flowElements || []) {
      all.push(node);
      if (node.flowElements) visit(node);
    }
  };
  for (const root of definitions.rootElements || []) if (root.$type === 'bpmn:Process') visit(root);
  return all;
}

const is = (n, t) => n?.$instanceOf?.('bpmn:'+t) || n?.$type === 'bpmn:'+t;
export function validateDefinitions(definitions) {
  const issues = [];
  const report = (node, severity, code, message) => issues.push({id:node.id, severity, code, message});
  const inspect = scope => {
    const elements = scope.flowElements || [];
    const nodes = elements.filter(n => is(n,'FlowNode'));
    if (!scope.triggeredByEvent && !nodes.some(n => is(n,'StartEvent')) && nodes.length) report(scope,'warning','start','Quy trình chưa có sự kiện bắt đầu rõ ràng.');
    if (nodes.length && !nodes.some(n => is(n,'EndEvent'))) report(scope,'warning','end','Quy trình chưa có sự kiện kết thúc.');
    for (const n of nodes) {
      const incoming = n.incoming || [], outgoing = n.outgoing || [];
      if (is(n,'StartEvent') && incoming.length) report(n,'error','start-incoming','Start Event không được có Sequence Flow đi vào.');
      if (is(n,'EndEvent') && outgoing.length) report(n,'error','end-outgoing','End Event không được có Sequence Flow đi ra.');
      if (!is(n,'StartEvent') && !is(n,'BoundaryEvent') && !n.isForCompensation && !n.triggeredByEvent && !incoming.length) report(n,'warning','incoming','Phần tử chưa có luồng đi vào.');
      if (!is(n,'EndEvent') && !n.isForCompensation && !n.triggeredByEvent && !outgoing.length) report(n,'warning','outgoing','Phần tử chưa có luồng đi ra.');
      if (is(n,'Activity') && !n.name?.trim()) report(n,'warning','name','Đặt tên tác vụ bằng hành động nghiệp vụ.');
      if (is(n,'BoundaryEvent') && !n.attachedToRef) report(n,'error','boundary','Boundary Event phải gắn vào một Activity.');
      if (is(n,'BoundaryEvent') && incoming.length) report(n,'error','boundary-incoming','Boundary Event không được có Sequence Flow đi vào.');
      if ((is(n,'ExclusiveGateway') || is(n,'InclusiveGateway')) && outgoing.length > 1) {
        if (!n.default) report(n,'warning','default','Nên xác định nhánh mặc định để tránh không có nhánh phù hợp.');
        for (const f of outgoing) {
          if (f !== n.default && !f.conditionExpression?.body?.trim()) report(f,'warning','condition','Nhánh lựa chọn chưa có biểu thức điều kiện.');
          if (!f.name?.trim()) report(f,'warning','branch-name','Đặt nhãn cho nhánh để người đọc hiểu điều kiện.');
        }
      }
      if (is(n,'ParallelGateway')) for (const f of outgoing) if (f.conditionExpression) report(f,'error','parallel-condition','Parallel Gateway không sử dụng điều kiện trên nhánh ra.');
      if (n.default?.conditionExpression) report(n.default,'warning','default-condition','Điều kiện trên nhánh mặc định không được dùng khi chọn nhánh.');
      for (const def of n.eventDefinitions || []) {
        if (is(def,'TimerEventDefinition') && !def.timeDate?.body && !def.timeDuration?.body && !def.timeCycle?.body) report(n,'warning','timer','Timer chưa có thời điểm, khoảng chờ hoặc chu kỳ.');
      }
      if (n.flowElements) inspect(n);
    }
    for (const f of elements.filter(n => is(n,'SequenceFlow'))) {
      if (!f.sourceRef || !f.targetRef) report(f,'error','flow-endpoint','Luồng thiếu điểm đầu hoặc điểm cuối.');
      if (f.sourceRef?.$parent !== f.targetRef?.$parent) report(f,'error','flow-scope','Sequence Flow phải nằm trong cùng phạm vi quy trình.');
    }
    // Conservative reachability: event subprocesses, compensation and boundaries have distinct triggers.
    const seeds = nodes.filter(n => is(n,'StartEvent') || is(n,'BoundaryEvent') || n.triggeredByEvent || n.isForCompensation);
    if (seeds.length) {
      const visited = new Set(); const queue = [...seeds];
      while(queue.length) { const n = queue.shift(); if(visited.has(n.id)) continue; visited.add(n.id); for(const f of n.outgoing || []) if(f.targetRef) queue.push(f.targetRef); }
      for(const n of nodes) if(!visited.has(n.id)) report(n,'warning','unreachable','Không tìm thấy đường đi từ sự kiện kích hoạt trong phạm vi này.');
    }
  };
  for (const root of definitions.rootElements || []) {
    if (is(root,'Process')) inspect(root);
    if (is(root,'Collaboration')) {
      const processOf = n => { let p=n; while(p && !is(p,'Process') && !is(p,'Participant')) p=p.$parent; return is(p,'Participant') ? p.processRef || p : p; };
      for(const f of root.messageFlows || []) if(processOf(f.sourceRef) && processOf(f.sourceRef) === processOf(f.targetRef)) report(f,'error','message-scope','Message Flow phải trao đổi giữa các participant khác nhau.');
    }
  }
  return issues;
}

export function collectRelated(element, direction='outgoing') {
  const visited = new Set(); const queue = [element];
  while(queue.length) {
    const current = queue.shift();
    if(!current || visited.has(current.id)) continue;
    visited.add(current.id);
    for(const flow of current[direction] || []) {
      if(flow.type !== 'bpmn:SequenceFlow') continue;
      visited.add(flow.id);
      queue.push(direction === 'outgoing' ? flow.target : flow.source);
    }
  }
  return visited;
}

export function findPath(source, target) {
  const queue = [[source, []]], seen = new Set();
  while(queue.length) {
    const [n,path] = queue.shift();
    if(!n || seen.has(n.id)) continue;
    if(n.id === target.id) return [...path,n.id];
    seen.add(n.id);
    for(const f of n.outgoing || []) if(f.type === 'bpmn:SequenceFlow') queue.push([f.target,[...path,n.id,f.id]]);
  }
  return [];
}

export function getStoryElements(elements) {
  const nodes = elements.filter(e => e.type !== 'label' && !e.waypoints && is(e.businessObject,'FlowNode'));
  const result = [], seen = new Set();
  const visit = node => {
    if(!node || seen.has(node.id)) return;
    seen.add(node.id); result.push(node);
    for(const flow of node.outgoing || []) if(flow.type === 'bpmn:SequenceFlow') visit(flow.target);
  };
  nodes.filter(e => e.type === 'bpmn:StartEvent').forEach(visit);
  nodes.forEach(visit);
  return result;
}
