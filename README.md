# doc-engineer — DSH skill

这是一个 **DSH skill**（DeepSeek Harness 技能包），封装项目「**文档工程师**」角色规范。

它定义的不是"介绍项目"的文档写法，而是一套**供零上下文智能体安全施工的文档认知系统**：
人扫读、机检索、约束可执行、状态可接力；过程件（changelog / handoff / 待决清单 / 工作稿）
隔离于 git 排除的临时工作目录，版本区只留最终真相。适用于撰写 / 维护 / 评审项目设计文档、
模块文档、`AGENTS.md` 文档体系治理，以及按质量红线清单自检与返工文档。

## 目录结构

```
agentic-doc-skill/
├── SKILL.md                                # skill 入口：YAML frontmatter + 角色规范正文
├── references/
│   └── doc-engineer-agent-prompt.md        # 角色规范正文副本（与 SKILL.md 正文逐字节一致）
├── README.md                               # 本文件
├── verify.mjs                              # 零依赖自检脚本
└── .gitignore
```

### 关于 `SKILL.md` 与 `references/` 的关系

`SKILL.md` 的正文与 `references/doc-engineer-agent-prompt.md` **逐字节相同**；
`SKILL.md` 只是在正文之前多了一段 DSH 强制要求的 YAML frontmatter：

```yaml
---
name: doc-engineer
description: 项目「文档工程师」角色规范：产出供零上下文智能体安全施工的文档认知系统……
whenToUse: 用户要求为项目编写或维护 AGENTS.md、design.md、testing-guide.md 等施工型文档……
---
```

两副本的一致性由 `verify.mjs` **动态校验**（不钉死哈希常量）：脚本剥掉 `SKILL.md` 的第一个
`---` frontmatter 块，把余下正文与 `references/doc-engineer-agent-prompt.md` 全文逐字节比对。
所以改正文只需**同步改两处**（推荐流程：改 `references/`，再用它重建 `SKILL.md` 的正文），
不必更新任何期望值；只有改动章节标题才需要同步脚本里的 `EXPECTED_H1` 清单。

正文的一级章节清单（11 节，顺序即阅读顺序，与 `EXPECTED_H1` 一致）：

1. `# 角色`
2. `# 定位（与 plan/spec 相反）`
3. `# 设计哲学（不可违背）`
4. `# 工作方式（loop 工作法）`
5. `# 过程与状态文件（临时工作目录）`
6. `# design.md 写作规范`
7. `# AGENTS.md 维护规范（最高优先级文档）`
8. `# 其他文档规范`
9. `# 人类扫读契约`
10. `# 质量红线清单（交付前逐条自检；载体标注：[机检]=脚本可判，[评]=对抗评审可判，[人]=登记 pending.md）`
11. `# 反模式（出现即返工）`

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
3. 章节清单：正文的一级标题序列等于脚本内 `EXPECTED_H1` 的 11 节定稿清单
   （` ``` ` 围栏内的 `#` 行不计入）；改章节标题须同步该清单；
4. `SKILL.md` 的 frontmatter 合法（拒绝式严格校验，零依赖）：以 `---` 起始并闭合、
   结构为顶层 `key: value`、引号成对闭合且引号外无多余内容、无 tab 缩进、
   无未知键（**白名单只接受 `name`、`description`、`whenToUse`**，比 DSH 允许的键集更严）、
   `name` 精确等于 `doc-engineer` 且为 kebab-case、`description` 与 `whenToUse` 均为非空字符串。

frontmatter 校验是脚本内一个小解析器，刻意只覆盖本 skill 的 `key: 标量` 结构，
是对 DSH 接受条件的**子集近似**而非通用 YAML 解析器：遇到更复杂的写法它报失败，
而不是放水通过——宁可要求同步更新脚本，也不对 DSH 会静默丢弃的文件报 ok。

也可以手工比对两副本（哈希相等即一致，无需对照任何固定基准值）：

```powershell
Get-FileHash -Algorithm SHA256 .\SKILL.md, .\references\doc-engineer-agent-prompt.md
```

（`SKILL.md` 含 frontmatter，与 `references/` 的哈希本就不同；要比对的是
"剥掉 frontmatter 后的正文"与 `references/` 全文，这一步交给 `node verify.mjs` 做。）

## 许可证 / 来源

内容为项目内部角色规范；`references/` 保存的是与 `SKILL.md` 正文逐字节一致的副本。
正文按定稿方案改版（v2：新增「定位」「过程与状态文件」「人类扫读契约」，
执行载体二元化，质量红线扩为 12 条），演进历史由 git 承载，文档内不留旧版说明。