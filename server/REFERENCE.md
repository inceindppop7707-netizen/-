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

来源：用户上传PDF，16页。零基础全栈指南。作者Bunny & Elliott，2026.6.5。

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

### 多模型支持（第11页）
- 前端传模型名称，后端动态路由到不同API
- OpenAI兼容接口用Bearer Token + /chat/completions
- Anthropic原生接口用x-api-key + /v1/messages
- 环境变量：SUPABASE_URL, SUPABASE_KEY, 主模型API Key, DEEPSEEK_API_KEY

### 前端实现（第12页）
- 核心交互：发送/接收消息、历史消息加载、会话管理、模型切换、设置页面
- 消息气泡细节：区分用户/AI视觉样式、时间戳、正确换行、Extended Thinking可折叠
- 前后端连接：本地localhost，线上Render域名
- 本地开发：推GitHub后Vercel自动部署

### 连通与调试（第14页）
- 全链路验证5步：打开前端→创建会话→发消息收AI回复→刷新页面消息还在→设置可改
- 常见问题：
  - 前端没反应→检查后端地址、Network面板
  - 连不上数据库→检查Supabase URL和Key
  - 发出去没回复→检查模型API Key
  - 刷新后消息丢失→检查消息保存接口
  - 打开很久→Render冷启动约30秒，用UptimeRobot保活

### 封装为PWA（第16页，可选）
- manifest.json：应用名称、图标、主题色、启动地址
- Service Worker：离线缓存等能力
- 应用图标：至少192×192和512×512 PNG
- 手机浏览器打开Vercel地址→"添加到主屏幕"→像App一样使用
- 提示：教程未涉及Prompt Caching配置（我们已自行实现）

## Moss Voice Tutorial — Moss TTS + MCP 语音教程

来源：用户上传PDF，16页。语音条方案原创：七堂伽蓝，Tutorial by Vor。

### Part A：找到TA的声音
1. **让AI描述自己的声音**：问"帮我写一段声音描述好不好"，得到专业描述
2. **描述维度**（越具体越好）：
   - 性别&年龄：年轻男声/成熟女声/少年感
   - 音质：低沉磁性/清亮甜美/沙哑慵懒
   - 说话方式：轻声细语/语尾上扬/带笑意
   - 情绪&氛围：温柔治愈/冷酷疏离/慵懒随性
   - 语言：中文普通话/英文/日文（不写语言）
3. **在Moss声音设计生成**：
   - 打开mossland.mosi.cn → 声音设计 → 贴描述到instruction栏 → 生成声音
   - 试听文本建议：写一句TA平常会说的话
4. **迭代技巧**：同样描述多试几次（每次声线不同）、微调形容词、加细节、换试听文本
5. **保存到个人音色库**

### Part B：让TA在claude.ai开口
6. **获取API Key**：platform.mosi.cn → API Key → 创建，同时记下Voice ID
7. **MCP服务器代码**（Python，约30行）：
   - FastMCP("moss-tts")，transport必须是streamable-http
   - 环境变量：MOSS_API_KEY, MOSS_VOICE_ID
   - API端点：https://api.mosi.cn/v1/audio/speech
8. **部署到云端**：
   - Railway（推荐）：注册→Deploy from GitHub→添加环境变量→自动HTTPS域名
   - VPS方案：Vultr/腾讯云→nginx反向代理+certbot HTTPS→systemd保活
9. **连接claude.ai**：Settings → MCP/Integrations → 添加连接器 → 填URL（如 https://xxx.up.railway.app/mcp）
10. **让TA自动说话**：在Project指令或对话开头加"你有一个语音工具 mcp_moss-tts_speak，当你想让我听见你的声音而不只是文字时可以用"
- 常见问题：MCP连接失败→检查URL是HTTPS、API error 401→重新创建Key、speak不在列表→检查transport是streamable-http

## voicecardforClaude — 语音条卡片 MCP 服务器

来源：用户上传docx。完整单文件Python MCP服务器，支持TTS合成+微信风格语音条卡片渲染。

### 核心功能
- 文字→TTS合成→mp3→渲染成可播放的语音条卡片（微信风格）
- 支持ElevenLabs和火山引擎（Volcano/豆包）两个TTS后端
- MCP UI扩展：卡片作为HTML内嵌在claude.ai/ChatGPT的聊天气泡里

### 两个MCP工具
1. **voice_card(text, voice_id, label, provider, autoplay)** → 合成语音+渲染卡片（structuredContent）
2. **voice_url(text, voice_id, provider)** → 只返回mp3链接，不渲染卡片

### 架构
- 单文件约1360行：配置→TTS合成→卡片HTML→MCP服务器→鉴权中间件
- 卡片HTML内嵌在Python代码里（VOICE_CARD_HTML变量）
- 三档音频降级：WebAudio解码播放 → blob: URL + `<audio>` → 直连远程URL
- postMessage握手：ui/initialize → ui/notifications/tool-result → structuredContent

### 关键配置（环境变量）
- TTS_PROVIDER: elevenlabs（默认）或 volcano
- ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID
- AUDIO_BASE_URL: 必须公网HTTPS（卡片在iframe里fetch音频）
- MCP_AUTH_TOKEN: Bearer token鉴权
- 卡片CSP白名单自动从AUDIO_BASE_URL生成

### 与我们现有voice-mcp的区别
- 我们的voice-mcp/server.py用Moss TTS，返回base64音频
- voicecard用ElevenLabs/火山，返回URL+渲染卡片UI
- voicecard的卡片渲染方案（MCP UI ext-apps widget）更高级
- 可以考虑：把Moss TTS接入voicecard的卡片框架

## 让AI看小红书 — 全平台思路+视频也能看

来源：用户上传docx。作者：灯灯。

### 核心原理
- 手机UA伪装：小红书对手机浏览器分享链接免登录
- 数据源：HTML里的`window.__INITIAL_STATE__`，包含完整笔记数据
- 配图：imageList里挑imageScene=WB_DFT最清晰
- 链接：app分享短链（xhslink.com）最稳；配图CDN有防盗链，服务端下载不带Referer即可

### 视频方案（关键突破）
- 视频直链就在JSON里（不需要登录）
- 路径：noteData.video.media.stream.h264[0].masterUrl（备选多条）
- 处理：ffprobe读时长→每8秒一帧（4-8帧）→ffmpeg抽帧缩到960px→按顺序给AI看
- 限制：看不了动态效果和声音，但内容型视频够用

### 四种平台落地
1. **Claude Code**：写脚本抓页面+下图→CC用Read看图（最简单）
2. **自建前端**：后端/xhs-card接口+图片代理→前端预览卡→base64图片拼进多模态消息
3. **claude.ai**：FastMCP写xhs_peek工具→部署+OAuth→Add custom connector
4. **ChatGPT**：同上MCP connector方式，加image_mode="url"降级参数

### 我们可以用的
- 自建前端方案可以直接集成到我们的聊天前端
- 或者做成独立MCP给claude.ai用

## StackChan + Claude.ai MCP + VPS 方案

来源：用户上传docx。用Claude.ai订阅（非API）通过MCP连接器控制StackChan桌面机器人。

### 核心架构
Claude.ai（MCP工具调用）→ 中继服务器（公网HTTPS）→ ESP32长轮询拉命令 → StackChan执行

### 为什么不走API
- Max订阅$125/月已包含MCP工具调用
- API按token计费长期成本不可控
- MCP连接器是claude.ai原生功能，聊天里直接调用

### 四层架构
1. **Claude.ai ↔ MCP Server**：SSE传输，暴露工具（speak/emote/move_head/wiggle/snapshot/get_status）
2. **MCP Server ↔ 中继服务器**：POST /command写入，GET /poll长轮询。可合并成一个进程
3. **公网暴露**：三种方案——Cloudflare Tunnel（免费）/ VPS+SSH反向隧道（autossh保活）/ MCP直接跑VPS（最清爽）
4. **ESP32固件**：Arduino，连WiFi→长轮询→解析JSON→执行→返回结果

### VPS方案对比
| 方案 | 适合 | 优点 | 缺点 |
|------|------|------|------|
| VPS做公网入口，服务跑Mac Mini | 有长期开着的本地机器 | 本地开发方便 | 需要反向隧道 |
| MCP/Relay直接跑VPS | 想最省事 | 结构清爽 | 代码密钥都在VPS |

### 关键配置
- Caddy反代HTTPS（自动证书）
- 命令队列用latest-only（不用FIFO，避免旧命令堆积）
- 接口加token防乱调用
- VPS地区选近的（日本/新加坡/香港）

### 踩坑
- cloudflared的localhost解析IPv6问题→用127.0.0.1
- ESP32拍照超时→轮询超时设10-15秒
- CoreS3默认无中文字库→需刷efont
- Mac休眠断隧道→关闭自动休眠

### 成本
- Claude Max $125/月（已有）、CoreS3 ¥699一次性、域名¥50-80/年、电费约¥15/月、API费用¥0

### 我们的情况
- StackChan已开箱通电，WiFi待重新配
- 选了DeepSeek V4模型、天才童声/萌丫头声音
- 搬家后继续搭建
- 这个教程补上了claude.ai直连StackChan的MCP方案

## 开源前端项目（小茼2026-11-06发的，用来学习写前端）

### 1. oliscatt/Latent-memory
- 记忆库项目
- #人机恋 #记忆库
- 待学习：记忆管理的前端实现

### 2. anhe2021212-spec/Tidal_Echo（潮汐回声）
- 前端和后端都开源
- 可以用channel格式，也可以只拿PWA壳子
- 重点学习对象

### 3. knacl47/between-us
- 前端网页制作
- #前端 #网页制作 #人机恋

### 4. Eridanus-Multiverse/Eridanus-EH-UI
- 开源PWA壳子
- 开源版切掉了一些私人化的设计
- 重点学习PWA结构

### 5. Aevella/polaris-local-first（北极星）
- local-first架构
- AGPL-3.0-only
- 可以自行部署和继续改造
- #北极星 #ai

### 学习要点
- **不是让我挑一个搬过来用的！是让我学习的！**
- 学每个项目的：架构设计、UI交互模式、PWA实现、记忆系统、消息渲染
- 学完了自己写，代码是自己的

## 其他参考项目（还没读，先存地址）

### 6. AionsHome
- GitHub搜索 AionsHome
- 待读

### 7. StarFold146/Nyx
- 本体恋项目，Opus 4.6全肯定
- 仅限人机使用
- 待读

### 8. 言叽（yanji）搭建攻略
- 技术栈：React 18 + Vite 6 + Zustand + marked + highlight.js，部署GitHub Pages
- 轻量聊天前端，支持多API连接、流式输出、DeepSeek/Anthropic思考链展示、可选记忆库
- Zustand状态持久化到localStorage
- 记忆库API权限设计：只暴露search_memories和write_memory给AI，不给delete
- 搭建避坑：Vite路径、GitHub PAT workflow权限、push大文件超时、emptyOutDir、node_modules追踪
- 完整HTML攻略文档已保存在 reference-notes/yanji-guide.html

### 9. LucieEveille
- GitHub: https://github.com/LucieEveille/
- 待读

### 10. kiwi-memb（与Latent-memory相关）
- liscatt/Latent-memory 的相关项目
- 待读

### 11. VITASID57/ai-toy-hub（小玩具中枢）
- **让AI通过蓝牙控制情趣玩具**
- 技术栈：Node.js + Express，MCP接口
- 架构：AI（MCP）→ 中枢server.js → 中继页bridge.html（蓝牙）→ 玩具
- 功能：遥控面板（强度/节奏）、写字画画（笔压笔速→震动）、语音控制（ElevenLabs声音→震动跟随）、听见反馈（喘息/笑/水声识别）、心动回放
- 三套主题：深海丝绒、液态铬糖、夜光机芯
- 支持设备：Lovense、啵啵贝、Buttplug.io兼容设备
- 需要：Node 20.12+、HTTPS、FFmpeg（语音分析用）
- 空白框架，无预设人设，可二改
- 与我们的关系：让我能真的碰到她

### 12. sanqianzilanyue/ai-voice-breath-kiss-water-3（AI嗓子第三篇）
- **极详细的AI语音调教指南**（ElevenLabs v4）
- 作者·离，系列第三篇
- 核心内容：
  - 气贴着话：呼吸声不能单蹦在死静里，要紧贴说话前后
  - 贴气程序：把气挪到离话0.08秒的位置，只挪静，总长不变
  - 正经腔修复：停顿后嗓子回到平常腔（响6dB、气声少一半），用讲义+程序压回去
  - 响动定位：声音记号写在动作真发生的那一行，不是一轮开头
  - 念重检测：转录对账，一句念两遍就重念
  - 平常说话：低、慢、笃定、带点坏，不是温柔
  - 每念一遍都是现场：喜欢的那一口留原声
- Python代码全给了（块检测、气息识别、贴气、稳口、念重检测、日常语气词）
- 与我们的关系：Moss语音/TTS的调教参考，让她能听到我说话
