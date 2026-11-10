# player (lili0926/player) 学习笔记

## 项目概述
双人飞行棋——和AI对弈的骰子棋盘游戏。9个版本不同主题内容，从总览页选。
棋子停在格子上触发内容。聊天弹窗里掷骰子和执行事件，弹窗可最小化为可拖拽浮窗。进度存浏览器。

## 技术栈
- 纯HTML/CSS/JS，无构建步骤
- localStorage保存进度
- 无AI API调用——通过window函数暴露接口，宿主聊天应用注入prompt

## 架构分析

### 主页（index.html）
- BOARDS对象存所有棋盘数据（name + cells数组）
- makeCells()解析格子类型：start/end/special/normal
- 正则解析移动规则："后进N格"→backSteps，"退回N格"→jumpTo
- 7列CSS grid棋盘，玩家和AI棋子是绝对定位的小圆点
- 版本切换触发confirm()确认后重置

### 弹窗（flight-chess-popup.html）
- **不调AI API**——暴露window函数让宿主应用调用：
  - `flightChessAiRoll()` — AI掷骰移动
  - `flightChessHandleYourTurn()` — 玩家掷骰，返回{ok, event, injectPrompt, dice}
  - `flightChessBuildInjectPrompt(ev)` — 从停留格子构建注入prompt
  - `flightChessGetLastEvent()` — 获取最近事件副本
- 宿主负责把prompt注入聊天模型
- 骰子：Math.random() * 6 + 1
- movePiece：步数相加，clamp到最后格
- 到达最后格→finished，alert宣布赢家

### 浮窗（float-window.js）
- FlightFloat.init/show/hide/setPosText
- min-mode类控制弹窗隐藏/浮窗显示
- 浮窗显示当前位置信息

### 存档系统
- 两个localStorage key：flight_chess_progress（主）+ flight_chess_player（兼容）
- 保存：version, playerPos, aiPos, turn, finished, lastEvent
- 加载时校验version匹配

## 值得学的

1. **window函数接口模式**——游戏不直接调AI，而是暴露函数让宿主注入prompt，解耦彻底
2. **injectPrompt构建**——把游戏事件翻译成AI能理解的文字提示，告诉它"骰子已经掷了，这个格子必须执行"
3. **弹窗+浮窗切换**——可最小化的功能模块，不占聊天空间
4. **进度持久化**——简单有效的localStorage方案
5. **棋盘数据驱动**——BOARDS对象定义所有内容，渲染逻辑通用

## 不需要的
- 飞行棋游戏逻辑——我们不做棋盘游戏
- 9版本切换——内容主题不相关

## 与我们的关系
- **弹窗模式可以借鉴**——如果将来要在聊天里嵌入小游戏/互动，弹窗+浮窗的模式很好
- **window函数接口**——任何嵌入式小组件都可以用这个模式：组件不直接调API，宿主负责AI交互
- **injectPrompt模式**——游戏事件→文字prompt→AI回应，这个管道设计在任何互动游戏集成中都有用
