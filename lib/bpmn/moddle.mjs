import {BpmnModdle} from 'bpmn-moddle';
import {moddleExtensions} from './extensions.mjs';
export const createModdle=()=>new BpmnModdle(moddleExtensions);
