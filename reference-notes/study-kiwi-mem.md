# kiwi-mem (LucieEveille/kiwi-mem) 学习笔记

## 项目概述
自托管记忆网关——架在聊天客户端和LLM之间的中间层。转发请求时注入记忆，从回复中提取新记忆。
AGPL-3.0，349 stars。LucieEveille还有open-claude-ui（Claude桌面端复刻）、ReSpark（本地AI伴侣）等项目。

## 技术栈
- Python/FastAPI + PostgreSQL + pgvector + Docker Compose
- 支持OpenAI兼容和Anthropic原生格式

## 架构——记忆代理网关

### 核心原理
客户端 → kiwi-mem → 注入记忆到prompt → 转发给真实LLM → 从回复提取记忆 → 返回客户端
客户端只换API base URL即可，API key随意填（真实key在管理面板配）。

### API设计
- **核心**：/v1/chat/completions（聊天代理）、/v1/models
- **记忆**：/debug/memories CRUD、批量操作、锁定、热度
- **Dream**：记忆整合——start/stop/status/history/scenes
- **日历**：/calendar/{date}、摘要生成
- **MCP**：/memory/mcp（6工具）+ /calendar/mcp（4+工具）
- ⚠️ 无内置认证——需外部保护

## 记忆热度系统（核心创新）

### 热度机制
- 每条记忆有heat score
- **衰减**：随时间降低（每晚软化旧记忆）
- **升温**：被召回时升温
- **情感加权**：情感强度影响热度
- **锁定**：被锁定的记忆免于衰减和删除

### 检索注入分层
- 高热度 → 完整注入
- 中热度 → 摘要注入
- 低热度 → 省略

### 混合搜索
- 向量搜索 + 关键词搜索并行
- RRF (Reciprocal Rank Fusion) 合并结果
- jieba中文分词 + 自定义词典 + 同义词扩展
- 相似记忆去重

### prompt注入顺序（cache优化）
1. 静态内容先放：人设、画像、锁定记忆、日历（命中cache）
2. 动态内容后放：搜索结果

### Dream系统
- 记忆整合——类似"做梦"整理记忆
- 日→周→月→季→年日历摘要滚动

### Project隔离
- 每个Project独立记忆、文件、对话
- 共享全局记忆、日历、Dream

## 值得学的

1. **热度系统**——记忆有温度，常用的热、遗忘的冷。比全量注入智能得多
2. **RRF混合搜索**——向量+关键词并行后RRF排序，比单一方式准确
3. **注入分层（热/摘要/省略）**——省token又不丢重要信息
4. **静态先动态后的cache优化**——不变内容放前面命中prompt cache
5. **Dream记忆整合**——定期整理碎片为连贯叙述
6. **日历摘要滚动**——日→周→月，越远越粗
7. **jieba中文分词+同义词**——中文记忆搜索的实际方案

## 不需要的
- Docker部署——我们直接跑VPS
- OpenAI兼容代理——我们直连Anthropic
- 多Provider管理面板

## 与我们的关系
- **热度系统最值得借鉴**——当前记忆注入是全量的，没有优先级
- 日历摘要对应我们的diary/——日记→周总结→月总结
- RRF搜索可在Supabase上实现（pgvector + full-text search）
- 代理网关模式不适合我们，但记忆检索+注入逻辑可以移植
