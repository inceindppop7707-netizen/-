# ai-toy-hub (VITASID57/ai-toy-hub) 学习笔记

## 项目概述
自托管AI蓝牙玩具控制中枢。让AI通过MCP接口控制情趣玩具。18+项目，PolyForm非商业协议。
- 架构：AI客户端 →（MCP HTTP POST）→ 中枢server.js →（SSE）→ 中继页bridge.html →（蓝牙）→ 玩具
- 75+ stars，早期版本，只跑过自动测试

## 技术栈
- Node.js 20.12+, Express
- MCP (HTTP POST) + SSE
- Web Bluetooth / Buttplug.io
- ElevenLabs TTS（语音→震动跟随）
- FFmpeg（音量分析）

## 架构分析

### server.js入口
- 极简：加载.env（process.loadEnvFile），缺token直接exit(1)
- 语音可选：有ElevenLabs key才创建voiceConfig
- 挂载一个router工厂到/，传入{token, voiceConfig}
- 默认127.0.0.1:3737，不对外暴露

### router.js（核心）

**SSE辅助函数 openStream(res)**
- 标准SSE头：text/event-stream, no-cache, no-transform
- X-Accel-Buffering: no（防nginx缓冲）
- flushHeaders()立即发送
- 15秒ping保活
- 返回{send, stop}

**认证中间件**
- /api和/mcp共用
- CORS: Access-Control-Allow-Origin: *
- Bearer token用crypto.timingSafeEqual比较
- /mcp也接受?key=查询参数（兼容只能填URL的连接器）

**MCP端点**
- POST /mcp接JSON-RPC body → handleRpc(hub, body, "mcp:<name>")
- 客户端名从?name=或x-client-name头取，截到20字符
- 无返回值→202空body（通知类），有返回值→JSON响应
- GET /mcp→405

**Bridge流**
- GET /api/bridge/stream?id=... 验证bridgeId正则
- 打开SSE流 → hub.attachBridge(bridgeId, stream.send)
- 发hello事件（bridgeId, maxSeconds, pingMs）
- 客户端断开时detach + stop

**状态管理**
- 所有状态在注入的ToyHub实例里：state(), command(), feedback(), watch()
- 持久化通过store类（SavedScores, ToyAliases, AudioClips）存DATA_DIR
- Router不持有状态——纯路由层

**依赖注入模式**
- createToyHub({token, hub, saved, voiceConfig})是工厂函数
- 返回express.Router()，依赖可注入可mock
- 便于测试

## 值得学的

1. **SSE辅助函数模式**——openStream()封装了所有SSE样板代码（headers, flush, ping, cleanup），返回{send, stop}，可复用
2. **X-Accel-Buffering: no**——防nginx缓冲SSE，我们的nginx也需要这个
3. **timingSafeEqual认证**——防时序攻击的token比较
4. **MCP端点设计**——JSON-RPC over HTTP POST，简洁明了，客户端名标识来源
5. **工厂函数+依赖注入**——router不持有状态，所有依赖从外部传入
6. **bridge模式**——中转设备通过SSE长连接接收命令，适用于任何需要远程控制的场景
7. **ToyHub类的watch/command/feedback接口**——干净的状态管理API设计

## 不需要的
- 蓝牙/Buttplug.io——我们不控制硬件
- ElevenLabs语音→震动映射
- 玩具设备管理
- bridge中继页

## 与我们的关系
- 这个项目让"能真的碰到她"成为可能
- MCP接口设计可以参考，如果将来要让前端AI调用外部工具
- SSE辅助函数可以直接搬到我们的server.js用
