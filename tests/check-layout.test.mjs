/** check-layout.mjs phải bắt được lỗi hình học thật, và không báo oan trên file hợp lệ. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {writeFileSync, mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const SCRIPT = new URL('../scripts/check-layout.mjs', import.meta.url).pathname;
const dir = mkdtempSync(join(tmpdir(), 'layout-'));

function run(file) {
  try {
    return {code: 0, out: JSON.parse(execFileSync('node', [SCRIPT, file], {encoding: 'utf8'}))};
  } catch (e) {
    return {code: e.status, out: JSON.parse(e.stdout)};
  }
}

/** Pool 1 lane; lane y 90..290, trục giữa 190. Toạ độ chọn sao cho không có va chạm nào. */
const BASE = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="D" targetNamespace="https://bpmn-studio.local/process">
  <bpmn:collaboration id="C"><bpmn:participant id="Pool" name="P" processRef="P"/></bpmn:collaboration>
  <bpmn:process id="P" name="P" isExecutable="false">
    <bpmn:laneSet id="LS"><bpmn:lane id="L0" name="Vai trò"><bpmn:flowNodeRef>S</bpmn:flowNodeRef><bpmn:flowNodeRef>T</bpmn:flowNodeRef><bpmn:flowNodeRef>E</bpmn:flowNodeRef></bpmn:lane></bpmn:laneSet>
    <bpmn:startEvent id="S" name="Bắt đầu"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="T" name="Xử lý"><bpmn:incoming>F1</bpmn:incoming><bpmn:outgoing>F2</bpmn:outgoing></bpmn:userTask>
    <bpmn:endEvent id="E" name="Kết thúc"><bpmn:incoming>F2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="T"/>
    <bpmn:sequenceFlow id="F2" sourceRef="T" targetRef="E"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="DI"><bpmndi:BPMNPlane id="PL" bpmnElement="C">
    <bpmndi:BPMNShape id="Pool_di" bpmnElement="Pool" isHorizontal="true"><dc:Bounds x="70" y="90" width="600" height="200"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="L0_di" bpmnElement="L0" isHorizontal="true"><dc:Bounds x="100" y="90" width="570" height="200"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="S_di" bpmnElement="S"><dc:Bounds x="150" y="172" width="36" height="36"/><bpmndi:BPMNLabel><dc:Bounds x="106" y="217" width="124" height="36"/></bpmndi:BPMNLabel></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="T_di" bpmnElement="T"><dc:Bounds x="280" y="153" width="126" height="74"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="E_di" bpmnElement="E"><dc:Bounds x="500" y="172" width="36" height="36"/><bpmndi:BPMNLabel><dc:Bounds x="456" y="217" width="124" height="36"/></bpmndi:BPMNLabel></bpmndi:BPMNShape>
    <bpmndi:BPMNEdge id="F1_di" bpmnElement="F1"><di:waypoint x="186" y="190"/><di:waypoint x="280" y="190"/></bpmndi:BPMNEdge>
    <bpmndi:BPMNEdge id="F2_di" bpmnElement="F2"><di:waypoint x="406" y="190"/><di:waypoint x="500" y="190"/></bpmndi:BPMNEdge>
  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>`;

function variant(name, from, to) {
  assert.ok(BASE.includes(from), `mẫu thử thiếu chuỗi: ${from}`);
  const file = join(dir, name + '.bpmn');
  writeFileSync(file, BASE.replace(from, to));
  return file;
}

test('bố cục hợp lệ thì không báo lỗi', () => {
  const file = join(dir, 'ok.bpmn');
  writeFileSync(file, BASE);
  const {code, out} = run(file);
  assert.deepEqual(out.issues, [], 'không được báo oan trên file sạch');
  assert.equal(code, 0);
});

const CASES = [
  ['label-over-node',   '<dc:Bounds x="456" y="217" width="124" height="36"/>', '<dc:Bounds x="300" y="160" width="124" height="36"/>'],
  ['label-overlap',     '<dc:Bounds x="456" y="217" width="124" height="36"/>', '<dc:Bounds x="120" y="217" width="124" height="36"/>'],
  ['node-overlap',      '<dc:Bounds x="280" y="153" width="126" height="74"/>', '<dc:Bounds x="160" y="153" width="126" height="74"/>'],
  ['node-outside-lane', '<dc:Bounds x="280" y="153" width="126" height="74"/>', '<dc:Bounds x="280" y="250" width="126" height="74"/>'],
  ['edge-through-node', '<di:waypoint x="186" y="190"/><di:waypoint x="280" y="190"/>', '<di:waypoint x="186" y="190"/><di:waypoint x="520" y="190"/><di:waypoint x="280" y="190"/>'],
];

for (const [code, from, to] of CASES) {
  test(`bắt được ${code}`, () => {
    const {out} = run(variant(code, from, to));
    assert.ok(out.issues.some(i => i.code === code),
      `mong đợi mã "${code}", nhận được: ${JSON.stringify(out.issues.map(i => i.code))}`);
  });
}

test('sáu mẫu trong repo đều sạch', () => {
  for (const id of ['purchasing', 'warehouse', 'approval', 'collaboration', 'timer', 'blank']) {
    const f = new URL(`../examples/bpmn/${id}.bpmn`, import.meta.url).pathname;
    assert.deepEqual(run(f).out.issues, [], `${id}.bpmn phải sạch`);
  }
});
