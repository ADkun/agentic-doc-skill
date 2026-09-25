#!/usr/bin/env node
/**
 * verify.mjs — 零依赖自检脚本
 *
 * 校验两件事：
 *  1. references/doc-engineer-agent-prompt.md 与 SKILL.md 的正文（剥掉 YAML frontmatter 后）
 *     互为逐字节相同的字节序列，且该字节序列的 sha256 == 附件原文 sha256；
 *  2. SKILL.md 的 frontmatter 合法（**拒绝式**严格校验）：结构为 `key: 标量`、
 *     含 kebab-case 的 name 与非空字符串 description、无未知键、无 tab 缩进、
 *     引号必须成对闭合且引号外无多余尾随内容。
 *
 * 用法：node verify.mjs   （exit 0 = 通过，非 0 = 失败）
 *
 * 注意：SKILL.md 的 frontmatter 块本身不计入 sha256，
 *       以 references/doc-engineer-agent-prompt.md 作为基准（它的 sha256 即附件 sha256）。
 */

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const EXPECTED_SHA256 =
  'ee6d1864f8ff371b9420a06bff077c7be16bbd4de6412ca115aad0792c0886d5';

const ROOT = dirname(fileURLToPath(import.meta.url));
const REF_PATH = join(ROOT, 'references', 'doc-engineer-agent-prompt.md');
const SKILL_PATH = join(ROOT, 'SKILL.md');

const failures = [];
const notes = [];

function ok(msg) {
  console.log(`  [ok]   ${msg}`);
}
function fail(msg) {
  failures.push(msg);
  console.log(`  [FAIL] ${msg}`);
}
function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

console.log('verify.mjs — DSH skill "doc-engineer" 自检');
console.log(`  root: ${ROOT}`);
console.log('');

/* ---------- 1. 读取 references 基准 ---------- */
console.log('1) references/doc-engineer-agent-prompt.md');
let refBuf;
try {
  refBuf = readFileSync(REF_PATH);
} catch (err) {
  fail(`无法读取 ${REF_PATH}: ${err.message}`);
  console.log('');
  console.log(`RESULT: FAIL (${failures.length} 项失败)`);
  process.exit(1);
}
const refSha = sha256(refBuf);
ok(`存在，${refBuf.length} 字节`);
ok(`sha256 = ${refSha}`);
if (refSha === EXPECTED_SHA256) {
  ok(`sha256 等于附件原文 sha256 (${EXPECTED_SHA256})`);
} else {
  fail(`sha256 与附件原文不一致：期望 ${EXPECTED_SHA256}，实际 ${refSha}`);
}

/* ---------- 2. 解析 SKILL.md，剥离 frontmatter ---------- */
console.log('');
console.log('2) SKILL.md');
let skillBuf;
try {
  skillBuf = readFileSync(SKILL_PATH);
} catch (err) {
  fail(`无法读取 ${SKILL_PATH}: ${err.message}`);
  console.log('');
  console.log(`RESULT: FAIL (${failures.length} 项失败)`);
  process.exit(1);
}
ok(`存在，${skillBuf.length} 字节`);

let bodyBuf = null;
let frontmatterText = null;

if (skillBuf[0] === 0xef && skillBuf[1] === 0xbb && skillBuf[2] === 0xbf) {
  fail('SKILL.md 以 UTF-8 BOM 开头（frontmatter 可能因此非法，要求无 BOM）');
} else {
  ok('无 UTF-8 BOM');
}

const skillText = skillBuf.toString('utf8');
const lines = skillText.split('\n');
const stripCr = (s) => (s.endsWith('\r') ? s.slice(0, -1) : s);

// frontmatter 必须以第一行的 `---` 开始
if (lines.length > 0 && stripCr(lines[0]) === '---') {
  let endIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (stripCr(lines[i]) === '---') {
      endIdx = i;
      break;
    }
  }
  if (endIdx === -1) {
    fail('SKILL.md 只有起始 `---`，未找到闭合的 `---` 行');
  } else {
    frontmatterText = lines.slice(1, endIdx).map(stripCr).join('\n');
    // 正文起始 = frontmatter 各行 + 闭合 `---` 行的字节数 + 1 个换行；
    // 其后若存在一个空行（frontmatter 与正文之间的分隔空行）则一并跳过。
    const fmPrefix = lines.slice(0, endIdx + 1).join('\n') + '\n';
    let bodyStart = Buffer.byteLength(fmPrefix, 'utf8');
    if (skillBuf[bodyStart] === 0x0a) bodyStart += 1;
    else if (skillBuf[bodyStart] === 0x0d && skillBuf[bodyStart + 1] === 0x0a) bodyStart += 2;
    bodyBuf = skillBuf.subarray(bodyStart);
    ok(`frontmatter 定位成功：第 1..${endIdx + 1} 行，正文自字节偏移 ${bodyStart} 起`);
  }
} else {
  fail('SKILL.md 未以 `---` 起始的 YAML frontmatter 开头');
}

/* ---------- 3. 正文与 references 逐字节比对 ---------- */
console.log('');
console.log('3) SKILL.md 正文 vs references 基准（逐字节）');
if (bodyBuf === null) {
  fail('无法剥离 frontmatter，正文比对跳过');
} else {
  const bodySha = sha256(bodyBuf);
  ok(`正文 ${bodyBuf.length} 字节，sha256 = ${bodySha}`);
  if (bodyBuf.equals(refBuf)) {
    ok('正文与 references/doc-engineer-agent-prompt.md 逐字节相等');
  } else {
    fail(
      `正文与 references 基准不相等（正文 ${bodyBuf.length} 字节 vs 基准 ${refBuf.length} 字节）`
    );
    const n = Math.min(bodyBuf.length, refBuf.length);
    for (let i = 0; i < n; i++) {
      if (bodyBuf[i] !== refBuf[i]) {
        notes.push(`首个差异位于偏移 ${i}: 正文 0x${bodyBuf[i].toString(16)} vs 基准 0x${refBuf[i].toString(16)}`);
        break;
      }
    }
  }
  if (bodySha === EXPECTED_SHA256) {
    ok(`正文 sha256 等于附件原文 sha256`);
  } else {
    fail(`正文 sha256 与附件原文不一致：期望 ${EXPECTED_SHA256}，实际 ${bodySha}`);
  }
}

/* ---------- 4. frontmatter 字段校验（拒绝式严格校验，零依赖） ---------- */

/*
 * 下面这个小解析器**只**覆盖本 skill frontmatter 的形态：顶层 `key: 标量` 行。
 * 它是对 DSH 接受条件的一个**子集近似**，不是通用 YAML 解析器：
 *   - 不支持嵌套映射 / 序列 / 块标量（`|`、`>`）/ 锚点 / 流式集合 —— 一律拒绝；
 *   - 对顶层键做了白名单（DSH 只接受这 6 个键），比通用 YAML "宽松接受" 更严；
 *   - 对引号只做单双引号闭合检查 + 转义处理，不做完整 YAML 转义语义（如 `\ ` 外的
 *     冷门转义、双引号内的行折叠）；
 *   - 若是未来 frontmatter 变得更复杂，本脚本会**报失败**而不是放水通过 ——
 *     这是刻意选择：宁可要求同步更新自检脚本，也不对 DSH 会静默丢弃的文件报 ok。
 * 目的：DSH 用真实 YAML 解析器读取 frontmatter，本脚本必须能拒掉它拒掉的坏输入
 * （典型：未闭合引号），因此校验必须是"拒绝式"的，不能是"长得像就通过"的正则。
 */

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const KEY_RE = /^([A-Za-z_][A-Za-z0-9_-]*):(.*)$/;
// DSH 接受的 frontmatter 键（dsh-skill-filesystem 的解析路径）。
const ALLOWED_KEYS = new Set([
  'name',
  'description',
  'whenToUse',
  'metadata',
  'disable-model-invocation',
  'user-invocable',
]);
const INVOCATION_KEYS = new Set(['disable-model-invocation', 'user-invocable']);
const BOOLEAN_SPELLINGS = new Set(['true', 'false', 'yes', 'no', 'on', 'off', '1', '0']);

// YAML 普通标量中 ` #` 起始的是注释（引号内的 `#` 不受影响，见 parseScalar）。
function stripYamlComment(s) {
  const m = /(^|\s)#/.exec(s);
  return m ? s.slice(0, m.index) : s;
}

function unquote(v) {
  const quote = v[0];
  const inner = v.slice(1, -1);
  // 单引号内 `''` 表示一个字面单引号；双引号转义由 findClosingQuote 负责配对，
  // 本子集近似不解码其转义序列（对 kebab-case 校验已足够严格）。
  return quote === "'" ? inner.replace(/''/g, "'") : inner;
}

/**
 * 解析 `key: 标量` 的标量部分。
 * @returns {{ok: true, value: unknown} | {ok: false, error: string}}
 */
function parseScalar(key, rawValueWithComment, lineNo) {
  const text = stripYamlComment(rawValueWithComment).trim();
  if (text === '') {
    // 空标量：本 skill 的字段全部要求非空；metadata 例外（映射键，本子集近似按空处理）。
    if (key === 'metadata') return { ok: true, value: null };
    return { ok: false, error: `第 ${lineNo} 行 \`${key}:\` 的值为空（要求非空标量）` };
  }
  const head = text[0];
  if (head === '"' || head === "'") {
    const quoteName = head === '"' ? '双引号' : '单引号';
    const end = findClosingQuote(text, lineNo, quoteName);
    if (end.ok === false) return { ok: false, error: end.error };
    const after = text.slice(end.index + 1).trim();
    if (after !== '') {
      return {
        ok: false,
        error: `第 ${lineNo} 行 \`${key}:\` 的闭合${quoteName}之后有多余内容: "${after}"（不允许）`,
      };
    }
    const value = unquote(text.slice(0, end.index + 1));
    if (value === '') {
      return { ok: false, error: `第 ${lineNo} 行 \`${key}:\` 的值为空字符串（要求非空）` };
    }
    return { ok: true, value };
  }
  if (text.includes('"') || text.includes("'")) {
    return {
      ok: false,
      error: `第 ${lineNo} 行 \`${key}:\` 的未加引号标量中出现引号: "${text}"（引号必须整体包裹标量且成对闭合）`,
    };
  }
  if (INVOCATION_KEYS.has(key) && !BOOLEAN_SPELLINGS.has(text.toLowerCase())) {
    return {
      ok: false,
      error: `第 ${lineNo} 行 \`${key}:\` 必须是布尔值（true/false/yes/no/on/off/1/0），实际: "${text}"`,
    };
  }
  return { ok: true, value: text };
}

function findClosingQuote(text, lineNo, quoteName) {
  const quote = text[0];
  for (let i = 1; i < text.length; i++) {
    const ch = text[i];
    if (quote === '"') {
      if (ch === '\\') {
        const next = text[i + 1];
        if (next === undefined) {
          return { ok: false, error: `第 ${lineNo} 行以孤立的反斜杠结尾（转义不完整）` };
        }
        i++; // 跳过被转义的字符（\" 不会提前闭合字符串）
        continue;
      }
      if (ch === '"') return { ok: true, index: i };
    } else if (ch === "'") {
      if (text[i + 1] === "'") {
        i++; // YAML 单引号内的 '' 表示一个字面单引号
        continue;
      }
      return { ok: true, index: i };
    }
  }
  return {
    ok: false,
    error: `第 ${lineNo} 行的${quoteName}未闭合（缺少配对的闭合引号）`,
  };
}

/**
 * 严格解析 frontmatter 文本。
 * @returns {{ok: true, fields: Map<string, unknown>} | {ok: false, errors: string[]}}
 */
function parseFrontmatterStrict(text) {
  const errors = [];
  const fields = new Map();
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1; // frontmatter 内容内的行号（不含起始 `---`，与 DSH 的 line 号一致）
    const raw = lines[i].endsWith('\r') ? lines[i].slice(0, -1) : lines[i];
    if (raw.trim() === '') continue;
    if (raw.includes('\t')) {
      errors.push(`第 ${lineNo} 行含 tab 字符（frontmatter 的缩进与分隔必须是空格）`);
      continue;
    }
    if (/^[ \u3000]/.test(raw) || raw.startsWith('-')) {
      errors.push(
        `第 ${lineNo} 行不是顶层 \`key: value\` 结构: "${raw}"（不支持缩进/嵌套/序列/块标量）`
      );
      continue;
    }
    const m = KEY_RE.exec(raw);
    if (!m) {
      errors.push(`第 ${lineNo} 行不符合 \`key: value\` 结构: "${raw}"`);
      continue;
    }
    const key = m[1];
    if (!ALLOWED_KEYS.has(key)) {
      errors.push(
        `第 ${lineNo} 行出现未知键 \`${key}\`（DSH 只接受: ${[...ALLOWED_KEYS].join(', ')}）`
      );
      continue;
    }
    if (fields.has(key)) {
      errors.push(`第 ${lineNo} 行重复定义键 \`${key}\``);
      continue;
    }
    const parsed = parseScalar(key, m[2], lineNo);
    if (parsed.ok === false) {
      errors.push(parsed.error);
      continue;
    }
    fields.set(key, parsed.value);
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, fields };
}

console.log('');
console.log('4) SKILL.md frontmatter 字段（拒绝式严格校验）');
console.log('   注：本校验是 DSH 接受条件的子集近似，非通用 YAML 解析器（详见 verify.mjs 注释）。');
if (frontmatterText === null) {
  fail('无 frontmatter 可校验');
} else {
  const parsed = parseFrontmatterStrict(frontmatterText);
  if (parsed.ok === false) {
    // 结构层面已非法：逐条列出，并直接对这些坏输入报失败（拒绝式，绝不放水）。
    for (const e of parsed.errors) {
      fail(`frontmatter 非法：${e}`);
    }
  } else {
    const fields = parsed.fields;

    const name = fields.get('name');
    if (name === undefined) {
      fail('frontmatter 缺少必填字段 `name`');
    } else if (typeof name !== 'string' || name === '') {
      fail(`\`name\` 必须是非空字符串，实际: ${JSON.stringify(name)}`);
    } else if (!KEBAB.test(name)) {
      fail(`\`name\` 不是 kebab-case（^[a-z0-9]+(-[a-z0-9]+)*$）: "${name}"`);
    } else {
      ok(`name = "${name}"（kebab-case 合法）`);
    }

    const description = fields.get('description');
    if (description === undefined) {
      fail('frontmatter 缺少必填字段 `description`');
    } else if (typeof description !== 'string' || description === '') {
      fail(`\`description\` 必须是非空字符串，实际: ${JSON.stringify(description)}`);
    } else {
      ok(`description 存在（${description.length} 字符）`);
    }

    const whenToUse = fields.get('whenToUse');
    if (whenToUse === undefined) {
      ok('whenToUse 未设置（可选字段，允许）');
    } else if (typeof whenToUse !== 'string' || whenToUse === '') {
      fail(`\`whenToUse\` 存在但不是非空字符串，实际: ${JSON.stringify(whenToUse)}`);
    } else {
      ok(`whenToUse 存在（${whenToUse.length} 字符）`);
    }

    for (const key of INVOCATION_KEYS) {
      if (!fields.has(key)) continue;
      const v = fields.get(key);
      if (typeof v === 'string' && BOOLEAN_SPELLINGS.has(v.toLowerCase())) {
        ok(`${key} = ${v}（布尔拼写合法）`);
      } else if (v === null) {
        notes.push(`\`${key}\` 存在但为空值（本子集近似按"未设置"处理）`);
      } else {
        fail(`\`${key}\` 不是可接受的布尔值: ${JSON.stringify(v)}`);
      }
    }

    if (fields.has('metadata')) {
      notes.push('`metadata` 存在（映射键；本子集近似不解析其内部结构）');
    }

    // 未知键在结构校验阶段已被拒绝；这里只是兜底确认白名单闭合。
    const unknown = [...fields.keys()].filter((k) => !ALLOWED_KEYS.has(k));
    if (unknown.length) fail(`frontmatter 含未知键: ${unknown.join(', ')}`);
  }
}

/* ---------- 结论 ---------- */
if (notes.length) {
  console.log('');
  console.log('备注：');
  for (const n of notes) console.log(`  - ${n}`);
}

console.log('');
if (failures.length === 0) {
  console.log('RESULT: PASS — 正文逐字节一致，sha256 匹配，frontmatter 合法');
  process.exit(0);
} else {
  console.log(`RESULT: FAIL — ${failures.length} 项失败`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}