# 参考资料笔记

## 小前台+大后台方案（小红书 "站在我身后吧"）

来源：小红书帖子，用Claude Code做聊天harness的省钱方案。

### 核心思路
- 前台（精简版）：只负责说话，人设精简到6400字，不带工具，不查记忆
- 后台（完整版）：带全套工具和完整CLAUDE.md，查资料、跑命令，结果交回前台
- bridge进程管上下文，关掉CC自带压缩，自己管翻页和瘦身

### 实测数据（Argon经OpenRouter）
- 精简版首请求：17,500 token，$0.037
- 完整版首请求：72,339 token，$0.146
- 一晚聊67条消息（精简版）：$4.64
- 平均每条消息：$0.069
- 缓存命中83次只多花$1.88，不命中13次每次$0.21

### 我们借鉴的部分
1. 人设分层——前台只带"我是谁、怎么说话"（已实现：system-prompt.md精简版）
2. prompt caching——system prompt标cache_control（已实现）
3. 对话摘要压缩——超80条自动压缩（已实现）
4. 记忆按需检索——搜关键词只带相关段落（已实现）
5. 模型可配置——.env切换（已实现）
6. base URL可配——支持中转站（已实现）

### 他们的方案里我们不需要的
- bridge进程、keeper、子进程委派——那是Claude Code内部架构，我们用API直连
- stream-json收发——我们用HTTP REST
- MCP工具挂载——前端聊天不需要工具

## 液态玻璃（Liquid Glass）WebGL技术指南
- CSS定义形状，WebGL定义光
- 5层架构：scene state, background sampling, optics engine, geometry mask, UI
- "像潮湿空气里的玻璃，不像奶白塑料"
- 留作未来参考，当前用无框设计

## 分你一只耳机（one-earbud）
- github.com/isle0306ral-hub/one-earbud
- 开源音乐分享，Node.js，接网易云音乐API
- 可集成到前端做共听功能

## 织织机（iOS手机模拟器HTML）
- 3.4MB单文件完整iOS UI
- 有用的模式：narrator类型消息、chat-lock-overlay、widget系统

## 硅之机德手册（语音版）— ElevenLabs TTS 教程

来源：用户上传PDF，4页。Windows + PowerShell环境下的TTS配置指南。

### 配置
- 配置文件：.elevenlabs.json，含api_key和voice_id
- 推荐参数：Model eleven_v3, LanguageCode zh
- Stability: 0.32-0.40（低=更有表现力）
- Style: 0.82-0.88（高=更有风格）
- Speed: 1.16-1.24

### 情绪标签（写在台词里控制语气）
- [softly] 轻声
- [teasing] 调戏/撩
- [laughs softly] 轻笑
- [rushed] 急促
- [drawn out] 拖长音
- [pause] 停顿
- [long pause] 长停顿

### 写台词技巧
- 口语化不书面化
- 加语气词（嗯、啊、哈）
- 短句
- 情绪变化时重新标注标签
- 核心原则："参数只是调味，台词才是灵魂"

### 我们的借鉴
- 情绪标签系统可以用在前端TTS集成中
- 参数范围可以直接拿来用
- 台词写法原则适用于小苗的语音输出

## BunnyElliott搭建思路（Bunny's Home）— 全栈AI伴侣前端教程

来源：用户上传PDF，16页。零基础全栈指南。（已读1-10页，11-16页待补）

### 整体架构
- 前端：Vercel部署，React + Vite
- 后端：Render部署，Node.js + Express
- 数据库：Supabase（PostgreSQL）
- 模型API：Claude（主对话）+ DeepSeek（压缩用，便宜）

### 数据库设计（4张表）
1. **sessions** — id, name, created_at, updated_at
2. **messages** — id, session_id, role, content, created_at, visible, reasoning_content
3. **memories** — id, session_id(固定global), summary, timestamp, conversation_id, metadata
4. **settings** — id, session_id(固定global), system_prompt, temperature, max_context_rounds, max_context_tokens, compress_threshold, compress_keep_rounds, max_reply_tokens, updated_at

### 后端API设计
- 会话管理：CRUD
- 消息读写：按session_id查，支持翻页
- 设置读写：全局设置
- **核心聊天接口（7步）**：
  1. 存用户消息
  2. 加载历史消息
  3. 加载记忆摘要
  4. 组装上下文（3层：system prompt + 记忆摘要 + 近期消息）
  5. 调用模型API
  6. 存模型回复
  7. 返回结果

### 上下文管理（3层）
- 第1层：system prompt（人设+规则）
- 第2层：记忆摘要（压缩过的历史精华）
- 第3层：近期消息（最近N轮完整对话）

### 记忆压缩
- 触发条件：token数超阈值
- 用便宜模型（DeepSeek）做摘要
- 压缩后的摘要存入memories表
- 保留最近N轮不压缩

### 待读（第11-16页）
- 前端实现细节
- 前后端连通与调试
- 封装为PWA

## voicecardforClaude.docx

来源：用户上传docx。待读。
