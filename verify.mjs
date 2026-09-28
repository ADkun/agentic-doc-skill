#!/usr/bin/env node
/**
 * verify.mjs — 零依赖自检脚本
 *
 * 校验四件事：
 *  1. SKILL.md 的第一个 `---` frontmatter 块之后的正文，与
 *     references/doc-engineer-agent-prompt.md 全文**互为逐字节相同的字节序列**
 *     （动态一致性校验：不再有钉死的 sha256 常量，改正文只需同步两副本）；
 *  2. 两副本均为无 BOM 的 UTF-8 且行尾为 LF（与 .gitattributes 的 `* -text` 逐字节保真约定一致）；
 *  3. SKILL.md 的 frontmatter 合法（**拒绝式**严格校验）：结构为 `key: 标量`、
 *     `name` 精确等于 `doc-engineer`、`description`/`whenToUse` 为非空字符串、
 *     字段白名单仅 name/description/whenToUse、无 tab 缩进、
 *     引号必须成对闭合且引号外无多余尾随内容；
 *  4. 正文一级标题（`# ` 开头、排除 ``` 围栏内）序列等于定稿章节清单。
 *
 * 用法：node verify.mjs   （exit 0 = 通过，非 0 = 失败）
 *
 * 注意：SKILL.md 的 frontmatter 块本身不参与一致性比对，
 *       基准 = references/doc-engineer-agent-prompt.md 全文。
 */

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(fileURLToPath(import.meta.url));
const REF_PATH = join(ROOT, 'references', 'doc-engineer-agent-prompt.md');
const SKILL_PATH = join(ROOT, 'SKILL.md');

/** 定稿正文的一级标题清单（顺序即期望顺序；围栏代码块内的 `#` 不计入）。 */
const EXPECTED_H1 = [
  '# 角色',
  '# 定位（与 plan/spec 相反）',
  '# 设计哲学（不可违背）',
  '# 工作方式（loop 工作法）',
  '# 过程与状态文件（临时工作目录）',
  '# design.md 写作规范',
  '# AGENTS.md 维护规范（最高优先级文档）',
  '# 其他文档规范',
  '# 人类扫读契约',
  '# 质量红线清单（交付前逐条自检；载体标注：[机检]=脚本可判，[评]=对抗评审可判，[人]=登记 pending.md）',
  '# 反模式（出现即返工）',
];

/** frontmatter 字段白名单（比 DSH 接受的键更严：本 skill 只允许这三键）。 */
const ALLOWED_KEYS = new Set(['name', 'description', 'whenToUse']);
const EXPECTED_NAME = 'doc-engineer';

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
function die(msg) {
  fail(msg);
  console.log('');
  console.log(`RESULT: FAIL (${failures.length} 项失败)`);
  process.exit(1);
}

console.log('verify.mjs — DSH skill "doc-engineer" 自检');
console.log(`  root: ${ROOT}`);
console.log('');

/* ---------- 1. 读取两个副本 ---------- */
console.log('1) 读取 SKILL.md 与 references 基准');
let refBuf;
try {
  refBuf = readFileSync(REF_PATH);
} catch (err) {
  die(`无法读取 ${REF_PATH}: ${err.message}`);
}
let skillBuf;
try {
  skillBuf = readFileSync(SKILL_PATH);
} catch (err) {
  die(`无法读取 ${SKILL_PATH}: ${err.message}`);
}
ok(`references/doc-engineer-agent-prompt.md 存在，${refBuf.length} 字节，sha256 = ${sha256(refBuf)}`);
ok(`SKILL.md 存在，${skillBuf.length} 字节，sha256 = ${sha256(skillBuf)}`);

/* ---------- 2. 编码 / 行尾（逐字节保真前提） ---------- */
console.log('');
console.log('2) 编码与行尾（无 BOM + LF）');
function checkBytesNoBom(name, buf) {
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    fail(`${name} 以 UTF-8 BOM 开头（要求无 BOM）`);
  } else {
    ok(`${name} 无 UTF-8 BOM`);
  }
  let cr = 0;
  for (let i = 0; i < buf.length; i++) if (buf[i] === 0x0d) cr++;
  if (cr > 0) {
    fail(`${name} 含 ${cr} 个 CR 字节（要求纯 LF；.gitattributes 已用 \`* -text\` 禁止行尾转换）`);
  } else {
    ok(`${name} 行尾为纯 LF（无 CR 字节）`);
  }
}
checkBytesNoBom('SKILL.md', skillBuf);
checkBytesNoBom('references/doc-engineer-agent-prompt.md', refBuf);

/* ---------- 3. 解析 SKILL.md，剥离 frontmatter ---------- */
const skillText = skillBuf.toString('utf8');
const lines = skillText.split('\n');
const stripCr = (s) => (s.endsWith('\r') ? s.slice(0, -1) : s);

let bodyBuf = null;
let frontmatterText = null;

console.log('');
console.log('3) SKILL.md frontmatter 块定位与正文剥离');
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

/* ---------- 4. 正文与 references 逐字节一致性（动态校验，无钉死哈希） ---------- */
console.log('');
console.log('4) SKILL.md 正文 vs references 全文（逐字节一致性，动态）');
if (bodyBuf === null) {
  fail('无法剥离 frontmatter，正文比对跳过');
} else {
  ok(`正文 ${bodyBuf.length} 字节，sha256 = ${sha256(bodyBuf)}（信息值，不作期望）`);
  if (bodyBuf.equals(refBuf)) {
    ok(`正文与 references/doc-engineer-agent-prompt.md 逐字节相等（${refBuf.length} 字节）`);
  } else {
    fail(
      `正文与 references 基准不逐字节相等（正文 ${bodyBuf.length} 字节 vs 基准 ${refBuf.length} 字节）——两副本必须同步更新`
    );
    const n = Math.min(bodyBuf.length, refBuf.length);
    let firstDiff = -1;
    for (let i = 0; i < n; i++) {
      if (bodyBuf[i] !== refBuf[i]) {
        firstDiff = i;
        break;
      }
    }
    if (firstDiff === -1) firstDiff = n;
    notes.push(
      `首个差异位于偏移 ${firstDiff}` +
        (firstDiff < Math.min(bodyBuf.length, refBuf.length)
          ? `: 正文 0x${bodyBuf[firstDiff].toString(16)} vs 基准 0x${refBuf[firstDiff].toString(16)}`
          : '（一处是另一处的前缀，长度不同）')
    );
  }
}

/* ---------- 5. 章节清单校验（一级标题序列，排除围栏代码块） ---------- */
console.log('');
console.log('5) 正文章节清单（一级标题序列）');
if (bodyBuf === null) {
  fail('无正文可校验章节清单');
} else {
  const bodyLines = bodyBuf.toString('utf8').split('\n').map(stripCr);
  const h1 = [];
  let inFence = false;
  for (const l of bodyLines) {
    if (/^(`{3,}|~{3,})/.test(l)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (/^# \S/.test(l)) h1.push(l);
  }
  const same = h1.length === EXPECTED_H1.length && h1.every((v, i) => v === EXPECTED_H1[i]);
  if (same) {
    ok(`一级标题 ${h1.length} 节，与定稿章节清单逐节一致`);
  } else {
    fail('一级标题序列与定稿章节清单不一致（改了章节名/增删章节须同步 EXPECTED_H1）');
    for (let i = 0; i < Math.max(h1.length, EXPECTED_H1.length); i++) {
      const a = h1[i];
      const b = EXPECTED_H1[i];
      if (a !== b) notes.push(`第 ${i + 1} 节：实际 ${JSON.stringify(a ?? null)} vs 期望 ${JSON.stringify(b ?? null)}`);
    }
  }
}

/* ---------- 6. frontmatter 字段校验（拒绝式严格校验，零依赖） ---------- */

/*
 * 下面这个小解析器**只**覆盖本 skill frontmatter 的形态：顶层 `key: 标量` 行。
 * 它是对 DSH 接受条件的一个**子集近似**，不是通用 YAML 解析器：
 *   - 不支持嵌套映射 / 序列 / 块标量（`|`、`>`）/ 锚点 / 流式集合 —— 一律拒绝；
 *   - 对顶层键做了白名单（本 skill 只允许 name / description / whenToUse），
 *     比 DSH 自身接受的键集更严；
 *   - 对引号只做单双引号闭合检查 + 转义处理，不做完整 YAML 转义语义（如 `\ ` 外的
 *     冷门转义、双引号内的行折叠）；
 *   - 若是未来 frontmatter 变得更复杂，本脚本会**报失败**而不是放水通过 ——
 *     这是刻意选择：宁可要求同步更新自检脚本，也不对 DSH 会静默丢弃的文件报 ok。
 * 目的：DSH 用真实 YAML 解析器读取 frontmatter，本脚本必须能拒掉它拒掉的坏输入
 * （典型：未闭合引号），因此校验必须是"拒绝式"的，不能是"长得像就通过"的正则。
 */

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const KEY_RE = /^([A-Za-z_][A-Za-z0-9_-]*):(.*)$/;

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
    return { ok: false, error: `第 ${lineNo} 行 \`${key}:\` 的值为空（本 skill 三字段均要求非空标量）` };
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
  const fmLines = text.split('\n');
  for (let i = 0; i < fmLines.length; i++) {
    const lineNo = i + 1; // frontmatter 内容内的行号（不含起始 `---`，与 DSH 的 line 号一致）
    const raw = fmLines[i].endsWith('\r') ? fmLines[i].slice(0, -1) : fmLines[i];
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
        `第 ${lineNo} 行出现非白名单键 \`${key}\`（本 skill 只接受: ${[...ALLOWED_KEYS].join(', ')}）`
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
console.log('6) SKILL.md frontmatter 字段（拒绝式严格校验）');
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
    } else if (name !== EXPECTED_NAME) {
      fail(`\`name\` 必须精确等于 "${EXPECTED_NAME}"，实际: "${name}"`);
    } else {
      ok(`name = "${name}"（精确匹配，kebab-case 合法）`);
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
      fail('frontmatter 缺少 `whenToUse`（本 skill 定稿三字段之一，要求存在且非空）');
    } else if (typeof whenToUse !== 'string' || whenToUse === '') {
      fail(`\`whenToUse\` 必须是非空字符串，实际: ${JSON.stringify(whenToUse)}`);
    } else {
      ok(`whenToUse 存在（${whenToUse.length} 字符）`);
    }

    // 非白名单键在结构校验阶段已被拒绝；这里只是兜底确认白名单闭合。
    const unknown = [...fields.keys()].filter((k) => !ALLOWED_KEYS.has(k));
    if (unknown.length) fail(`frontmatter 含非白名单键: ${unknown.join(', ')}`);
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
  console.log('RESULT: PASS — 正文与 references 逐字节一致；编码/行尾合规；章节清单匹配；frontmatter 合法');
  process.exit(0);
} else {
  console.log(`RESULT: FAIL — ${failures.length} 项失败`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
