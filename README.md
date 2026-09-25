# doc-engineer — DSH skill

这是一个 **DSH skill**（DeepSeek Harness 技能包），封装项目「**文档工程师**」角色规范。

它定义的不是"介绍项目"的文档写法，而是一套**供零上下文智能体安全施工的文档认知系统**：
人扫读、机检索、约束可执行、状态可接力。适用于撰写 / 维护 / 评审项目设计文档、模块文档、
`AGENTS.md` 文档体系治理，以及按质量红线清单自检与返工文档。

## 目录结构

```
agentic-doc-skill/
├── SKILL.md                                # skill 入口：YAML frontmatter + 角色规范正文
├── references/
│   └── doc-engineer-agent-prompt.md        # 角色规范原文（基准，sha256 见下）
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

基准副本的 sha256：

```
ee6d1864f8ff371b9420a06bff077c7be16bbd4de6412ca115aad0792c0886d5
```

README 自身不承载角色规范正文——正文只在
[`SKILL.md`](SKILL.md) 与 [`references/doc-engineer-agent-prompt.md`](references/doc-engineer-agent-prompt.md)
里全量保存，README 只用链接引用、不另存一份副本（这正是角色规范自身「引用不复制」纪律的用法）。
唯一例外是本文件第 5–7 行的角色定位摘要：它与 frontmatter 的 `description` 同源，
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

安装后，两处 `references/doc-engineer-agent-prompt.md`（仓库内 + 已安装）的 sha256
都应等于上面那个基准值。

## 验证

零依赖，只需 Node.js（`node verify.mjs`，退出码 0 = 通过，非 0 = 失败）：

```powershell
node verify.mjs
```

脚本检查两件事：

1. `references/doc-engineer-agent-prompt.md` 与 `SKILL.md` 正文（剥掉 frontmatter 后）
   互为逐字节相同的字节序列，且 sha256 等于附件原文 sha256；
2. `SKILL.md` 的 frontmatter 合法（拒绝式严格校验，零依赖）：以 `---` 起始并闭合、
   结构为顶层 `key: value`、引号成对闭合且引号外无多余内容、无 tab 缩进、
   无未知键（只接受 `name`、`description`、`whenToUse`、`metadata`、
   `disable-model-invocation`、`user-invocable`）、`name` 为 kebab-case、
   `description` 为非空字符串。

frontmatter 校验是脚本内一个小解析器，刻意只覆盖本 skill 的 `key: 标量` 结构，
是对 DSH 接受条件的**子集近似**而非通用 YAML 解析器：遇到更复杂的写法它报失败，
而不是放水通过——宁可要求同步更新脚本，也不对 DSH 会静默丢弃的文件报 ok。

也可以手工比对：

```powershell
Get-FileHash -Algorithm SHA256 .\references\doc-engineer-agent-prompt.md
```

## 许可证 / 来源

内容为项目内部角色规范原文，逐字节保存于 `references/`，未作任何改写。