// Register one engine descriptor family. Camunda 7 and Zeebe both define
// TemplateSupported.modelerTemplate and cannot share a moddle registry.
// Used by both the browser editor and the CLI so regression tests match production.
import camunda from 'camunda-bpmn-moddle/resources/camunda.json' with { type: 'json' };
export const moddleExtensions = { camunda };
