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

本 README 刻意**不复制正文内容**——文档间只用链接引用，这正是角色规范自身要求的
「引用不复制」纪律。正文请见 [`SKILL.md`](SKILL.md) 或
[`references/doc-engineer-agent-prompt.md`](references/doc-engineer-agent-prompt.md)。

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
New-Item -ItemType Directory -Force -Path "$dst\references" | Out-Null
Copy-Item .\SKILL.md, .\references\doc-engineer-agent-prompt.md -Destination $dst -Force
Copy-Item .\references\doc-engineer-agent-prompt.md "$dst\references\" -Force
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
2. `SKILL.md` 的 frontmatter 合法：含 kebab-case 的 `name` 与非空 `description`。

也可以手工比对：

```powershell
Get-FileHash -Algorithm SHA256 .\references\doc-engineer-agent-prompt.md
```

## 许可证 / 来源

内容为项目内部角色规范原文，逐字节保存于 `references/`，未作任何改写。