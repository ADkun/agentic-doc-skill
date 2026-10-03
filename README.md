# doc-engineer — DSH skill

这是一个 **DSH skill**（DeepSeek Harness 技能包），封装项目「**文档工程师**」角色规范。

它把**「文档首先是写给人看的」**放在第一位：清晰、可审核是最高目标——读者能读懂、能复述、
能独立核验；在这一前提下，才把文档同时做成一套**供零上下文智能体安全施工的文档认知系统**
（人扫读、机检索、约束可执行、状态可接力）。面向 Agent 的索引、指针化、机检格式与 token
压缩都属增益项：一旦与人类可读性/可审核性冲突，一律以人读为准。过程件（changelog /
handoff / 待决清单 / 工作稿）隔离于 git 排除的临时工作目录，版本区只留最终真相。
适用于撰写 / 维护 / 评审项目设计文档、模块文档、`AGENTS.md` 文档体系治理、
引用形式（同仓库/跨仓库路径与链接）选型与核验，以及按质量红线清单自检与返工文档。

## 目录结构

```
agentic-doc-skill/
├── SKILL.md                                # skill 入口：YAML frontmatter + 角色规范正文
├── references/
│   └── doc-engineer-agent-prompt.md        # 角色规范正文副本（与 SKILL.md 正文逐字节一致）
├── README.md                               # 本文件
├── verify.mjs                              # 零依赖自检脚本
├── .gitignore
└── .gitattributes                          # `* -text`：禁用行尾转换，保证两副本跨平台逐字节一致
```

### 关于 `SKILL.md` 与 `references/` 的关系

`SKILL.md` 的正文与 `references/doc-engineer-agent-prompt.md` **逐字节相同**；
`SKILL.md` 只是在正文之前多了一段 DSH 强制要求的 YAML frontmatter：

```yaml
---
name: doc-engineer
description: 项目「文档工程师」角色规范：文档首先写给人看——清晰、可审核是第一目标……
whenToUse: 用户要求为项目编写或维护 AGENTS.md、design.md、testing-guide.md 等施工型文档……
---
```

两副本的一致性由 `verify.mjs` **动态校验**（不钉死哈希常量）：脚本剥掉 `SKILL.md` 的第一个
`---` frontmatter 块，把余下正文与 `references/doc-engineer-agent-prompt.md` 全文逐字节比对。
所以改正文只需**同步改两处**（推荐流程：改 `references/`，再用它重建 `SKILL.md` 的正文），
不必更新任何期望值；只有改动章节标题才需要同步脚本里的 `EXPECTED_H1` 清单。

正文的一级章节清单（13 节，顺序即阅读顺序，与 `EXPECTED_H1` 一致；前两节即优先级声明）：

1. `# 角色`
2. `# 第一原则：文档首先是写给人看的`
3. `# 人类可读与可审核契约`
4. `# 引用形式规范（同仓库 / 跨仓库）`
5. `# 定位（与 plan/spec 相反）`
6. `# 设计哲学（不可违背）`
7. `# 工作方式（loop 工作法）`
8. `# 过程与状态文件（临时工作目录）`
9. `# design.md 写作规范`
10. `# AGENTS.md 维护规范（自动注入的常驻入口）`
11. `# 其他文档规范`
12. `# 质量红线清单（交付前逐条自检；载体标注：[机检]=脚本可判，[评]=对抗评审可判，[人]=登记 pending.md）`
13. `# 反模式（出现即返工）`

README 自身不承载角色规范正文——正文只在
[`SKILL.md`](SKILL.md) 与 [`references/doc-engineer-agent-prompt.md`](references/doc-engineer-agent-prompt.md)
里全量保存，README 只用链接引用、不另存一份副本（这正是角色规范自身「引用不复制」纪律的用法）。
唯一例外是本文件开头「它定义的不是……」那段角色定位摘要：它与 frontmatter 的 `description` 同源，
是为了让仓库页首屏能直接读懂这个 skill 做什么，不构成第二份正文。

## 安装 / 同步到本机 DSH

用户级 skill 根目录（全环境持久生效）：

```
%USERPROFILE%\.dsh\skills\
```

把 skill 包安装为该根目录下的 `doc-engineer\`：

```powershell
$dst = "$env:USERPROFILE\.dsh\skills\doc-engineer"
New-Item -ItemType Directory -Force -Path "$dst\references" | Out-Null
Copy-Item .\SKILL.md                                          "$dst\SKILL.md" -Force
Copy-Item .\references\doc-engineer-agent-prompt.md           "$dst\references\doc-engineer-agent-prompt.md" -Force
```

DSH skill 根目录由 watcher 监视，新增 skill 无需重启即可在下一个会话被加载。
也可用一条命令完成同步（在仓库根目录执行）：

```powershell
$dst = "$env:USERPROFILE\.dsh\skills\doc-engineer"
New-Item -ItemType Directory -Force -Path $dst, "$dst\references" | Out-Null
Copy-Item .\SKILL.md                                        "$dst\SKILL.md" -Force
Copy-Item .\references\doc-engineer-agent-prompt.md         "$dst\references\doc-engineer-agent-prompt.md" -Force
```

安装后，已安装副本与仓库内源文件应**逐字节相同**：两处
`references/doc-engineer-agent-prompt.md`、两处 `SKILL.md` 各用 `Get-FileHash` 比对，
哈希一致即判定同步完成（不存在需要人工维护的"基准值"）。

## 验证

零依赖，只需 Node.js（`node verify.mjs`，退出码 0 = 通过，非 0 = 失败）：

```powershell
node verify.mjs
```

脚本检查四件事：

1. 编码与行尾：`SKILL.md` 与 `references/doc-engineer-agent-prompt.md` 均无 UTF-8 BOM、
   行尾为纯 LF（`.gitattributes` 用 `* -text` 禁止 git 做行尾转换，两副本才能跨平台一致）；
2. 两副本一致性（**动态**，不再钉死 sha256）：剥掉 `SKILL.md` 第一个 `---` frontmatter 块后的
   正文，与 `references/doc-engineer-agent-prompt.md` 全文互为逐字节相同的字节序列；
   不一致时报出首个差异字节偏移。脚本同时打印两副本的 sha256 作为信息值，不参与判定；
3. 章节清单：正文的一级标题序列等于脚本内 `EXPECTED_H1` 的 13 节定稿清单
   （` ``` ` 围栏内的 `#` 行不计入）；改章节标题须同步该清单；
4. `SKILL.md` 的 frontmatter 合法（拒绝式严格校验，零依赖）：以 `---` 起始并闭合、
   结构为顶层 `key: value`、引号成对闭合且引号外无多余内容、无 tab 缩进、
   无未知键（**白名单只接受 `name`、`description`、`whenToUse`**，比 DSH 允许的键集更严）、
   `name` 精确等于 `doc-engineer` 且为 kebab-case、`description` 与 `whenToUse` 均为非空字符串；
5. DSH 目录渲染契约（见「兼容性核查（DSH 0.2.0）」）：`description` ≤ 500 字符
   （DSH `catalogDescriptionMaxLength` 默认值）且以触发句 `当用户要求` 开头——
   模型可见的目录行只有 `` - `name`: description `` 这一行。

frontmatter 校验是脚本内一个小解析器，刻意只覆盖本 skill 的 `key: 标量` 结构，
是对 DSH 接受条件的**子集近似**而非通用 YAML 解析器：遇到更复杂的写法它报失败，
而不是放水通过——宁可要求同步更新脚本，也不对 DSH 会静默丢弃的文件报 ok。

也可以手工比对两副本（哈希相等即一致，无需对照任何固定基准值）：

```powershell
Get-FileHash -Algorithm SHA256 .\SKILL.md, .\references\doc-engineer-agent-prompt.md
```

（`SKILL.md` 含 frontmatter，与 `references/` 的哈希本就不同；要比对的是
"剥掉 frontmatter 后的正文"与 `references/` 全文，这一步交给 `node verify.mjs` 做。）

## 兼容性核查（DSH 0.2.0）

本节记录 2026-09-30 在本机 DSH 0.2.0-rc.2 上实测的 skill 装载契约，用于排查
「skill 明明装了，会话里却看不到 / 不再被触发」这类问题。结论先说：**0.2.0 没有改动 skill 子系统**
（`dsh-skill`、`dsh-skill-filesystem`、`dsh-tool-skill` 三个包与 0.1.7-rc.2 逐字节相同，
四个内置 preset 也逐字节相同），本 skill 的文件也未被升级触碰——看不到 skill 只会是下面四个
装载条件之一不满足：

| 条件 | DSH 0.2.0 的实际行为 | 本 skill 的现状 |
| --- | --- | --- |
| 文件位置 | 目录包只认 `<skill 根>\<name>\SKILL.md`，且只扫一层；嵌在 `references/` 等子目录里的 `SKILL.md` **不会被发现** | 装在 `%USERPROFILE%\.dsh\skills\doc-engineer\SKILL.md` |
| frontmatter | 必须有 `name` + `description`；可选 `whenToUse`/`metadata`/`disable-model-invocation`/`user-invocable`。出现旧写法 `disableModelInvocation`/`modelInvocable`/`userInvocable` 时 dsh-skill-filesystem **丢弃整个文件**（skill 等于消失） | 只用 `name`/`description`/`whenToUse`；`verify.mjs` 用白名单拒绝其它任何键 |
| 模型可见文本 | 目录只渲染一行 `` - `name`: description ``；**`whenToUse` 既不进目录、加载正文后也不渲染**；`description` 超过 `catalogDescriptionMaxLength`（默认 500）会被截成 `...` | 触发句写在 `description` 开头，总长 < 500 字符 |
| 会话作用域 | skill 目录由该会话组成（agent preset）里挂载的 `skill-filesystem` 决定：组成里没有 skill 行的会话看不到任何 skill；子智能体会话（`delegationDepth ≥ 1`）**不发布**技能目录 | 主会话（`adg`/`cordis`/`standard` preset）都能看到 |

排查顺序（本机实测有效）：

1. **文件在不在、是否逐字节同步**：比对安装副本与仓库源文件的 `Get-FileHash`（见上一节）；
2. **frontmatter 合不合契约**：`node verify.mjs`（不合契约会被 DSH 静默跳过）；
3. **该 profile 的组成里有没有 skill 行**：`dsh --profile <name> --dump-config | Select-String skill`；
4. **该会话到底发过没有**：在会话记录里搜 `available_skills`；**子智能体会话不会出现该目录行，这是设计如此，不是 skill 丢失**。

## 许可证 / 来源

内容为项目内部角色规范；`references/` 保存的是与 `SKILL.md` 正文逐字节一致的副本。
正文按定稿方案改版（v4.2：三条硬纪律——文档只描述当前项目状态、不保留任何历史信息；过程文档
不被 git 跟踪；需求完成后必须清除过程文档，并新增「如无必要，勿增实体」原则，质量红线扩为 15 条；
v4.1：引用一律以内容/符号/契约/版本锚定，**禁止行号**；钉 sha 的
permalink 仅作可选补充，且必须同时给出人类可读标注；v4：新增「引用形式规范」，规定同仓库/跨仓库的路径与链接写法，
质量红线扩为 13 条；v3：新增「第一原则：文档首先是写给人看的」，原「人类扫读契约」升级为
「人类可读与可审核契约」并前置，行数预算等机器侧约束加入"以人读为准"的冲突规则；
v2：新增「定位」「过程与状态文件」「人类扫读契约」，执行载体二元化，质量红线扩为 12 条），
演进历史由 git 承载，文档内不留旧版说明。