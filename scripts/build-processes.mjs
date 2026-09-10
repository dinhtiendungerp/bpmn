#!/usr/bin/env node
/** Dựng thư viện quy trình nghiệp vụ từ `examples/processes/source.json`.
 *
 * Mỗi mục trong source.json là một quy trình đã chuẩn hoá: danh sách lane, danh sách
 * bước kèm số thứ tự, và thứ tự nối. Script tự tính toạ độ theo lane và waypoint theo
 * hình học, rồi ghi ra BPMN XML kèm BPMNDI vào `examples/processes/<luồng>/`.
 *
 * Không dựng sẵn HTML: một artifact nặng khoảng 2 MB, nhân với số quy trình là quá lớn
 * cho repo. Cần xem thì render từng file:
 *
 *     npm run bpmn:render -- examples/processes/P2P/PO-01.bpmn output/po-01.html "Tên"
 */
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {diagram} from '../lib/bpmn/templates.mjs';

const SIZE = {event: [36, 36], gateway: [50, 50], task: [160, 96]};
const kind = t => t.includes('Event') ? 'event' : t.includes('Gateway') ? 'gateway' : 'task';

/** Ra cạnh phải nguồn, chạy ngang, rẽ dọc sát đích rồi vào cạnh trái đích. */
function waypoints(a, b) {
  if (a.lane === b.lane) return [[a.x + a.w, a.cy], [b.x, b.cy]];
  const turn = b.x - 30;
  return [[a.x + a.w, a.cy], [turn, a.cy], [turn, b.cy], [b.x, b.cy]];
}

function build(spec) {
  const cy = l => 90 + l * spec.LH + spec.LH / 2;
  const geo = new Map();
  for (const n of spec.nodes) {
    const [w, h] = SIZE[kind(n.type)];
    geo.set(n.id, {...n, w, h, y: Math.round(cy(n.lane) - h / 2), cy: cy(n.lane)});
  }
  return diagram({
    id: spec.id, name: spec.name, lanes: spec.lanes,
    width: spec.width, height: spec.LH * spec.lanes.length,
    nodes: spec.nodes.map(n => {const g = geo.get(n.id); return {...n, y: g.y, w: g.w, h: g.h};}),
    flows: spec.flows.map(f => ({...f, points: waypoints(geo.get(f.from), geo.get(f.to))})),
  });
}

const src = new URL('../examples/processes/source.json', import.meta.url);
const specs = JSON.parse(await readFile(src, 'utf8'));
const slug = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd')
  .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 60);

const byStream = {};
for (const spec of specs) {
  const dir = new URL(`../examples/processes/${spec.stream}/`, import.meta.url);
  await mkdir(dir, {recursive: true});
  const name = (spec.code ? spec.code + '-' : '') + slug(spec.name) + '.bpmn';
  await writeFile(new URL(name, dir), build(spec));
  (byStream[spec.stream] ||= []).push(name);
}
for (const [s, files] of Object.entries(byStream)) console.log(`${s}: ${files.length} quy trình`);
console.log(`Tổng ${specs.length} file BPMN trong examples/processes/.`);
