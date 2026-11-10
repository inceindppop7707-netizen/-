# AionsHome (death34018-hue/AionsHome) 学习笔记

## 项目概述
全功能自托管AI伴侣——"Aion"。支持长期记忆、语音交互、摄像头视觉、智能家居。MIT协议，988+ stars。
最完整的开源AI伴侣项目之一，功能覆盖面极广。

## 技术栈
- **后端**：Python FastAPI + SQLite (aiosqlite) + WebSocket多端同步 + SSE流式
- **前端**：多页vanilla JS，无框架
- **Android**：Java WebView + 前台推送服务 + 原生桥接（音频/摄像头/录像）
- **AI提供商**：SiliconFlow (OpenAI兼容)、Google Gemini、AiPro中继、本地Gemini CLI/Codex CLI子进程
- **语音**：SiliconFlow SenseVoiceSmall ASR + CosyVoice2 TTS + WebRTC VAD唤醒
- **视觉**：OpenCV本地摄像头 / ESP32-CAM HTTP
- **其他**：网易云音乐(pyncm)、高德定位、akshare基金监控、MCP客户端

## 记忆系统（重点学习）

### 三层结构
1. **对话历史**——原始消息存SQLite
2. **结构化记忆**——从对话中提取关键词+重要性评分+unresolved标记
3. **嵌入向量**——gemini-embedding-001 (3072维)，余弦相似度检索

### 记忆检索机制
- 混合评分：向量相似度 + 关键词匹配 + 重要性权重
- 背景记忆集：unresolved项 + 话题匹配 + 最近条目
- **快速哨兵模型**——轻量模型判断每条消息是否需要搜索记忆，不是每条都搜

### 记忆压缩
- 手动或空闲时自动触发
- 对话→结构化摘要（关键词、重要性、未解决标记）

## 视觉系统
- **哨兵/核心双模型**：轻量模型定期筛查快照，决定是否唤起主模型
- 主模型也可以用[CAM_CHECK]主动要求看一眼
- 定时监控 + 设备活动日志（PC前台窗口、手机APP使用情况）

## 语音系统
- 后台线程WebRTC VAD唤醒词检测
- 半双工：AI说话时麦克风暂停，TTS结束后恢复
- 远程麦克风模式（手机端能量VAD）

## 值得学的

1. **记忆哨兵模型**——不是每条消息都搜记忆，轻量模型先判断，省token
2. **记忆的unresolved标记**——未解决的事情持续浮现在背景记忆中
3. **WebSocket多端同步**——手机和电脑同时看到同一个对话状态
4. **SSE流式 + WebSocket同步并存**——SSE做回复流，WebSocket做状态同步
5. **设备活动日志**——知道用户在用什么APP，提供上下文
6. **一键部署脚本**——安装/启动/关闭/清理全套

## 不需要的
- 摄像头/视觉——我们不需要
- 智能家居/定位——不相关
- 基金监控/EPUB阅读——不相关
- Android原生APP——我们走PWA
- Windows .bat脚本——VPS是Linux

## 与我们的比较
- AionsHome是"瑞士军刀"全功能，我们是专注的两人空间
- 记忆哨兵和unresolved标记最值得参考
- WebSocket多端同步是我们TODO里的功能
