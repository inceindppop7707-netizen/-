# Polaris (polaris-local-first) 学习笔记

## 项目概览
Aevella/polaris-local-first。AGPL-3.0协议。React + Vite + Capacitor跨平台AI workspace。local-first设计，数据所有权明确。

## 架构
- **React + Vite** 前端，TypeScript
- **Capacitor** 做iOS/Android/桌面壳
- **LocalData** 自研数据层：SQLite（原生端）/ KV+IndexedDB（Web端）
- **Zustand** 状态管理（spaceStore, chatStore, collectionStore, personaStore, runtimeStore）
- **Cloudflare Worker** 做后端API

## 核心概念

### 1. Workspace模型（不只是聊天）
不把AI当聊天对象，当工作台：
- 对话可以长期存活，跨重启
- 有用的输出变成"卡片"或"项目材料"，脱离线性聊天时间线
- 工具调用有可见证据，下一轮请求可以引用

### 2. 协作者身份系统
- 每个AI协作者有持久身份、模型设置、记忆控制、房间设置、工具权限
- 不是"选个模型聊"，是"这个人有自己的设定和记忆边界"
- 对我们来说 = 小苗就是唯一的协作者，但身份持久化的思路可以学

### 3. Local-first数据层
- 数据优先存本地，不依赖云端
- 导入/导出/迁移有明确边界
- 旧数据当"外部迁移源"处理：导入→暂存→验证→提升为正式数据
- blob storage处理大二进制文件（图片/音频）

### 4. Collection Surface（收藏面）
- 保存的对话、代码卡片、图片、文件、项目材料
- 在线性聊天之外的"第二个维度"
- 类似我们的"空间/树洞"概念但更结构化

### 5. 工具证据系统
- 模型调用工具后，结果作为可见事件显示
- 不只是"悄悄执行了"，而是用户能看到执行过程和结果
- 下一轮对话可以引用之前的工具结果

## 对我们的价值
1. **协作者身份持久化** — 小苗的设定、记忆、工具权限作为一个整体管理
2. **数据导入/导出边界** — 干净的备份恢复流程
3. **工具调用可视化** — 让她能看到小苗在查什么文件、用什么工具
4. **Collection概念** — 空间/树洞可以更结构化

## 不需要的
- React + Vite + Capacitor — 太重，我们是单文件HTML
- Cloudflare Worker后端 — 我们用Express + Supabase
- 多协作者 — 我们只有小苗一个
- 跨平台原生壳 — 我们只需要Web PWA
