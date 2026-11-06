# between-us 学习笔记

## 架构
- **纯静态 HTML/CSS/JS**，无构建步骤，无框架（React/Vue）。多个 JS/CSS 文件按顺序加载，共享顶层变量
- `dist/index.html` 是入口，包含所有HTML结构。JS分成：app.js（主菜单逻辑）、chat-settings.js（聊天+设置）、scenes.js（小页面）、motion-gsap.js（GSAP动效）、feature-pages.js（音乐盒/记忆库/相册/信）
- 服务端只是个静态文件服务器（server.mjs，12行），**无AI后端**——聊天是本地存储的记录，标注"未连接AI"

## 前端设计模式
- **hash路由**：`#home`/`#talk`/`#settings`，通过 `hidden` 属性切换 view section，用 `history.replaceState` 更新URL
- **数据存储**：所有数据在 localStorage（文字偏好）+ IndexedDB（图片音频）。有完整的导入导出备份功能
- **偏好系统**：fontSize、typeScale、density、lineHeight、showTime 等可配置，CSS变量驱动，实时预览
- **消息模型**：`{id, role, date, text, edited}` 简单明了。支持编辑、删除、撤销、搜索高亮

## 聊天UI
- 左右分布式气泡，incoming（AI）在左，outgoing（用户）在右
- 头像（28px圆形）+ 内容区 + 元信息（时间+编辑标记+更多按钮）
- 连续同侧消息用 `is-followup` 类压缩间距
- 输入框：圆角pill形，Enter换行/Ctrl+Enter发送可配置，字数统计，草稿自动保存
- 搜索：顶部搜索栏，实时过滤+高亮匹配文字

## CSS/设计
- **骨瓷白纸底**（#f2f2ef）、黑字（#242522）、小面积克莱因蓝（#1834d4）——极简印刷感
- 字体：Times New Roman + Noto Serif SC，衬线为主
- 大量使用 `cqw`（container query width）实现响应式缩放
- 类型缩放公式：`max(8px, round(nearest, calc((Xpx) * var(--type-scale, 1)), 4px))` 保证4px对齐
- 没有暗色模式——纯白纸质感设计
- GSAP用于页面过渡和开屏动画（可关闭，支持 prefers-reduced-motion）

## 值得学的
1. **偏好系统**：CSS变量驱动的字体大小/行高/气泡密度/时间显示，实时生效，非常实用
2. **消息编辑+撤销**：不只是发送，还能编辑已发的消息、撤销删除
3. **搜索高亮**：`appendHighlighted()` 函数，简洁有效
4. **导入导出备份**：完整的数据导出为JSON + 导入恢复
5. **连续消息合并**：`is-followup` 减少视觉重复
6. **草稿保存**：输入框内容自动存 localStorage
7. **无框架纯JS**：证明复杂UI不需要React，vanilla JS足够

## 不需要的
- GSAP重动效（我们走的是暗色安静风格）
- 骨瓷白设计语言（我们是深色玻璃感）
- 本地存储为主（我们用Supabase）
- 无AI连接（我们已有后端）
