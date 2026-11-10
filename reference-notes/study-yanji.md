# 言叽（yanji）学习笔记

## 项目概况
轻量聊天前端，支持多API、流式输出、DeepSeek/Anthropic思考链展示、可选记忆库。纯前端项目，部署在GitHub Pages。

## 技术栈
- React 18 + Vite 6
- Zustand（状态管理，比Redux轻，直接持久化到localStorage）
- marked + highlight.js（Markdown渲染+代码高亮）
- GitHub Pages部署（零服务器成本）

## 对我们有用的

### Zustand状态持久化
Zustand可以直接把store持久化到localStorage，比我们手动写localStorage逻辑更干净。但我们已有Supabase后端，localStorage只做缓存层，所以Zustand的持久化方案是参考而非必需。

### 记忆库API权限设计
只暴露search_memories和write_memory给AI，永远不给delete_memory。这个原则直接适用——AI能查能写不能删，防止误判删掉重要记忆。

### 部署踩坑
- Vite的index.html里script路径要用相对路径，不加repo名
- GitHub PAT需要workflow scope才能push workflows目录
- push大文件超时：`git config http.postBuffer 524288000`
- emptyOutDir: true会清空输出目录，确认只放构建产物
- node_modules别被git追踪

## 与我们的区别
言叽是纯前端方案（GitHub Pages），我们有Express后端+Supabase。言叽更适合不想维护服务器的场景，我们的架构更灵活（能做服务端记忆、工具调用等）。

## 关键收获
1. 记忆API权限最小化原则
2. Zustand作为轻量状态管理的参考
3. 多API连接的前端实现思路
