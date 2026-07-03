# DECAY

DECAY 是一个完全运行在浏览器中的任务衰退管理器。任务从创建开始倒计时，拖得越久，风险颜色和腐蚀效果越明显；完成、续命和过期会持续影响时间线与报告。

[在线体验](https://chosuicide.github.io/decaying-todo/) · [下载最新版](https://github.com/chosuicide/decaying-todo/releases/latest)

![DECAY 今日任务界面](decay-today-filters.png)

## 功能

- **Today**：日期、完成率、活跃/完成/风险统计和按衰退程度排序的任务队列。
- **Task Detail**：倒计时、腐烂进度、优先级、分类、备注、子任务、完成、续命、归档和时长编辑。
- **Timeline**：7 天 × 6 时段的拖延/到期热力图，以及即将到期的任务。
- **Report**：完成率、累计统计、腐烂率、完成时平均衰退和当前任务衰退分布。
- **Settings**：日夜主题、默认衰退时间、时间旅行调试工具和本地数据清理。
- **精确时长**：保留 1/2/3 天和测试预设，也支持精确到秒的自定义时长。
- **状态动效**：创建进入、续命闪回、完成燃尽粒子、过期灰烬消散。
- **本地优先**：数据只保存在浏览器 `localStorage`，无需账号和后端。

## 衰退算法

```text
decay = clamp((now - createdAt) / decayDuration, 0, 1)
```

- `0% - 30%`：低衰退，绿色。
- `31% - 70%`：中等衰退，琥珀色。
- `71% - 100%`：高风险，红色并出现边缘腐蚀。
- `100%`：记录一次过期事件，播放消散动画并自动归档。

直接修改时长不会增加续命次数；点击续命会重置计时起点并记录一次拖延事件。

## 本地运行

无需安装依赖。在项目目录外启动任意静态服务器即可：

```powershell
rtk python -m http.server 8765 --bind 127.0.0.1 --directory D:\Documents\decaying-todo
```

浏览器打开：

```text
http://127.0.0.1:8765/index.html
```

## 测试

```powershell
node --check app.js
node --test tests/feature-contract.test.mjs
```

## 部署

项目不依赖构建步骤，可直接部署到任意静态托管服务。当前版本通过 GitHub Pages 发布：

```text
https://chosuicide.github.io/decaying-todo/
```

手机可直接打开在线版本，也可以从 [Releases](https://github.com/chosuicide/decaying-todo/releases) 下载完整源码包。

## 许可证

[MIT](LICENSE)

## 数据键

- `decaying_todo_tasks`
- `decaying_todo_events`
- `decaying_todo_logged_decays`
- `decaying_todo_time_offset`
- `decaying_todo_total_stats`
- `decaying_todo_theme`
- `decaying_todo_default_duration`
