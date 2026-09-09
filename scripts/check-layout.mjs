#!/usr/bin/env node
/** Kiểm tra hình học của khối BPMNDI.
 *
 * validate-bpmn.mjs soi ngữ nghĩa (luồng, gateway, sự kiện) nhưng không đọc
 * một tọa độ nào, nên một file "sạch" vẫn có thể render ra nhãn chồng nhãn,
 * node tràn khỏi lane hay đường nối xuyên qua node. Script này đọc thẳng
 * BPMNShape/BPMNEdge và bắt đúng nhóm lỗi đó, không cần trình duyệt.
 *
 * Ý tưởng lấy từ verify-geometry.py của cathrynlavery/diagram-design (MIT).
 *
 *     node scripts/check-layout.mjs work/quy-trinh.bpmn
 */
import {readFile} from 'node:fs/promises';
import {createModdle} from '../lib/bpmn/moddle.mjs';

/** Bỏ qua các mép chạm nhau dưới ngưỡng này (px). */
const TOL = 2;

const rect = b => ({x: b.x, y: b.y, w: b.width, h: b.height});
const right = r => r.x + r.w;
const bottom = r => r.y + r.h;

const overlaps = (a, b, tol = TOL) =>
  Math.min(right(a), right(b)) - Math.max(a.x, b.x) > tol &&
  Math.min(bottom(a), bottom(b)) - Math.max(a.y, b.y) > tol;

const containedIn = (outer, inner, tol = TOL) =>
  inner.x >= outer.x - tol && inner.y >= outer.y - tol &&
  right(inner) <= right(outer) + tol && bottom(inner) <= bottom(outer) + tol;

const shrink = (r, by) => ({x: r.x + by, y: r.y + by, w: r.w - 2 * by, h: r.h - 2 * by});

function segmentsCross(x1, y1, x2, y2, x3, y3, x4, y4) {
  const d = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3);
  if (Math.abs(d) < 1e-9) return false;
  const t = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / d;
  const u = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / d;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

function segmentHitsRect(p, q, r) {
  const inside = pt => pt.x > r.x && pt.x < right(r) && pt.y > r.y && pt.y < bottom(r);
  if (inside(p) || inside(q)) return true;
  const sides = [
    [r.x, r.y, right(r), r.y],
    [right(r), r.y, right(r), bottom(r)],
    [right(r), bottom(r), r.x, bottom(r)],
    [r.x, bottom(r), r.x, r.y],
  ];
  return sides.some(([a, b, c, d]) => segmentsCross(p.x, p.y, q.x, q.y, a, b, c, d));
}

const label = el => (el.$type === 'bpmn:SequenceFlow' || el.$type === 'bpmn:MessageFlow'
  ? `luồng ${el.id}` : `"${el.name?.replace(/\s+/g, ' ').trim() || el.id}"`);

function inspectPlane(plane, issues) {
  const parts = plane.planeElement || [];
  const shapes = parts.filter(e => e.$type === 'bpmndi:BPMNShape' && e.bounds);
  const edges = parts.filter(e => e.$type === 'bpmndi:BPMNEdge' && e.waypoint?.length);
  const report = (el, severity, code, message) => issues.push({id: el?.id ?? null, severity, code, message});

  const pools = shapes.filter(s => s.bpmnElement?.$type === 'bpmn:Participant');
  const lanes = shapes.filter(s => s.bpmnElement?.$type === 'bpmn:Lane');
  const nodes = shapes.filter(s => s.bpmnElement &&
    !['bpmn:Participant', 'bpmn:Lane'].includes(s.bpmnElement.$type));

  // Node nào thuộc lane nào, lấy từ flowNodeRef.
  const laneOf = new Map();
  for (const lane of lanes)
    for (const ref of lane.bpmnElement.flowNodeRef || []) laneOf.set(ref.id, lane);

  // SubProcess mở rộng chứa node con bên trong: lồng nhau, không phải chồng lấn.
  const isContainer = s => Array.isArray(s.bpmnElement.flowElements) && s.bpmnElement.flowElements.length > 0;
  const nests = (a, b) => containedIn(rect(a.bounds), rect(b.bounds)) || containedIn(rect(b.bounds), rect(a.bounds));

  // Boundary Event chồng lên chính activity nó gắn vào là đúng chuẩn.
  const attachedTo = new Map();
  for (const n of nodes) {
    const host = n.bpmnElement.attachedToRef;
    if (host) attachedTo.set(n.bpmnElement.id, host.id);
  }
  const boundaryPair = (a, b) =>
    attachedTo.get(a.id) === b.id || attachedTo.get(b.id) === a.id;

  // Nhãn: gom từ cả shape lẫn edge.
  const labels = [...shapes, ...edges]
    .filter(e => e.label?.bounds && e.bpmnElement && (e.bpmnElement.name || '').trim())
    .map(e => ({el: e.bpmnElement, rect: rect(e.label.bounds), fromEdge: e.$type === 'bpmndi:BPMNEdge'}));

  // 1. Lane chồng nhau, hoặc tràn khỏi pool.
  for (let i = 0; i < lanes.length; i++) {
    for (let j = i + 1; j < lanes.length; j++)
      if (overlaps(rect(lanes[i].bounds), rect(lanes[j].bounds)))
        report(lanes[i].bpmnElement, 'error', 'lane-overlap',
          `Lane ${label(lanes[i].bpmnElement)} chồng lên ${label(lanes[j].bpmnElement)}. Kiểm tra lại y và height của từng lane.`);
    // Collaboration có nhiều pool: lane chỉ cần nằm gọn trong một pool bất kỳ.
    if (pools.length && !pools.some(p => containedIn(rect(p.bounds), rect(lanes[i].bounds))))
      report(lanes[i].bpmnElement, 'error', 'lane-outside-pool',
        `Lane ${label(lanes[i].bpmnElement)} không nằm gọn trong pool nào. Pool phải cao bằng tổng chiều cao các lane.`);
  }

  // 2. Node chồng node.
  for (let i = 0; i < nodes.length; i++)
    for (let j = i + 1; j < nodes.length; j++) {
      const [a, b] = [nodes[i], nodes[j]];
      if (boundaryPair(a.bpmnElement, b.bpmnElement)) continue;
      if ((isContainer(a) || isContainer(b)) && nests(a, b)) continue;
      if (overlaps(rect(a.bounds), rect(b.bounds)))
        report(a.bpmnElement, 'error', 'node-overlap',
          `Node ${label(a.bpmnElement)} chồng lên ${label(b.bpmnElement)}.`);
    }

  // 3. Node tràn khỏi lane của nó.
  for (const n of nodes) {
    const lane = laneOf.get(n.bpmnElement.id);
    if (lane && !containedIn(rect(lane.bounds), rect(n.bounds)))
      report(n.bpmnElement, 'error', 'node-outside-lane',
        `Node ${label(n.bpmnElement)} tràn ra ngoài lane ${label(lane.bpmnElement)}.`);
  }

  // 4. Nhãn đè lên node.
  for (const lb of labels)
    for (const n of nodes) {
      if (lb.el === n.bpmnElement) continue;                                  // nhãn của chính node đó
      if (isContainer(n) && containedIn(rect(n.bounds), lb.rect)) continue;    // nhãn nằm trong subprocess
      if (overlaps(lb.rect, rect(n.bounds)))
        report(lb.el, 'error', 'label-over-node',
          `Nhãn của ${label(lb.el)} đè lên node ${label(n.bpmnElement)}. Dịch nhãn sang ngang hoặc tăng chiều cao lane.`);
    }

  // 5. Nhãn đè nhãn.
  for (let i = 0; i < labels.length; i++)
    for (let j = i + 1; j < labels.length; j++)
      if (overlaps(labels[i].rect, labels[j].rect))
        report(labels[i].el, 'error', 'label-overlap',
          `Nhãn của ${label(labels[i].el)} đè lên nhãn của ${label(labels[j].el)}.`);

  // 6. Nhãn tràn khỏi lane (nhãn của node) hoặc khỏi pool (nhãn của luồng).
  for (const lb of labels) {
    const lane = lb.fromEdge ? null : laneOf.get(lb.el.id);
    if (lane && !containedIn(rect(lane.bounds), lb.rect)) {
      report(lb.el, 'error', 'label-outside-lane',
        `Nhãn của ${label(lb.el)} tràn ra ngoài lane ${label(lane.bpmnElement)}, sẽ hiện ở sai làn.`);
      continue;
    }
    // Message Flow nối hai pool nên nhãn của nó nằm giữa các pool là đúng.
    if (lb.el.$type === 'bpmn:MessageFlow') continue;
    if (pools.length && !pools.some(p => containedIn(rect(p.bounds), lb.rect)))
      report(lb.el, 'error', 'label-outside-pool',
        `Nhãn của ${label(lb.el)} không nằm trong pool nào.`);
  }

  // 7. Đường nối xuyên qua node không phải đầu hay cuối của nó.
  for (const e of edges) {
    const flow = e.bpmnElement;
    const ends = new Set([flow.sourceRef?.id, flow.targetRef?.id]);
    for (const n of nodes) {
      if (ends.has(n.bpmnElement.id) || isContainer(n)) continue;
      const box = shrink(rect(n.bounds), TOL);
      if (box.w <= 0 || box.h <= 0) continue;
      const hit = e.waypoint.slice(0, -1)
        .some((p, i) => segmentHitsRect(p, e.waypoint[i + 1], box));
      if (hit)
        report(flow, 'warning', 'edge-through-node',
          `Đường ${label(flow)} đi xuyên qua node ${label(n.bpmnElement)}. Đổi waypoint để vòng tránh.`);
    }
  }
}

const files = process.argv.slice(2);
if (!files.length) {
  console.error('Usage: node scripts/check-layout.mjs file.bpmn [file.bpmn...]');
  process.exit(1);
}

for (const file of files) {
  try {
    const xml = await readFile(file, 'utf8');
    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('DTD/entity is unsupported.');
    const {rootElement} = await createModdle().fromXML(xml);
    if (!rootElement.diagrams?.length) throw new Error('BPMNDI layout is required.');
    const issues = [];
    for (const d of rootElement.diagrams) if (d.plane) inspectPlane(d.plane, issues);
    console.log(JSON.stringify({file, issues}, null, 2));
    if (issues.some(i => i.severity === 'error')) process.exitCode = 1;
  } catch (e) {
    console.error(file + ': ' + e.message);
    process.exitCode = 1;
  }
}
