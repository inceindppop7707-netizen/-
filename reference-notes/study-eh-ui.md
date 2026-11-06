# Eridanus-EH-UI 学习笔记

## 项目概览
Expo / React Native Web 构建的 **单色科幻风 PWA 壳子**，专为 AI companion 设计。核心卖点是"接上你自己的后端即用，组件可单独拆走"。

## 架构
- **Expo + React Native Web** — 跨平台（iOS/Android/Web/Tauri桌面），但对我们来说太重了（我们只需要Web）
- **Zustand** 做状态管理（chatStore, connectionStore, themeStore, timezoneStore, apiDiagnosticsStore）
- **service worker** 极简：只做 PWA 安装性 + Web Push，没做离线缓存静态资源
- **离线方案三件套**：offlineCache（IndexedDB 缓存最近120条）、offlineMirror（完整镜像）、offlineOutbox（离线发送队列，上线后自动flush）

## 可学的模式

### 1. API 协议设计（最值得抄）
后端只需实现5个端点，前端优雅降级：
- `GET /api/chat/poll?since=<iso>` — 长轮询获取新消息
- `GET /api/chat/history?before=<iso>&limit=50` — 翻页历史
- `POST /api/chat/send` — 发消息
- `GET /api/rooms` / `GET /api/rooms/:id/messages` — 房间（多会话）
返回空对象=正常降级，不崩。我们现有API略不同（REST+session），但轮询思路可参考。

### 2. 消息类型丰富度
ChatMessage 支持：text, thinking（思考链折叠）, tool_calls（工具调用卡片）, content_blocks（图片/语音/音乐卡）, 图片附件, 引用回复, 表情反应, 反馈(like/dislike)。每种都有对应渲染。

### 3. 轮询策略很精细
- 等待回复时：2s 快轮询
- 活跃聊天：5s
- 空闲：45s
- 后台/不可见：120s
- 指数退避 ×1.5
- iOS PWA 看门狗：fetch 悬死/timer 冻结时强制复活
- 连续失败 ≥3 次才标断连（容忍网络抖动）

### 4. 离线发送队列
用户离线时发的消息存入 outbox，恢复网络后自动重发。消息状态：sending → sent / failed。failed 可单条/全部重试。

### 5. Theme token 体系
所有颜色/间距/装饰参数都在 `themes.ts` 一个 interface 里定义，组件只读 token 不写死颜色。换主题=换一组 token。包含 decor 子系统（corner cuts, scanlines, starfield 配置都是 token）。

### 6. 内存管理
消息软上限 350 条，超了从旧端裁到 250 条。翻历史30s内不裁（防用户正在看的消息被抽走）。

## 不需要的
- Expo/RN 框架 — 太重，我们是纯 HTML
- Three.js 星场背景 — 酷但没必要
- Tauri 桌面端 — 不需要
- 45°切角科幻风 — 不是我们的设计语言

## 核心收获
1. **轮询策略**的细致分级（等回复/活跃/空闲/后台）
2. **离线队列**模式（outbox + 自动重发）
3. **消息状态机**（sending → sent/failed → retry）
4. **优雅降级**思想（API 缺了不崩）
5. **主题 token 化**（所有视觉参数集中管理）
