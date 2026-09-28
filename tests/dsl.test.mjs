/** DSL phải sinh ra XML qua được cả validate lẫn check-layout, và bắt đúng lỗi nghiệp vụ. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync, readdirSync, writeFileSync, mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {compile} from '../lib/bpmn/dsl.mjs';
import {createModdle} from '../lib/bpmn/moddle.mjs';
import {lintDiagram} from '../lib/bpmn/lint.mjs';

const dir = mkdtempSync(join(tmpdir(), 'dsl-'));
const LAYOUT = fileURLToPath(new URL('../scripts/check-layout.mjs', import.meta.url));
const EXAMPLES = new URL('../examples/dsl/', import.meta.url);

async function clean(text, name) {
  const {xml, findings} = compile(text);
  assert.ok(xml, 'không sinh XML: ' + findings.filter(f => f.severity === 'error').map(f => f.message).join('; '));
  const {rootElement, warnings} = await createModdle().fromXML(xml);
  assert.deepEqual(warnings.map(w => w.message), []);
  assert.deepEqual(await lintDiagram(rootElement), []);
  const file = join(dir, name + '.bpmn');
  writeFileSync(file, xml);
  const out = JSON.parse(execFileSync('node', [LAYOUT, file], {encoding: 'utf8'}));
  assert.deepEqual(out.issues, []);
  return {xml, findings};
}

for (const file of readdirSync(EXAMPLES).filter(f => f.endsWith('.flow'))) {
  test(`ví dụ ${file} qua validate và check-layout`, async () => {
    await clean(readFileSync(new URL(file, EXAMPLES), 'utf8'), file);
  });
}

test('quy trình không lane sinh process trơn, không có collaboration', async () => {
  const {xml} = await clean(`title "Đóng kỳ"
s start "Cuối tháng"
a "Khoá sổ"
g ? "Khớp số?"
b "Điều chỉnh"
e end "Đóng kỳ"
s > a > g
g > e "khớp"
g > b "lệch"
b > a "đã sửa"`, 'plain');
  assert.doesNotMatch(xml, /<bpmn:collaboration/);
  assert.match(xml, /bpmnElement="DongKy"/);
});

test('hai pool có message flow hai chiều', async () => {
  const {xml} = await clean(`title "Đặt hàng"
pool kh "Khách hàng"
lane k "Khách"
pool ct "Công ty"
lane s "Sale"
k: s1 start "Cần hàng"
k: d "Đặt hàng"
k: w msg-in "Nhận xác nhận"
k: e1 end "Xong"
s: s2 start:msg "Có đơn"
s: x send "Xác nhận"
s: e2 end "Đã xác nhận"
s1 > d > w > e1
s2 > x > e2
d => s2 "Đơn hàng"
x => w "Xác nhận"`, 'pools');
  assert.equal((xml.match(/<bpmn:messageFlow /g) || []).length, 2);
  assert.equal((xml.match(/<bpmn:process /g) || []).length, 2);
});

test('tham số @, đánh số bước, | xuống dòng và doc', async () => {
  const {xml} = await clean(`title "Nhắc duyệt"
number on
let han "24 giờ"
lane a "Người duyệt"
lane h "Hệ thống"
a: s start "Nhận yêu cầu"
a: d "Xử lý | phê duyệt" "Duyệt trong @han."
a: t !timer~ on d "Quá @han" PT24H
h: n send "Gửi nhắc"
h: e1 end "Đã nhắc"
a: e2 end "Đã duyệt"
doc n "Email cho người duyệt."
s > d > e2
t > n > e1`, 'params');
  assert.match(xml, /name="01 · Xử lý&#10;phê duyệt"/);
  assert.match(xml, /Duyệt trong 24 giờ\./);
  assert.match(xml, /name="Quá 24 giờ" attachedToRef="d" cancelActivity="false"/);
  assert.match(xml, /<bpmn:timeDuration xsi:type="bpmn:tFormalExpression">PT24H<\/bpmn:timeDuration>/);
  assert.match(xml, /Email cho người duyệt\./);
});

test('lỗi tham chiếu và nối sequence flow qua hai pool thì không sinh XML', () => {
  const {xml, findings} = compile(`title "Lỗi"
pool p "Pool khác"
lane l "L"
s start "A"
l: t "B"
s > t
s > khong_co`);
  assert.equal(xml, null);
  const codes = findings.filter(f => f.severity === 'error').map(f => f.code);
  assert.ok(codes.includes('cross-pool'));
  assert.ok(codes.includes('ref'));
});

test('findings nghiệp vụ: bước không có lane, chuyển giao không nhãn, cổng thiếu nhãn nhánh, song song không gộp', () => {
  const {findings} = compile(`title "Thiếu sót"
lane a "A"
lane b "B"
a: s start "Bắt đầu"
a: t1 "Lập"
b: t2 "Duyệt"
t3 "Ghi sổ"
b: g ? "Duyệt?"
b: f +
a: x "Việc X"
b: y "Việc Y"
a: e end "Xong"
s > t1 > t2 > g
g > t3
g > f "ok"
f > x > e
f > y > e
t3 > e`);
  const codes = new Set(findings.map(f => f.code));
  for (const c of ['no-lane', 'handoff', 'branch-label', 'fork-no-join']) assert.ok(codes.has(c), 'thiếu finding ' + c);
});
