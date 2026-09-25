#!/usr/bin/env node
/**
 * verify.mjs — 零依赖自检脚本
 *
 * 校验两件事：
 *  1. references/doc-engineer-agent-prompt.md 与 SKILL.md 的正文（剥掉 YAML frontmatter 后）
 *     互为逐字节相同的字节序列，且该字节序列的 sha256 == 附件原文 sha256；
 *  2. SKILL.md 的 frontmatter 合法：含 kebab-case 的 name 与非空 description。
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

/* ---------- 4. frontmatter 字段校验 ---------- */
console.log('');
console.log('4) SKILL.md frontmatter 字段');
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
if (frontmatterText === null) {
  fail('无 frontmatter 可校验');
} else {
  const fieldRe = /^([A-Za-z_][A-Za-z0-9_-]*):[ \t]*(.*)$/;
  const fields = new Map();
  for (const raw of frontmatterText.split('\n')) {
    const m = fieldRe.exec(raw);
    if (m) fields.set(m[1], m[2].trim());
  }

  const name = fields.get('name');
  if (name === undefined || name === '') {
    fail('frontmatter 缺少必填字段 `name`');
  } else if (!KEBAB.test(name)) {
    fail(`\`name\` 不是 kebab-case: "${name}"`);
  } else {
    ok(`name = "${name}"（kebab-case 合法）`);
  }

  const description = fields.get('description');
  if (description === undefined || description === '') {
    fail('frontmatter 缺少必填字段 `description`');
  } else {
    ok(`description 存在（${description.length} 字符）`);
  }

  const whenToUse = fields.get('whenToUse');
  if (whenToUse === undefined) {
    ok('whenToUse 未设置（可选字段，允许）');
  } else if (whenToUse === '') {
    fail('`whenToUse` 存在但为空');
  } else {
    ok(`whenToUse 存在（${whenToUse.length} 字符）`);
  }

  const unknown = [...fields.keys()].filter(
    (k) => !['name', 'description', 'whenToUse'].includes(k)
  );
  if (unknown.length) notes.push(`frontmatter 含额外字段（DSH 规范未定义，可能被忽略）: ${unknown.join(', ')}`);
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