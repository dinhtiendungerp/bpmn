/** DSL văn bản cho BPMN: viết quy trình theo dòng, script tự tính bố cục và sinh BPMN XML kèm BPMNDI.
 *
 * Ba tầng tách riêng để dễ sửa từng phần:
 *   parse()   văn bản → model (pool, lane, bước, luồng)
 *   analyze() model → findings: lỗi cú pháp và các câu hỏi nghiệp vụ còn bỏ ngỏ
 *   layout()  model → toạ độ node, waypoint, nhãn
 *   toXml()   model đã bố cục → BPMN 2.0 XML
 *
 * Cú pháp đầy đủ: docs/DSL.md. Ý tưởng dạng văn bản gọn và "findings" lấy từ
 * hoangpm96/reqwise-figma-mcp (MIT); code viết lại cho BPMN.
 */
import {escapeXml} from './templates.mjs';

// ---------------------------------------------------------------- từ vựng

const TASK = {
  user: 'userTask', service: 'serviceTask', send: 'sendTask', receive: 'receiveTask',
  manual: 'manualTask', script: 'scriptTask', rule: 'businessRuleTask', task: 'task',
  sub: 'subProcess', call: 'callActivity',
};
const GATE = {
  '?': 'exclusiveGateway', xor: 'exclusiveGateway', '+': 'parallelGateway', and: 'parallelGateway',
  o: 'inclusiveGateway', or: 'inclusiveGateway', ev: 'eventBasedGateway',
};
const EVENT = {
  start: ['startEvent'], 'start:timer': ['startEvent', 'timer'], 'start:msg': ['startEvent', 'message'],
  'start:signal': ['startEvent', 'signal'],
  end: ['endEvent'], 'end:msg': ['endEvent', 'message'], 'end:error': ['endEvent', 'error'],
  'end:terminate': ['endEvent', 'terminate'], 'end:signal': ['endEvent', 'signal'],
  'end:escalation': ['endEvent', 'escalation'],
  timer: ['intermediateCatchEvent', 'timer'], 'catch:msg': ['intermediateCatchEvent', 'message'],
  'msg-in': ['intermediateCatchEvent', 'message'], 'throw:msg': ['intermediateThrowEvent', 'message'],
  'msg-out': ['intermediateThrowEvent', 'message'], 'catch:signal': ['intermediateCatchEvent', 'signal'],
  'throw:signal': ['intermediateThrowEvent', 'signal'], event: ['intermediateThrowEvent'],
};
const BOUNDARY = {'!timer': 'timer', '!msg': 'message', '!error': 'error', '!signal': 'signal', '!escalation': 'escalation'};
const ARROWS = {'>': 'seq', '->': 'seq', '~>': 'rework', '=>': 'msg'};
const ID_RE = /^[A-Za-z_][\w-]*$/;

const isEvent = t => t.endsWith('Event');
const isGateway = t => t.endsWith('Gateway');
const isActivity = t => !isEvent(t) && !isGateway(t);
const isSplitChoice = n => (n.type === 'exclusiveGateway' || n.type === 'inclusiveGateway') && n.out.length > 1;

// ---------------------------------------------------------------- parse

function tokenize(line) {
  const out = [];
  for (let i = 0; i < line.length;) {
    const c = line[i];
    if (c === ' ' || c === '\t') { i++; continue; }
    if (c === '#') break;
    if (c === '"') {
      const j = line.indexOf('"', i + 1);
      if (j < 0) throw new Error('thiếu dấu " đóng');
      out.push({q: true, v: line.slice(i + 1, j)});
      i = j + 1;
      continue;
    }
    let j = i;
    while (j < line.length && !/\s/.test(line[j]) && line[j] !== '"') j++;
    out.push({q: false, v: line.slice(i, j)});
    i = j;
  }
  return out;
}

const slugId = s => {
  const ascii = s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
  const id = ascii.split(/[^A-Za-z0-9]+/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join('');
  return /^[A-Za-z]/.test(id) ? id : 'P' + id;
};

/** Văn bản DSL → model thô. Lỗi từng dòng được ghi vào findings, không dừng giữa chừng. */
export function parse(text) {
  const m = {
    title: '', id: '', number: false, policies: new Map(), findings: [],
    pools: [], lanes: new Map(), nodes: new Map(), flows: [], msgs: [], docs: [],
  };
  const err = (line, code, message) => m.findings.push({severity: 'error', code, line, message});
  const main = {key: '_main', name: '', lanes: [], main: true};
  m.pools.push(main);
  let pool = main;

  text.split(/\r?\n/).forEach((raw, i) => {
    const ln = i + 1;
    let line = raw;
    if (!/^\s*let\s/.test(line)) {
      line = line.replace(/@([A-Za-z_][\w-]*)/g, (all, key) => {
        if (m.policies.has(key)) return m.policies.get(key);
        err(ln, 'policy', `Chưa khai báo tham số @${key}. Thêm dòng: let ${key} "giá trị"`);
        return all;
      });
    }
    let t;
    try { t = tokenize(line); } catch (e) { return err(ln, 'syntax', `Dòng ${ln}: ${e.message}.`); }
    if (!t.length) return;
    const head = t[0].q ? '' : t[0].v;
    const rest = t.slice(1);
    const str = () => rest.map(x => x.v).join(' ');

    if (head === 'title') { m.title = str(); return; }
    if (head === 'id') {
      if (!ID_RE.test(str())) return err(ln, 'syntax', `Dòng ${ln}: id quy trình "${str()}" chỉ được gồm chữ không dấu, số, _ và -.`);
      m.id = str(); return;
    }
    if (head === 'number') { m.number = !/^(off|no|0|false)$/i.test(str()); return; }
    if (head === 'let') {
      const [k, ...v] = rest;
      if (!k || !ID_RE.test(k.v) || !v.length) return err(ln, 'syntax', `Dòng ${ln}: cú pháp là  let <tên> "giá trị".`);
      m.policies.set(k.v, v.map(x => x.v).join(' '));
      return;
    }
    if (head === 'pool') {
      const [k, name] = rest;
      if (!k || !ID_RE.test(k.v)) return err(ln, 'syntax', `Dòng ${ln}: cú pháp là  pool <mã> "Tên pool".`);
      if (m.pools.some(p => p.key === k.v) || m.lanes.has(k.v)) return err(ln, 'dup', `Dòng ${ln}: mã "${k.v}" đã dùng.`);
      pool = {key: k.v, name: name?.v || k.v, lanes: [], line: ln};
      m.pools.push(pool);
      return;
    }
    if (head === 'lane') {
      const [k, name, kwIn, poolKey] = rest;
      if (!k || !ID_RE.test(k.v)) return err(ln, 'syntax', `Dòng ${ln}: cú pháp là  lane <mã> "Tên vai trò".`);
      if (m.lanes.has(k.v) || m.pools.some(p => p.key === k.v)) return err(ln, 'dup', `Dòng ${ln}: mã "${k.v}" đã dùng.`);
      let owner = pool;
      if (kwIn?.v === 'in') {
        owner = m.pools.find(p => p.key === poolKey?.v);
        if (!owner) return err(ln, 'ref', `Dòng ${ln}: không có pool "${poolKey?.v}".`);
      }
      const lane = {key: k.v, name: name?.v || k.v, pool: owner, line: ln};
      owner.lanes.push(lane);
      m.lanes.set(k.v, lane);
      return;
    }
    if (head === 'doc') {
      const [k, ...v] = rest;
      if (!k || !v.length) return err(ln, 'syntax', `Dòng ${ln}: cú pháp là  doc <mã bước> "mô tả".`);
      m.docs.push({id: k.v, text: v.map(x => x.v).join(' '), line: ln});
      return;
    }
    if (t.some(x => !x.q && ARROWS[x.v])) return parseEdges(m, t, ln, err);
    parseNode(m, t, ln, err);
  });

  m.title ||= 'Quy trình';
  m.id ||= slugId(m.title);
  main.name = m.title;
  return m;
}

function parseNode(m, t, ln, err) {
  let i = 0, owner = null;
  if (!t[0].q && t[0].v.endsWith(':') && t[0].v.length > 1) { owner = t[0].v.slice(0, -1); i = 1; }
  const idTok = t[i++];
  if (!idTok || idTok.q || !ID_RE.test(idTok.v))
    return err(ln, 'syntax', `Dòng ${ln}: thiếu mã bước hoặc mã không hợp lệ ("${idTok?.v ?? ''}"). Mã chỉ gồm chữ không dấu, số, _ và - (vd: kho: nhan "Nhận hàng").`);
  if (m.nodes.has(idTok.v)) return err(ln, 'dup', `Dòng ${ln}: mã bước "${idTok.v}" đã khai báo ở dòng ${m.nodes.get(idTok.v).line}.`);

  const n = {id: idTok.v, owner, line: ln, idx: m.nodes.size, type: 'userTask', def: null, name: '', doc: '',
    hostId: null, interrupting: true, timer: null, out: [], in: []};
  const kind = t[i] && !t[i].q ? t[i].v : null;
  if (kind != null) {
    const b = kind.replace(/~$/, '');
    if (TASK[kind]) n.type = TASK[kind];
    else if (GATE[kind]) n.type = GATE[kind];
    else if (EVENT[kind]) [n.type, n.def] = EVENT[kind];
    else if (BOUNDARY[b]) { n.type = 'boundaryEvent'; n.def = BOUNDARY[b]; n.interrupting = !kind.endsWith('~'); }
    else return err(ln, 'syntax', `Dòng ${ln}: không hiểu loại bước "${kind}". Xem bảng loại bước trong docs/DSL.md.`);
    i++;
  }
  const quoted = [];
  for (; i < t.length; i++) {
    const x = t[i];
    if (x.q) { quoted.push(x.v); continue; }
    if (x.v === 'on') { n.hostId = t[++i]?.v ?? null; continue; }
    if (x.v === 'doc') { if (t[i + 1]?.q) n.doc = t[++i].v; continue; }
    if (/^(R\d*\/)?P(T?\d)/.test(x.v) || /^\d{4}-\d\d-\d\d/.test(x.v)) { n.timer = x.v; continue; }
    return err(ln, 'syntax', `Dòng ${ln}: không hiểu "${x.v}".`);
  }
  n.name = (quoted[0] ?? '').replace(/\s*\|\s*/g, '\n');
  if (quoted[1]) n.doc = quoted.slice(1).join('\n');
  m.nodes.set(n.id, n);
}

function parseEdges(m, t, ln, err) {
  let prev = null, cur = null;
  for (let i = 0; i < t.length; i++) {
    const x = t[i];
    if (!x.q && ARROWS[x.v]) {
      if (!prev) return err(ln, 'syntax', `Dòng ${ln}: mũi tên "${x.v}" thiếu bước nguồn.`);
      const to = t[++i];
      if (!to || to.q) return err(ln, 'syntax', `Dòng ${ln}: mũi tên "${x.v}" thiếu bước đích.`);
      cur = {from: prev, to: to.v, kind: ARROWS[x.v], name: '', cond: null, isDefault: false, line: ln};
      (cur.kind === 'msg' ? m.msgs : m.flows).push(cur);
      prev = to.v;
      continue;
    }
    if (!cur && !prev && !x.q) { prev = x.v; continue; }
    if (!cur) return err(ln, 'syntax', `Dòng ${ln}: không hiểu "${x.v}".`);
    if (x.q) { cur.name = x.v.replace(/\s*\|\s*/g, '\n'); continue; }
    if (x.v === 'if' && t[i + 1]?.q) { cur.cond = t[++i].v; continue; }
    if (x.v === 'default') { cur.isDefault = true; continue; }
    return err(ln, 'syntax', `Dòng ${ln}: không hiểu "${x.v}" sau mũi tên.`);
  }
}

// ---------------------------------------------------------------- resolve + analyze

/** Nối tham chiếu, gán lane, rồi soi nội dung nghiệp vụ. Trả về model đã sẵn sàng bố cục. */
export function analyze(m) {
  const F = m.findings;
  const add = (severity, code, message, ref = {}) => F.push({severity, code, message, ...ref});
  const nodes = [...m.nodes.values()];
  const poolByKey = new Map(m.pools.map(p => [p.key, p]));

  for (const d of m.docs) {
    const n = m.nodes.get(d.id);
    if (!n) add('error', 'ref', `Dòng ${d.line}: doc cho bước "${d.id}" chưa khai báo.`, {line: d.line});
    else n.doc = n.doc ? n.doc + '\n' + d.text : d.text;
  }

  // Boundary lấy chủ của nó trước, vì lane của boundary là lane của activity chủ.
  for (const n of nodes.filter(n => n.type === 'boundaryEvent')) {
    const host = m.nodes.get(n.hostId);
    if (!n.hostId) add('error', 'boundary', `Dòng ${n.line}: sự kiện biên "${n.id}" phải gắn vào một bước: thêm  on <mã bước>.`, {id: n.id});
    else if (!host) add('error', 'ref', `Dòng ${n.line}: "${n.id}" gắn vào bước "${n.hostId}" chưa khai báo.`, {id: n.id});
    else if (!isActivity(host.type)) add('error', 'boundary', `Dòng ${n.line}: "${n.id}" chỉ gắn được vào task/subprocess, "${host.id}" là ${host.type}.`, {id: n.id});
    else { n.host = host; (host.boundaries ||= []).push(n); }
    if (n.def === 'error' && !n.interrupting) add('error', 'boundary', `Dòng ${n.line}: sự kiện lỗi luôn ngắt bước chủ, bỏ dấu ~.`, {id: n.id});
  }

  const unassigned = new Map();
  for (const n of nodes) {
    if (n.host) { n.ownerLane = null; continue; }
    const lane = n.owner && m.lanes.get(n.owner);
    let p = lane ? lane.pool : n.owner ? poolByKey.get(n.owner) : m.pools[0];
    if (n.owner && !lane && !p) {
      add('error', 'ref', `Dòng ${n.line}: "${n.owner}:" không phải lane hay pool nào đã khai báo.`, {id: n.id});
      p = m.pools[0];
    }
    n.pool = p;
    n.lane = lane || null;
    if (!lane && p.lanes.length) {
      add('warning', 'no-lane', `Bước "${label(n)}" chưa có người phụ trách. Ai làm bước này?`, {id: n.id});
      if (!unassigned.has(p)) unassigned.set(p, {key: '_none_' + p.key, name: '(Chưa rõ ai làm)', pool: p});
      n.lane = unassigned.get(p);
    }
  }
  for (const [p, lane] of unassigned) p.lanes.push(lane);
  for (const n of nodes.filter(n => n.host)) { n.pool = n.host.pool; n.lane = n.host.lane; }

  for (const p of m.pools) p.nodes = nodes.filter(n => n.pool === p);
  for (const p of m.pools.slice(1)) if (!p.nodes.length && p.lanes.length) {
    add('warning', 'empty-pool', `Pool "${p.name}" có lane nhưng chưa có bước nào.`);
  }
  if (!nodes.length) add('error', 'empty', 'Chưa có bước nào trong quy trình.');

  // Luồng
  const resolve = (f, what) => {
    const a = m.nodes.get(f.from), b = m.nodes.get(f.to);
    if (!a) add('error', 'ref', `Dòng ${f.line}: ${what} từ "${f.from}" nhưng bước này chưa khai báo.`, {line: f.line});
    if (!b) add('error', 'ref', `Dòng ${f.line}: ${what} tới "${f.to}" nhưng bước này chưa khai báo.`, {line: f.line});
    return [a, b];
  };
  m.flows = m.flows.filter(f => {
    const [a, b] = resolve(f, 'luồng');
    if (!a || !b) return false;
    f.src = a; f.tgt = b; f.rework = f.kind === 'rework';
    if (a.pool !== b.pool) { add('error', 'cross-pool', `Dòng ${f.line}: "${a.id}" và "${b.id}" ở hai pool khác nhau, nối bằng => (message flow) chứ không dùng >.`, {line: f.line}); return false; }
    if (b.type === 'startEvent') add('error', 'start-incoming', `Dòng ${f.line}: không được có luồng đi vào sự kiện bắt đầu "${label(b)}".`, {line: f.line});
    if (a.type === 'endEvent') add('error', 'end-outgoing', `Dòng ${f.line}: không được có luồng đi ra từ sự kiện kết thúc "${label(a)}".`, {line: f.line});
    if (b.type === 'boundaryEvent') add('error', 'boundary-incoming', `Dòng ${f.line}: không được có luồng đi vào sự kiện biên "${label(b)}".`, {line: f.line});
    a.out.push(f); b.in.push(f);
    return true;
  });
  const endpoint = key => m.nodes.get(key) ? {node: m.nodes.get(key)} : poolByKey.get(key) && !poolByKey.get(key).main ? {pool: poolByKey.get(key)} : null;
  m.msgs = m.msgs.filter(f => {
    const a = endpoint(f.from), b = endpoint(f.to);
    if (!a) add('error', 'ref', `Dòng ${f.line}: message flow từ "${f.from}" nhưng không có bước hay pool nào tên này.`, {line: f.line});
    if (!b) add('error', 'ref', `Dòng ${f.line}: message flow tới "${f.to}" nhưng không có bước hay pool nào tên này.`, {line: f.line});
    if (!a || !b) return false;
    const pa = a.pool || a.node.pool, pb = b.pool || b.node.pool;
    if (pa === pb) { add('error', 'msg-scope', `Dòng ${f.line}: message flow phải nối hai pool khác nhau; trong cùng pool dùng >.`, {line: f.line}); return false; }
    if ((a.pool && a.pool.nodes.length) || (b.pool && b.pool.nodes.length))
      add('warning', 'msg-pool', `Dòng ${f.line}: pool "${(a.pool || b.pool).name}" đã có bước bên trong, nên nối message flow vào bước cụ thể.`, {line: f.line});
    f.a = a; f.b = b; f.pa = pa; f.pb = pb;
    if (!f.name) add('warning', 'msg-name', `Message flow ${f.from} => ${f.to} chưa ghi tên thông điệp. Cái gì được gửi đi?`, {line: f.line});
    return true;
  });

  // Nội dung nghiệp vụ
  for (const p of m.pools.filter(p => p.nodes.length)) {
    const where = m.pools.length > 1 ? ` trong pool "${p.name}"` : '';
    if (!p.nodes.some(n => n.type === 'startEvent')) add('warning', 'no-start', `Chưa có sự kiện bắt đầu${where}. Điều gì kích hoạt quy trình?`);
    if (!p.nodes.some(n => n.type === 'endEvent')) add('warning', 'no-end', `Chưa có sự kiện kết thúc${where}. Quy trình kết thúc với kết quả gì?`);
    for (const lane of p.lanes) if (!p.nodes.some(n => n.lane === lane))
      add('warning', 'empty-lane', `Lane "${lane.name}" không có bước nào. Vai trò này có thật sự tham gia không?`);
  }

  for (const n of nodes) {
    const ref = {id: n.id};
    const outs = n.out.filter(f => !f.rework).concat(n.out.filter(f => f.rework));
    if (n.type !== 'endEvent' && !n.out.length) add('warning', 'dead-end', `Sau bước "${label(n)}" thì sao? Bước này không có lối ra.`, ref);
    if (!['startEvent', 'boundaryEvent'].includes(n.type) && !n.in.length && !m.msgs.some(f => f.b.node === n))
      add('warning', 'no-incoming', `Bước "${label(n)}" không có luồng đi vào. Nó bắt đầu từ đâu?`, ref);
    if (isActivity(n.type) && !n.name.trim()) add('warning', 'name', `Bước "${n.id}" chưa có tên.`, ref);
    if (n.def === 'timer' && !n.timer) add('warning', 'timer', `Sự kiện hẹn giờ "${label(n)}" chưa có thời hạn (vd PT48H, P2D). Bao lâu?`, ref);

    if (isActivity(n.type) && n.out.filter(f => !f.rework).length > 1)
      add('warning', 'implicit-split', `Bước "${label(n)}" có nhiều lối ra mà không có cổng. Các nhánh chạy song song hay chỉ chọn một? Thêm cổng ? hoặc +.`, ref);

    if (n.type === 'exclusiveGateway' || n.type === 'inclusiveGateway') {
      if (n.out.length === 1 && n.in.length <= 1) add('warning', 'one-way', `Cổng "${label(n)}" chỉ có một lối ra. Còn trường hợp nào khác?`, ref);
      if (n.out.length > 1) {
        if (n.in.length > 1) add('info', 'mixed-gateway', `Cổng "${label(n)}" vừa gộp vừa tách. Nên tách thành hai cổng cho dễ đọc.`, ref);
        if (n.name && !/\?\s*$/.test(n.name)) add('info', 'gateway-question', `Cổng "${label(n)}" nên đặt tên là một câu hỏi, vd "Đủ hàng?".`, ref);
        if (!n.name.trim()) add('warning', 'gateway-name', `Cổng rẽ nhánh "${n.id}" chưa có câu hỏi. Quyết định dựa trên điều gì?`, ref);
        for (const f of outs) if (!f.name.trim())
          add('warning', 'branch-label', `Nhánh từ "${label(n)}" sang "${label(f.tgt)}" chưa ghi điều kiện. Khi nào đi nhánh này?`, {line: f.line});
        const defs = n.out.filter(f => f.isDefault);
        if (defs.length > 1) add('error', 'default', `Cổng "${label(n)}" có ${defs.length} nhánh default, chỉ được một.`, ref);
        if (!defs.length) {
          const last = outs[outs.length - 1];
          last.isDefault = true;
          add('info', 'auto-default', `Cổng "${label(n)}": lấy nhánh "${last.name || label(last.tgt)}" làm nhánh mặc định (trường hợp còn lại). Ghi default vào nhánh khác nếu không đúng.`, ref);
        }
        for (const f of n.out) if (!f.isDefault && !f.cond) f.cond = f.name.replace(/\n/g, ' ') || label(f.tgt);
      }
    }
    if (n.type === 'parallelGateway') {
      for (const f of n.out) if (f.cond || f.isDefault) add('error', 'parallel-condition', `Dòng ${f.line}: nhánh ra từ cổng song song "${label(n)}" không dùng điều kiện hay default.`, {line: f.line});
      if (n.out.length > 1 && !findJoin(n, 'parallelGateway'))
        add('warning', 'fork-no-join', `Các việc song song sau "${label(n)}" không gặp nhau ở cổng + nào. Có cần chờ tất cả xong rồi mới đi tiếp không?`, ref);
    }
    if (n.type === 'inclusiveGateway' && n.out.length > 1 && !findJoin(n, 'inclusiveGateway'))
      add('info', 'or-no-join', `Nhánh của cổng "${label(n)}" không gộp lại ở cổng o nào.`, ref);
    for (const f of n.out) {
      if ((f.cond || f.isDefault) && !isSplitChoice(n) && n.type !== 'parallelGateway')
        add('warning', 'condition-ignored', `Dòng ${f.line}: điều kiện/default chỉ có nghĩa trên nhánh ra của cổng ? hoặc o; bỏ qua.`, {line: f.line});
    }
  }
  for (const n of nodes) if (!isSplitChoice(n)) for (const f of n.out) { f.cond = null; f.isDefault = false; }

  // Chuyển giao giữa hai lane mà không nói chuyển cái gì: đúng loại lỗ hổng diagram này để lộ ra.
  for (const f of m.flows) {
    const la = f.src.lane, lb = f.tgt.lane;
    if (la && lb && la !== lb && la.pool && lb.pool && !la.key.startsWith('_none_') && !lb.key.startsWith('_none_') && !f.name.trim() && isActivity(f.src.type) && isActivity(f.tgt.type))
      add('warning', 'handoff', `"${label(f.src)}" (${la.name}) chuyển sang "${label(f.tgt)}" (${lb.name}): chuyển giao cái gì? Ghi nhãn cho luồng.`, {line: f.line});
  }

  // Đi tới được từ sự kiện kích hoạt
  const seen = new Set();
  const queue = nodes.filter(n => n.type === 'startEvent' || n.type === 'boundaryEvent' || m.msgs.some(f => f.b.node === n && !n.in.length));
  while (queue.length) {
    const n = queue.shift();
    if (seen.has(n)) continue;
    seen.add(n);
    for (const f of n.out) queue.push(f.tgt);
  }
  for (const n of nodes) if (!seen.has(n) && n.in.length)
    add('warning', 'unreachable', `Không có đường nào từ sự kiện bắt đầu tới "${label(n)}".`, {id: n.id});

  const main = m.pools.filter(p => p.nodes.length);
  const hasChoice = nodes.some(n => isSplitChoice(n) || n.type === 'boundaryEvent' || n.type === 'eventBasedGateway');
  if (main.length && !hasChoice)
    add('info', 'happy-only', 'Quy trình chỉ có luồng thuận lợi. Nếu bị từ chối, thiếu hàng, sai chứng từ hay quá hạn thì xử lý thế nào?');
  const acts = nodes.filter(n => isActivity(n.type)).length;
  if (acts > 25) add('info', 'too-long', `Quy trình có ${acts} bước, sơ đồ sẽ rất dài. Cân nhắc tách thành các quy trình con (loại call hoặc sub).`);
  const noDoc = nodes.filter(n => isActivity(n.type) && !n.doc.trim());
  if (noDoc.length) add('info', 'no-doc', `${noDoc.length}/${nodes.filter(n => isActivity(n.type)).length} bước chưa có mô tả (doc), Passport khi bấm vào sẽ trống.`);

  if (m.number) {
    const acts = nodes.filter(n => isActivity(n.type));
    m.numbered = acts;   // thứ tự thật tính sau khi bố cục
  }
  return m;
}

function findJoin(fork, type) {
  const reach = f => {
    const seen = new Set(), q = [f.tgt];
    while (q.length) {
      const n = q.shift();
      if (seen.has(n)) continue;
      seen.add(n);
      for (const g of n.out) if (!g.rework) q.push(g.tgt);
    }
    return seen;
  };
  const sets = fork.out.map(reach);
  return [...sets[0]].find(n => n !== fork && n.type === type && n.in.length > 1 && sets.every(s => s.has(n)));
}

const label = n => (n.name || n.id).replace(/\n/g, ' ');

// ---------------------------------------------------------------- layout

const BAND = 160;            // chiều cao một hàng trong lane
const POOL_X = 70, LANE_X = 100, COL0 = 190, POOL_GAP = 80, BLACKBOX_H = 70;
const TASK_W = 130, TASK_W_LONG = 160, TASK_H = 80;

const sizeOf = n => isEvent(n.type) ? [36, 36] : isGateway(n.type) ? [50, 50]
  : [[...n.name].length > 55 ? TASK_W_LONG : TASK_W, TASK_H];

/** Ước lượng khung chữ của nhãn ngoài (font ~11px của bpmn-js). */
function textBox(text, maxW) {
  const lines = text.split('\n');
  const longest = Math.max(...lines.map(l => [...l].length));
  const w = Math.min(maxW, Math.max(28, Math.ceil(longest * 6.1) + 10));
  const rows = lines.reduce((s, l) => s + Math.max(1, Math.ceil([...l].length * 6.1 / (w - 10))), 0);
  return {w, h: rows * 14 + 4};
}

const R = (x, y, w, h) => ({x, y, w, h});
const overlap = (a, b, tol = 1) =>
  Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > tol && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > tol;
const inside = (outer, r) => r.x >= outer.x && r.y >= outer.y && r.x + r.w <= outer.x + outer.w && r.y + r.h <= outer.y + outer.h;
const inflate = (r, d) => R(r.x - d, r.y - d, r.w + 2 * d, r.h + 2 * d);

/** Đoạn thẳng ngang/dọc có cắt hình chữ nhật không. */
function segHits(a, b, r) {
  if (a.y === b.y) {
    const [x1, x2] = a.x < b.x ? [a.x, b.x] : [b.x, a.x];
    return a.y > r.y && a.y < r.y + r.h && x2 > r.x && x1 < r.x + r.w;
  }
  const [y1, y2] = a.y < b.y ? [a.y, b.y] : [b.y, a.y];
  return a.x > r.x && a.x < r.x + r.w && y2 > r.y && y1 < r.y + r.h;
}

/** Tính rank (cột), hàng trong lane, toạ độ node, waypoint và nhãn. Ghi thẳng vào model. */
export function layout(m) {
  const nodes = [...m.nodes.values()];
  const main = nodes.filter(n => !n.host);
  const key = n => n.host || n;

  // 1. Cột: đường dài nhất trên đồ thị đã bỏ cạnh quay lui.
  const edges = [];
  for (const f of m.flows) edges.push({from: key(f.src), to: f.tgt, min: 1, f, back: f.rework});
  for (const f of m.msgs) if (f.a.node && f.b.node) edges.push({from: key(f.a.node), to: key(f.b.node), min: 0, msg: f});
  const outOf = new Map(nodes.map(n => [n, []]));
  for (const e of edges) if (!e.back) outOf.get(e.from).push(e);
  const state = new Map();
  const visit = n => {
    state.set(n, 1);
    for (const e of outOf.get(n)) {
      const s = state.get(e.to);
      if (s === 1) e.back = true;
      else if (!s) visit(e.to);
    }
    state.set(n, 2);
  };
  for (const n of [...main.filter(n => n.type === 'startEvent'), ...main]) if (!state.get(n)) visit(n);
  for (const e of edges) if (e.back && e.f) e.f.back = true;

  const dag = edges.filter(e => !e.back);
  const indeg = new Map(main.map(n => [n, 0]));
  for (const e of dag) indeg.set(e.to, indeg.get(e.to) + 1);
  const col = new Map(main.map(n => [n, 0]));
  const queue = main.filter(n => indeg.get(n) === 0);
  while (queue.length) {
    const n = queue.shift();
    for (const e of dag) if (e.from === n) {
      col.set(e.to, Math.max(col.get(e.to), col.get(n) + e.min));
      indeg.set(e.to, indeg.get(e.to) - 1);
      if (indeg.get(e.to) === 0) queue.push(e.to);
    }
  }
  for (const n of nodes) n.col = col.get(key(n));

  // 2. Hàng trong lane: bước tiếp nối chính giữ nguyên hàng của bước trước, nhánh phụ xuống hàng dưới.
  const primary = new Map();
  for (const n of nodes) {
    const f = n.out.find(f => !f.back && !f.rework);
    if (f && !primary.has(f.tgt)) primary.set(f.tgt, n);
  }
  const laneKey = n => n.lane || n.pool;
  const laneName = n => { const l = laneKey(n); return (l.pool ? l.pool.key + '/' : '') + l.key; };
  const occupied = new Map();
  const taken = (l, c) => { if (!occupied.has(l)) occupied.set(l, new Map()); const lm = occupied.get(l); if (!lm.has(c)) lm.set(c, new Set()); return lm.get(c); };
  const rowOf = p => p.host ? p.host.row + 1 : p.row;
  const order = [...main].sort((a, b) => a.col - b.col
    || (primary.has(a) && laneKey(key(primary.get(a))) === laneKey(a) ? 0 : 1) - (primary.has(b) && laneKey(key(primary.get(b))) === laneKey(b) ? 0 : 1)
    || a.idx - b.idx);
  const load = new Map();
  for (const n of main) { const k = laneName(n) + '|' + n.col; load.set(k, (load.get(k) || 0) + 1); }
  for (const n of order) {
    const same = p => laneKey(key(p)) === laneKey(n) && key(p).row != null;
    const pp = primary.get(n);
    let want = 0;
    if (pp && same(pp)) want = rowOf(pp);
    else {
      const preds = n.in.filter(f => !f.back && !f.rework).map(f => f.src).filter(same);
      if (preds.length) want = Math.min(...preds.map(rowOf));
    }
    const used = taken(laneKey(n), n.col);
    // Bước cuối (không có lối ra) mà ô mong muốn đã có người: dời sang cột kế nếu lane đó trống,
    // đỡ phải nới lane thêm một hàng chỉ vì một sự kiện kết thúc.
    if (used.has(want) && !n.out.length && !(n.boundaries || []).length) {
      for (const c of [n.col + 1, n.col + 2]) {
        if (!load.get(laneName(n) + '|' + c) && !taken(laneKey(n), c).has(want)) { n.col = c; break; }
      }
    }
    const slot = taken(laneKey(n), n.col);
    let r = want;
    while (slot.has(r)) r++;
    slot.add(r);
    n.row = r;
  }
  const ncol = Math.max(0, ...main.map(n => n.col)) + 1;
  for (const n of nodes.filter(n => n.host)) n.col = n.host.col;

  // Đánh số bước theo thứ tự đọc: cột, pool, lane, hàng.
  if (m.number) {
    const poolIdx = p => m.pools.indexOf(p);
    const laneIdx = n => n.lane ? n.pool.lanes.indexOf(n.lane) : 0;
    [...m.numbered].sort((a, b) => a.col - b.col || poolIdx(a.pool) - poolIdx(b.pool) || laneIdx(a) - laneIdx(b) || a.row - b.row)
      .forEach((n, i) => { n.name = `${String(i + 1).padStart(2, '0')} · ${n.name}`; });
  }
  // 3. Kích thước, cột và lane.
  for (const n of nodes) {
    [n.w, n.h] = sizeOf(n);
    if (isEvent(n.type) || isGateway(n.type)) n.lbl = n.name.trim() ? textBox(n.name, 124) : null;
  }
  const fw = Array.from({length: ncol}, (_, c) => Math.max(36, ...main.filter(n => n.col === c)
    .map(n => Math.max(n.w, n.lbl ? Math.round(n.lbl.w * 0.75) : 0))));
  const gap = Array.from({length: ncol}, (_, c) => {
    const named = m.flows.some(f => f.name && key(f.src).col === c);
    return named ? 120 : 64;
  });
  const colX = [];
  for (let c = 0, x = COL0; c < ncol; c++) { colX.push(x); x += fw[c] + gap[c]; }

  let y = 90;
  const drawnPools = m.pools.filter(p => p.nodes.length || !p.main);
  m.hasCollab = drawnPools.length > 1 || m.pools.some(p => p.lanes.length);
  for (const p of drawnPools) {
    p.y = y;
    p.blackbox = !p.nodes.length;
    if (p.blackbox) { p.h = BLACKBOX_H; y += p.h + POOL_GAP; continue; }
    const tracks = p.lanes.length ? p.lanes : [p];
    for (const t of tracks) {
      const rows = Math.max(1, ...p.nodes.filter(n => !n.host && laneKey(n) === t).map(n => n.row + 1));
      t.ly = y; t.lh = rows * BAND;
      y += t.lh;
    }
    p.h = y - p.y;
    y += POOL_GAP;
  }
  for (const n of main) {
    const t = laneKey(n);
    const cx = colX[n.col] + fw[n.col] / 2, cy = t.ly + n.row * BAND + BAND / 2;
    n.x = Math.round(cx - n.w / 2); n.y = Math.round(cy - n.h / 2);
  }
  for (const n of nodes.filter(n => n.host)) {
    const i = n.host.boundaries.indexOf(n);
    n.x = n.host.x + n.host.w - 30 - i * 44 - 18;
    n.y = n.host.y + n.host.h - 18;
  }
  const right = Math.max(...main.map(n => n.x + n.w), colX[ncol - 1] + fw[ncol - 1]) + 70;
  m.width = right - POOL_X;
  for (const p of drawnPools) {
    p.rect = R(POOL_X, p.y, m.width, p.h);
    for (const l of p.lanes) l.rect = R(LANE_X, l.ly, m.width - (LANE_X - POOL_X), l.lh);
    if (!p.lanes.length && !p.blackbox) p.rect.track = R(p.main && !m.hasCollab ? POOL_X : LANE_X, p.ly, m.width, p.lh);
  }
  m.height = y - POOL_GAP - 90;

  // 4. Đường nối: thử các hình dạng vuông góc, chọn đường ngắn nhất không cắt node.
  const obstacles = nodes.map(n => ({n, r: R(n.x, n.y, n.w, n.h)}));
  const routed = [];
  const xs = new Set();
  for (let c = 0; c < ncol; c++) {
    xs.add(Math.round(colX[c] + fw[c] + gap[c] / 2));
    xs.add(Math.round(colX[c] - 24));
  }
  const bandYs = p => {
    const out = [];
    for (const t of p.lanes.length ? p.lanes : [p]) for (let r = 0; r * BAND < t.lh; r++) {
      out.push(t.ly + r * BAND + 12, t.ly + (r + 1) * BAND - 12);
    }
    return out;
  };
  const poolGapYs = drawnPools.slice(0, -1).map(p => p.y + p.h + POOL_GAP / 2);
  const portUse = new Map();

  const portsOf = (n, dir) => {
    const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
    const cost = isGateway(n.type) ? [0, 0, 0] : isEvent(n.type) ? [0, 40, 40] : [0, 55, 55];
    if (dir === 'out') {
      if (n.type === 'boundaryEvent') return [{x: cx, y: n.y + n.h, d: 'S', c: 0, k: 'B'}];
      return [{x: n.x + n.w, y: cy, d: 'E', c: cost[0], k: 'R'}, {x: cx, y: n.y + n.h, d: 'S', c: cost[1], k: 'B'}, {x: cx, y: n.y, d: 'N', c: cost[2], k: 'T'}];
    }
    const ic = isGateway(n.type) ? [0, 15, 15] : cost;
    return [{x: n.x, y: cy, d: 'E', c: ic[0], k: 'L'}, {x: cx, y: n.y, d: 'S', c: ic[1], k: 'T'}, {x: cx, y: n.y + n.h, d: 'N', c: ic[2], k: 'B'}];
  };

  const route = (src, tgt, P0, Q0, ys, extraObs = []) => {
    let best = null;
    for (const P of P0) for (const Q of Q0) {
      for (const pts of shapes(P, Q, [...xs, Q.x - 24, P.x + 24], ys)) {
        const path = simplify(pts);
        if (!validPath(path, P, Q)) continue;
        let cost = P.c + Q.c + (path.length - 2) * 28;
        for (let i = 0; i < path.length - 1; i++) {
          const a = path[i], b = path[i + 1];
          cost += Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
          for (const o of obstacles) {
            const own = o.n === src || o.n === tgt;
            if (own && (i === 0 || i === path.length - 2)) continue;
            if (own && o.n.host && (o.n === src)) continue;
            if (segHits(a, b, own ? o.r : inflate(o.r, 6))) cost += 5000;
          }
          for (const r of extraObs) if (segHits(a, b, r)) cost += 5000;
          for (const e of routed) for (let j = 0; j < e.length - 1; j++) cost += segClash(a, b, e[j], e[j + 1]);
        }
        const used = (portUse.get(src)?.[P.k] || 0) + (portUse.get(tgt)?.['in' + Q.k] || 0);
        cost += used * (gw(src) || gw(tgt) ? 70 : 12);
        if (!best || cost < best.cost) best = {cost, path, P, Q};
      }
    }
    return best;
  };

  const flows = [...m.flows].sort((a, b) => (a.back ? 1 : 0) - (b.back ? 1 : 0)
    || Math.abs(key(a.tgt).col - key(a.src).col) - Math.abs(key(b.tgt).col - key(b.src).col) || a.line - b.line);
  for (const f of flows) {
    const best = route(f.src, f.tgt, portsOf(f.src, 'out'), portsOf(f.tgt, 'in'), bandYs(f.src.pool));
    f.points = best.path;
    routed.push(best.path);
    use(portUse, f.src, best.P.k); use(portUse, f.tgt, 'in' + best.Q.k);
  }
  for (const f of m.msgs) {
    const end = (e, other, dir) => {
      if (e.node) {
        const n = e.node, cx = n.x + n.w / 2;
        const below = (other.pool || other.node.pool).y > n.pool.y;
        return [{x: cx, y: below ? n.y + n.h : n.y, d: dir === 'out' ? (below ? 'S' : 'N') : (below ? 'N' : 'S'), c: 0, k: 'M'}];
      }
      return null;
    };
    let P = end(f.a, f.b, 'out'), Q = end(f.b, f.a, 'in');
    const edgeOf = (pool, towards) => towards.y > pool.y ? pool.y + pool.h : pool.y;
    if (!P) { const x = Q[0].x; const pl = f.a.pool; P = [{x, y: edgeOf(pl, f.pb), d: f.pb.y > pl.y ? 'S' : 'N', c: 0, k: 'M'}]; }
    if (!Q) { const x = P[0].x; const pl = f.b.pool; Q = [{x, y: edgeOf(pl, f.pa), d: f.pa.y > pl.y ? 'N' : 'S', c: 0, k: 'M'}]; }
    const best = route(f.a.node || {}, f.b.node || {}, P, Q, poolGapYs);
    f.points = best.path;
    routed.push(best.path);
  }

  // 5. Nhãn: đặt tham lam, tránh node, nhãn khác và (nếu được) đường nối.
  const labels = [];
  const segs = [...m.flows, ...m.msgs].flatMap(f => f.points.slice(0, -1).map((a, i) => [a, f.points[i + 1], f]));
  const place = (cands, box, container, own) => {
    let best = null;
    cands.forEach(([x, y], i) => {
      const r = R(Math.round(x), Math.round(y), box.w, box.h);
      let cost = i * 8;
      if (container && !inside(container, r)) cost += 20000;
      for (const o of obstacles) if (o.n !== own && overlap(o.r, r)) cost += 10000;
      for (const l of labels) if (overlap(l, r)) cost += 10000;
      for (const [a, b, f] of segs) if (f !== own && segHits(a, b, r)) cost += 60;
      if (!best || cost < best.cost) best = {cost, r};
    });
    labels.push(best.r);
    return best.r;
  };
  const trackRect = n => n.lane ? n.lane.rect : n.pool.rect.track || n.pool.rect;
  for (const n of nodes.filter(n => n.lbl)) {
    const {w, h} = n.lbl, cx = n.x + n.w / 2;
    const cands = n.host
      ? [[n.x - w - 2, n.host.y + n.host.h + 3], [cx - w / 2, n.y + n.h + 3], [n.x + n.w + 2, n.y + n.h - 6]]
      : [[cx - w / 2, n.y + n.h + 5], [cx - w / 2, n.y - 5 - h],
        [cx - w - 5, n.y + n.h + 3], [cx + 5, n.y + n.h + 3], [cx - w - 5, n.y - 3 - h], [cx + 5, n.y - 3 - h],
        [n.x - w - 4, n.y + n.h / 2 - h / 2], [n.x + n.w + 4, n.y + n.h / 2 - h / 2],
        [n.x + n.w + 3, n.y + n.h], [n.x + n.w + 3, n.y - h], [n.x - w - 3, n.y + n.h], [n.x - w - 3, n.y - h]];
    n.lblRect = place(cands, n.lbl, trackRect(n), n);
  }
  for (const f of [...m.flows, ...m.msgs].filter(f => f.name.trim())) {
    const box = textBox(f.name, 110);
    const cands = [];
    const pts = f.points;
    const fromGateway = f.src && isGateway(f.src.type);
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      if (a.y === b.y) {
        const x0 = a.x < b.x ? a.x + 6 : a.x - 6 - box.w;
        cands.push([x0, a.y - box.h - 2], [x0, a.y + 3], [(a.x + b.x) / 2 - box.w / 2, a.y - box.h - 2]);
      } else {
        const y0 = a.y < b.y ? a.y + 6 : a.y - 6 - box.h;
        const yEnd = a.y < b.y ? b.y - 6 - box.h : b.y + 6;
        cands.push([a.x + 4, y0], [a.x - 4 - box.w, y0], [a.x + 4, yEnd], [a.x - 4 - box.w, yEnd]);
      }
    }
    if (!fromGateway) cands.reverse();
    const container = f.kind === 'msg' ? null : f.src.pool.rect;
    f.lblRect = place(cands, box, container, f);
  }

  return m;
}

const gw = n => !!n.type && isGateway(n.type);
const use = (map, n, k) => { if (!map.has(n)) map.set(n, {}); const u = map.get(n); u[k] = (u[k] || 0) + 1; };

function shapes(P, Q, xs, ys) {
  const H = d => d === 'E' || d === 'W';
  const out = [];
  const step = (p, d) => d === 'E' ? p.x + 20 : d === 'W' ? p.x - 20 : d === 'S' ? p.y + 20 : p.y - 20;
  if (H(P.d) && H(Q.d)) {
    out.push([P, Q]);
    for (const x of xs) out.push([P, {x, y: P.y}, {x, y: Q.y}, Q]);
    const a = step(P, P.d), b = Q.x - (Q.d === 'E' ? 20 : -20);
    for (const y of ys) out.push([P, {x: a, y: P.y}, {x: a, y}, {x: b, y}, {x: b, y: Q.y}, Q]);
  } else if (!H(P.d) && !H(Q.d)) {
    out.push([P, Q]);
    for (const y of ys) out.push([P, {x: P.x, y}, {x: Q.x, y}, Q]);
    const a = step(P, P.d), b = Q.y - (Q.d === 'S' ? 20 : -20);
    for (const x of xs) out.push([P, {x: P.x, y: a}, {x, y: a}, {x, y: b}, {x: Q.x, y: b}, Q]);
  } else if (H(P.d)) {
    out.push([P, {x: Q.x, y: P.y}, Q]);
    const a = step(P, P.d);
    for (const y of ys) out.push([P, {x: a, y: P.y}, {x: a, y}, {x: Q.x, y}, Q]);
    for (const x of xs) for (const y of ys) out.push([P, {x, y: P.y}, {x, y}, {x: Q.x, y}, Q]);
  } else {
    out.push([P, {x: P.x, y: Q.y}, Q]);
    const b = Q.x - (Q.d === 'E' ? 20 : -20);
    for (const y of ys) out.push([P, {x: P.x, y}, {x: b, y}, {x: b, y: Q.y}, Q]);
    for (const x of xs) for (const y of ys) out.push([P, {x: P.x, y}, {x, y}, {x, y: Q.y}, Q]);
  }
  return out;
}

function simplify(pts) {
  const p = pts.map(({x, y}) => ({x: Math.round(x), y: Math.round(y)}))
    .filter((q, i, a) => i === 0 || q.x !== a[i - 1].x || q.y !== a[i - 1].y);
  for (let i = 1; i < p.length - 1;) {
    const a = p[i - 1], b = p[i], c = p[i + 1];
    if ((a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y)) p.splice(i, 1); else i++;
  }
  return p;
}

const dirOf = (a, b) => a.x < b.x ? 'E' : a.x > b.x ? 'W' : a.y < b.y ? 'S' : 'N';
const opposite = {E: 'W', W: 'E', N: 'S', S: 'N'};
function validPath(p, P, Q) {
  if (p.length < 2) return false;
  for (let i = 0; i < p.length - 1; i++) if (p[i].x !== p[i + 1].x && p[i].y !== p[i + 1].y) return false;
  if (dirOf(p[0], p[1]) !== P.d || dirOf(p[p.length - 2], p[p.length - 1]) !== Q.d) return false;
  const first = Math.abs(p[1].x - p[0].x) + Math.abs(p[1].y - p[0].y);
  const last = Math.abs(p.at(-1).x - p.at(-2).x) + Math.abs(p.at(-1).y - p.at(-2).y);
  if (p.length > 2 && (first < 12 || last < 12)) return false;
  for (let i = 1; i < p.length - 1; i++) if (dirOf(p[i], p[i + 1]) === opposite[dirOf(p[i - 1], p[i])]) return false;
  return true;
}

/** Phạt hai đoạn chồng khít lên nhau (khó đọc) nặng hơn hai đoạn cắt nhau. */
function segClash(a, b, c, d) {
  const hz = (p, q) => p.y === q.y;
  if (hz(a, b) && hz(c, d) && Math.abs(a.y - c.y) < 4) {
    const o = Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) - Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x));
    return o > 4 ? 250 : 0;
  }
  if (!hz(a, b) && !hz(c, d) && Math.abs(a.x - c.x) < 4) {
    const o = Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y)) - Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y));
    return o > 4 ? 250 : 0;
  }
  if (hz(a, b) === hz(c, d)) return 0;
  const [h1, h2, v1, v2] = hz(a, b) ? [a, b, c, d] : [c, d, a, b];
  const cross = v1.x > Math.min(h1.x, h2.x) && v1.x < Math.max(h1.x, h2.x) && h1.y > Math.min(v1.y, v2.y) && h1.y < Math.max(v1.y, v2.y);
  return cross ? 25 : 0;
}

// ---------------------------------------------------------------- XML

const COLORS = {
  event: ['#e4f5ee', '#298273'], end: ['#fff0f0', '#b95560'], gateway: ['#fff8e6', '#b3812f'],
  task: ['#eef4ff', '#5c81c2'], pool: ['#ffffff', '#9aaac1'], blackbox: ['#f2f5fa', '#9aaac1'],
};
const attr = s => escapeXml(s).replace(/\n/g, '&#10;');

function eventDef(n) {
  if (!n.def) return '';
  const id = `${n.id}_def`;
  if (n.def === 'timer') {
    if (!n.timer) return `<bpmn:timerEventDefinition id="${id}"/>`;
    const tag = n.timer.startsWith('R') ? 'timeCycle' : n.timer.startsWith('P') ? 'timeDuration' : 'timeDate';
    return `<bpmn:timerEventDefinition id="${id}"><bpmn:${tag} xsi:type="bpmn:tFormalExpression">${escapeXml(n.timer)}</bpmn:${tag}></bpmn:timerEventDefinition>`;
  }
  return `<bpmn:${n.def}EventDefinition id="${id}"/>`;
}

export function toXml(m) {
  const pid = p => p.main ? m.id : `${m.id}_${p.key}`;
  const partId = p => `${pid(p)}_pool`;
  const laneId = (p, l) => `${pid(p)}_lane_${l.key}`;
  let fi = 0;
  for (const f of m.flows) f.xid = `Flow_${++fi}`;
  let mi = 0;
  for (const f of m.msgs) f.xid = `Message_${++mi}`;
  const pools = m.pools.filter(p => p.rect);

  const collab = m.hasCollab ? `<bpmn:collaboration id="${m.id}_collab">${pools.map(p =>
    `<bpmn:participant id="${partId(p)}" name="${attr(p.name)}"${p.blackbox ? '' : ` processRef="${pid(p)}"`}/>`).join('')}${m.msgs.map(f =>
    `<bpmn:messageFlow id="${f.xid}" name="${attr(f.name)}" sourceRef="${f.a.node ? f.a.node.id : partId(f.a.pool)}" targetRef="${f.b.node ? f.b.node.id : partId(f.b.pool)}"/>`).join('')}</bpmn:collaboration>` : '';

  const processes = pools.filter(p => !p.blackbox).map(p => {
    const lanes = p.lanes.length ? `<bpmn:laneSet id="${pid(p)}_lanes">${p.lanes.map(l =>
      `<bpmn:lane id="${laneId(p, l)}" name="${attr(l.name)}">${p.nodes.filter(n => n.lane === l).map(n => `<bpmn:flowNodeRef>${n.id}</bpmn:flowNodeRef>`).join('')}</bpmn:lane>`).join('')}</bpmn:laneSet>` : '';
    const nodeXml = p.nodes.map(n => {
      const extra = [
        n.host ? ` attachedToRef="${n.host.id}"${n.interrupting ? '' : ' cancelActivity="false"'}` : '',
        isSplitChoice(n) ? ` default="${n.out.find(f => f.isDefault).xid}"` : '',
      ].join('');
      return `<bpmn:${n.type} id="${n.id}" name="${attr(n.name)}"${extra}><bpmn:documentation>${escapeXml(n.doc)}</bpmn:documentation>${
        n.in.map(f => `<bpmn:incoming>${f.xid}</bpmn:incoming>`).join('')}${n.out.map(f => `<bpmn:outgoing>${f.xid}</bpmn:outgoing>`).join('')}${eventDef(n)}</bpmn:${n.type}>`;
    }).join('');
    const flowXml = m.flows.filter(f => f.src.pool === p).map(f =>
      `<bpmn:sequenceFlow id="${f.xid}"${f.name ? ` name="${attr(f.name)}"` : ''} sourceRef="${f.src.id}" targetRef="${f.tgt.id}">${
        f.cond ? `<bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">${escapeXml(f.cond)}</bpmn:conditionExpression>` : ''}</bpmn:sequenceFlow>`).join('');
    return `<bpmn:process id="${pid(p)}" name="${attr(p.name)}" isExecutable="false">${lanes}${nodeXml}${flowXml}</bpmn:process>`;
  }).join('');

  const B = r => `<dc:Bounds x="${Math.round(r.x)}" y="${Math.round(r.y)}" width="${Math.round(r.w)}" height="${Math.round(r.h)}"/>`;
  const color = ([fill, stroke]) => ` bioc:fill="${fill}" bioc:stroke="${stroke}"`;
  const shapes = [];
  if (m.hasCollab) for (const p of pools) {
    shapes.push(`<bpmndi:BPMNShape id="${partId(p)}_di" bpmnElement="${partId(p)}" isHorizontal="true"${color(p.blackbox ? COLORS.blackbox : COLORS.pool)}>${B(p.rect)}</bpmndi:BPMNShape>`);
    p.lanes.forEach((l, i) => shapes.push(`<bpmndi:BPMNShape id="${laneId(p, l)}_di" bpmnElement="${laneId(p, l)}" isHorizontal="true"${color([i % 2 ? '#f6f9fd' : '#ffffff', '#c6d1df'])}>${B(l.rect)}</bpmndi:BPMNShape>`));
  }
  const nodesInOrder = pools.flatMap(p => [...p.nodes.filter(n => !n.host), ...p.nodes.filter(n => n.host)]);
  for (const n of nodesInOrder) {
    const c = n.type === 'endEvent' ? COLORS.end : isEvent(n.type) ? COLORS.event : isGateway(n.type) ? COLORS.gateway : COLORS.task;
    const expanded = n.type === 'subProcess' ? ' isExpanded="false"' : '';
    const marker = n.type === 'exclusiveGateway' ? ' isMarkerVisible="true"' : '';
    shapes.push(`<bpmndi:BPMNShape id="${n.id}_di" bpmnElement="${n.id}"${expanded}${marker}${color(c)}>${B(R(n.x, n.y, n.w, n.h))}${
      n.lblRect ? `<bpmndi:BPMNLabel>${B(n.lblRect)}</bpmndi:BPMNLabel>` : ''}</bpmndi:BPMNShape>`);
  }
  const edges = [...m.flows, ...m.msgs].map(f =>
    `<bpmndi:BPMNEdge id="${f.xid}_di" bpmnElement="${f.xid}" bioc:stroke="#7e90aa">${f.points.map(p => `<di:waypoint x="${p.x}" y="${p.y}"/>`).join('')}${
      f.lblRect ? `<bpmndi:BPMNLabel>${B(f.lblRect)}</bpmndi:BPMNLabel>` : ''}</bpmndi:BPMNEdge>`);

  const planeRef = m.hasCollab ? `${m.id}_collab` : m.id;
  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:bioc="http://bpmn.io/schema/bpmn/biocolor/1.0" id="${m.id}_definitions" targetNamespace="https://bpmn-studio.local/process" exporter="BPMN Studio DSL" exporterVersion="1.0.0">
${collab}
${processes}
<bpmndi:BPMNDiagram id="${m.id}_diagram"><bpmndi:BPMNPlane id="${m.id}_plane" bpmnElement="${planeRef}">
${shapes.join('\n')}
${edges.join('\n')}
</bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>
`;
}

/** Văn bản DSL → {xml, findings, model}. xml là null khi còn lỗi chặn. */
export function compile(text) {
  const m = analyze(parse(text));
  const blocking = m.findings.some(f => f.severity === 'error');
  if (blocking) return {xml: null, findings: m.findings, model: m};
  layout(m);
  return {xml: toXml(m), findings: m.findings, model: m};
}
