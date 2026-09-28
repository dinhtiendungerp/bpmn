#!/usr/bin/env node
/** Dịch file DSL (.flow) sang BPMN XML kèm BPMNDI, tự tính bố cục.
 *
 *     node scripts/dsl-to-bpmn.mjs work/nhan-hang.flow [work/nhan-hang.bpmn] [--questions work/cau-hoi.md] [--json]
 *
 * In ra các finding: lỗi chặn (không ghi file), câu hỏi cần làm rõ và gợi ý.
 * Sau đó chạy validate-bpmn, check-layout và render-bpmn như với file viết tay.
 * Cú pháp: docs/DSL.md.
 */
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {compile} from '../lib/bpmn/dsl.mjs';

const args = process.argv.slice(2);
const flag = name => { const i = args.indexOf(name); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const json = args.includes('--json') && args.splice(args.indexOf('--json'), 1);
const questions = flag('--questions');
const [input, outArg] = args;
if (!input) {
  console.error('Usage: node scripts/dsl-to-bpmn.mjs input.flow [output.bpmn] [--questions cau-hoi.md] [--json]');
  process.exit(1);
}
const output = outArg || input.replace(/\.[^./\\]+$/, '') + '.bpmn';

const {xml, findings, model} = compile(await readFile(resolve(input), 'utf8'));
if (xml) {
  await mkdir(dirname(resolve(output)), {recursive: true});
  await writeFile(resolve(output), xml);
}

const groups = [
  ['error', 'LỖI (phải sửa, chưa ghi file)'],
  ['warning', 'CẦN HỎI LẠI'],
  ['info', 'GỢI Ý'],
];
if (json) {
  console.log(JSON.stringify({input, output: xml ? output : null, findings}, null, 2));
} else {
  const nodes = [...model.nodes.values()];
  if (xml) console.log(`Đã ghi ${resolve(output)}: ${model.pools.filter(p => p.rect).length} pool, `
    + `${model.pools.reduce((s, p) => s + p.lanes.length, 0)} lane, ${nodes.length} bước, `
    + `${model.flows.length + model.msgs.length} luồng, khổ ${model.width}×${model.height}.`);
  for (const [sev, title] of groups) {
    const list = findings.filter(f => f.severity === sev);
    if (!list.length) continue;
    console.log(`\n${title} (${list.length})`);
    for (const f of list) console.log(`  - ${f.message}`);
  }
  if (!findings.length) console.log('Không có finding nào.');
}

if (questions) {
  const asks = findings.filter(f => f.severity === 'warning');
  const md = `# Câu hỏi khảo sát: ${model.title}\n\n`
    + (asks.length ? asks.map((f, i) => `${i + 1}. ${f.message}`).join('\n') : '_Không còn câu hỏi mở._')
    + '\n';
  await mkdir(dirname(resolve(questions)), {recursive: true});
  await writeFile(resolve(questions), md);
  if (!json) console.log(`\nĐã ghi ${asks.length} câu hỏi vào ${resolve(questions)}.`);
}
if (!xml) process.exitCode = 1;
