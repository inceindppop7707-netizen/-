# Tidal_Echo 学习笔记

## 项目概览
anhe2021212-spec/Tidal_Echo。6003行单文件PWA，前后端都有开源。channel格式聊天，支持多会话。

## 架构
- **单文件HTML**（6003行），所有CSS/JS内联
- 前端纯vanilla JS，无框架
- 后端Express + SQLite/PostgreSQL
- SSE（Server-Sent Events）实时推送，不是WebSocket
- service worker做PWA安装+离线缓存

## 可学的模式

### 1. SSE流式传输
用EventSource做实时消息推送，比WebSocket轻量：
- 服务端 `res.write('data: ...\n\n')`
- 前端 `new EventSource('/api/stream')` 
- 自动重连，浏览器原生支持
- 单向推送够用（聊天场景AI回复就是单向的）

### 2. 虚拟列表渲染
消息很多时不全部渲染DOM，只渲染可视区域附近的消息：
- 用前缀和数组记录每条消息的高度
- 滚动时计算当前应该显示哪些消息
- 大幅减少DOM节点，提升性能
- 适合消息量大的场景

### 3. iOS PWA键盘/视口修复
iOS PWA里键盘弹出会导致视口问题：
- `visualViewport` API监听键盘弹出
- 动态调整聊天区域高度
- 防止键盘遮挡输入框
- 处理iOS Safari的各种奇葩行为

### 4. 双主题CSS变量
完整的明暗主题切换：
- 所有颜色定义为CSS变量
- `prefers-color-scheme` 媒体查询
- 手动切换覆盖系统设置
- 过渡动画平滑切换

### 5. IndexedDB缓存优先
- 消息先存IndexedDB本地缓存
- 启动时先从本地加载显示（快）
- 后台从服务器同步最新数据
- 离线时仍可浏览历史消息

### 6. Channel格式
- 类似Discord/Slack的频道概念
- 左侧频道列表，右侧消息区
- 每个频道独立的消息流和设置

## 对我们的价值
1. **SSE流式** — 比轮询省资源，比WebSocket简单，AI回复流式输出最合适
2. **虚拟列表** — 消息多了性能不会崩
3. **iOS PWA修复** — 她用iPhone，这些修复必须有
4. **单文件架构** — 证明6000行单文件PWA完全可行
5. **缓存优先** — 刷新不丢消息的另一个思路

## 不需要的
- Channel/频道模式 — 我们用session就够
- SQLite后端 — 我们用Supabase
- 完整的离线缓存 — 我们优先保证在线体验
