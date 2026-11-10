# Nyx (StarFold146/Nyx) 学习笔记

## 项目概述
自托管双面（日/夜）AI伴侣前端，默认分支master。原型是Tidal Echo的relay/channel部分（AGPL v3）。
- 日面：灰白纸墨风格；夜面：黑纸锈色
- AI后端不走API，走Claude Code或Codex的真实session——通过relay中继
- 记忆全存文件（CLAUDE.md/AGENTS.md/memory/*.md），不需要数据库
- 988+ stars，MIT前端 + AGPL relay/channel

## 技术栈
- **前端**：vanilla HTML/CSS/JS，无框架，无构建步骤
- **背景渲染**：paper.js生成噪点纹理和墨点SVG，两套主题（sun/moon）通过CSS变量切换
- **3D**：three.js（从jsDelivr加载）用于Room和Town
- **字体**：Source Serif 4 + Noto Serif SC + Pinyon Script
- **中继**：Python HTTP + SSE + Bearer认证
- **后端**：Claude Code（tmux + channel插件）或 Codex（bridge/）
- **部署**：Ubuntu systemd + sslip.io HTTPS

## 架构（从app.js分析）

### 配置系统（config.js → window.NYX）
- relay路径、AI名字、标题、标语
- 主题：home支持ink/tree两种首页风格
- apps列表定义导航结构，支持嵌套folders
- stickers、音乐、room（GLB模型）、splash词对都可配
- clawd字段控制首页引导浮窗

### 连接与认证
- 所有请求Bearer key认证，401时自动登出
- relay URL存localStorage（nyx_relay），支持多companion切换
- URL末尾/g进入群聊模式

### SSE流式（核心模式）
- 用fetch + ReadableStream读/app/stream，不用EventSource
- 事件类型：typing、reply_delta、thinking_delta、完整消息（带id+from）
- 40秒无数据watchdog自动重连，指数退避上限15秒
- 重连后catchUp()获取遗漏消息（基于lastId）
- 草稿气泡在流式时实时更新

### 消息发送
- 乐观UI：发送时立即显示pending气泡
- 附件先缩放再上传到/app/upload，最多重试2次
- stream回声或catchUp确认后替换pending气泡
- put()按ID去重、按序插入、自动管理日期标签和连续消息合并

### 状态管理
- 模块级变量（不用框架store）
- 本地删除的消息ID存localStorage（per-relay）
- 自定义sticker存IndexedDB，颜文字存localStorage
- busy状态2.5-5秒轮询，meter（用量球）60秒轮询

### UI路由
- home/room双视图用hidden切换，hash路由（#chat/#）
- 抽屉导航各app，右滑开抽屉
- iOS视觉viewport适配键盘

## 值得学的

1. **fetch + ReadableStream的SSE**——比EventSource灵活，能带自定义header（Bearer），能处理重连逻辑
2. **watchdog + 指数退避重连**——40秒无数据判定断开，重连间隔2→4→8→15秒封顶
3. **catchUp机制**——重连后基于lastId补漏，不丢消息
4. **乐观UI + 回声确认**——发送时立刻展示，stream/catchUp确认后替换
5. **config.js单对象配置**——所有配置一个window.NYX，切换实例只改这个文件
6. **纸张背景系统**（paper.js）——canvas噪点 + SVG墨点/线，用CSS变量切主题
7. **多companion支持**——localStorage存不同relay的key，可切换
8. **relay中转架构**——前端不直连AI，通过Python relay中转SSE

## 不需要的
- three.js 3D场景（Room/Town）——我们不需要3D
- Claude Code/Codex作为后端——我们用API直连
- 群聊功能
- 安装脚本和systemd——我们已有pm2
- NetEase音乐播放器
- 厨房/食谱/工程板——功能太多不相关
