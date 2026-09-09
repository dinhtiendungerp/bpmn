import Linter from 'bpmnlint/lib/linter.js';
import eventBasedGateway from 'bpmnlint/rules/event-based-gateway.js';
import conditionalEvent from 'bpmnlint/rules/conditional-event.js';
import linkEvent from 'bpmnlint/rules/link-event.js';
import subProcessBlank from 'bpmnlint/rules/sub-process-blank-start-event.js';
import eventSubprocess from 'bpmnlint/rules/event-sub-process-typed-start-event.js';
import duplicateFlows from 'bpmnlint/rules/no-duplicate-sequence-flows.js';
import noImplicitSplit from 'bpmnlint/rules/no-implicit-split.js';
import singleBlank from 'bpmnlint/rules/single-blank-start-event.js';
import { validateDefinitions } from './graph.mjs';

const rules = {
  'event-based-gateway':eventBasedGateway, 'conditional-event':conditionalEvent,
  'link-event':linkEvent,'sub-process-blank-start-event':subProcessBlank,
  'event-sub-process-typed-start-event':eventSubprocess,'no-duplicate-sequence-flows':duplicateFlows,
  'no-implicit-split':noImplicitSplit,'single-blank-start-event':singleBlank
};
const linter = new Linter({config:{rules:Object.fromEntries(Object.keys(rules).map(k=>[k,k === 'no-implicit-split' ? 'warn':'error']))},resolver:{resolveRule:(_pkg,name)=>rules[name]}});
export async function lintDiagram(definitions) {
  const issues=validateDefinitions(definitions);
  const results=await linter.lint(definitions);
  for(const [code, reports] of Object.entries(results)) for(const r of reports) issues.push({id:r.id,code,severity:r.category==='error' || r.category==='rule-error' ? 'error':'warning',message:r.message});
  return issues;
}
