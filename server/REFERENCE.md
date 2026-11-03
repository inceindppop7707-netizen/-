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
