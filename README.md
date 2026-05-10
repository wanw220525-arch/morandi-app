# 静谧生活 AI 规划器

这是从当前 `morandi-life-planner-app-sunflower-neumorphic` 复制出的 Pistachio Rose / Neumo 风格副本。上一版原始文件保持不动，本副本只在运行层追加样式与交互增强。

## 运行方式

```bash
npm start
```

启动后打开：

```text
http://127.0.0.1:5175
```

## 已实现

- `index.html` 使用全屏 iframe 承载原始 UI 页面，避免改变页面内部排版和风格。
- `src/router.js` 为原页面中的底部导航、返回按钮和常见操作按钮补充跳转行为。
- `src/router.js`、`src/frame.css`、`server.js` 已补充中文注释，说明路由、状态、弹窗、记账、清单、日程和预览服务的执行步骤。
- 整体视觉改为 Pistachio Rose 色系的 Neumo 风格，主底色为 `#F4F2E5`，主要通过 `src/router.js` 动态注入，不直接改动 `pages/` 中的原始设计文件。
- `pages/` 中的 HTML 已固化写入 Neumo 主题样式和主题类名；直接访问 `pages/*.html` 时也会呈现 Neumo 版，不再保留裸原始 HTML 状态。
- 收支统计页改为连接记账数据的可视化仪表盘，包含收入、支出、结余、占比圆环、支出条形图和录入明细。
- 底部导航中的“账单”统一进入记账支出/收入录入页。
- 记账页中的“收入”分段按钮进入收入录入页，“支出”分段按钮返回支出录入页。
- 记账页数字键盘会同步显示用户输入金额；点击完成后会把收入/支出分别写入本页明细模块。
- 记账页录入的收入/支出会同步到收支视图页的录入明细与汇总模块。
- 记账页右上角 `...` 进入收支视图页。
- 日程页左上角菜单图标在运行时替换为返回箭头。
- 日程页右下角 `+` 会打开毛玻璃“新建任务”弹窗，可输入日期、时间、类型与备注，保存后同步显示在日程表和时间轴。
- 日程页时间轴增加悬停移动、时间点呼吸和点击反馈微动效。
- 日程页时间轴行程带删除按钮，新增行程和原始行程都可删除。
- 清单页已有任务可通过左侧小方框切换完成状态。
- 清单页任务支持向左滑动露出删除按钮。
- 清单页顶部分类改为选项卡，并增加“新建清单”按钮；新建清单会显示在选项卡和折叠列表中。
- 清单页任务列表改为可折叠列表，点击不同清单标题可展开或收起任务内容。
- 清单页右下角 `+` 会打开毛玻璃“新建任务”弹窗，可选择任务保存到哪个清单列表。
- AI 助手页底部提示按钮已替换为可输入并发送的用户输入框。
- `server.js` 提供本地静态服务。
- 代码中已在路由、事件委托、静态服务等运行层逻辑处添加注释。

## Python 能做什么

Python 可以用于软件编程，常见方向包括桌面软件、网站后端、自动化脚本、数据分析、AI 应用、爬虫和命令行工具。这个项目当前是浏览器 app，所以主要用 HTML/CSS/JavaScript；如果后续要加后端接口、数据存储、AI 服务或自动化处理，可以引入 Python。

## 页面映射

- 首页：`pages/home.html`
- 账单：`pages/finance.html`
- 记账：`pages/expense.html`
- 日程：`pages/calendar.html`
- 清单：`pages/tasks.html`
- AI 助手：`pages/ai.html`
- 个人中心：`pages/profile.html`
- 编辑日程：`pages/edit-schedule.html`

## 原生 App 打包

本版本已加入 Capacitor 原生 App 配置。详细步骤见：`NATIVE_APP_GUIDE.md`。

常用命令：

```bash
npm install
npm run build:native
npx cap add android
npx cap sync android
npx cap open android
```

iOS 需要 macOS + Xcode：

```bash
npx cap add ios
npx cap sync ios
npx cap open ios
```
