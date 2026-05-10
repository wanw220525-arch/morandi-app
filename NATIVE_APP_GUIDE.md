# 静谧生活 · 独立原生 App 打包指南

本版本已从普通网页/PWA 优化为 Capacitor 原生 App 项目，可打包 Android APK/AAB 和 iOS App。

## 已完成的原生化改造

- 新增 `capacitor.config.json`，App ID：`com.morandi.lifeplanner`，App 名称：`静谧生活`。
- 新增 `scripts/build-native.js`，会把前端页面、样式、资源复制到 `www/`，供原生工程打包。
- 新增真实 PNG App 图标：`assets/icons/`。
- 新增启动图：`assets/splash.png`。
- 优化 `index.html` 的安全区、触摸滚动、主屏图标和原生壳识别。
- 优化 `manifest.webmanifest`，去掉 data URI 图标，改用真实图标文件。
- 优化 AI 调用逻辑：原生 App 中不再默认请求本机 Node 服务，而是读取 HTTPS 代理地址。

## 一、安装依赖

```bash
npm install
```

## 二、生成原生静态资源

```bash
npm run build:native
```

生成目录：

```text
www/
```

## 三、生成 Android 工程

```bash
npx cap add android
npx cap sync android
npx cap open android
```

打开 Android Studio 后：

- 调试安装：点击 Run。
- 打包 APK：`Build > Build Bundle(s) / APK(s) > Build APK(s)`。
- 上架包：`Build > Generate Signed Bundle / APK`。

## 四、生成 iOS 工程

需要 macOS + Xcode：

```bash
npx cap add ios
npx cap sync ios
npx cap open ios
```

打开 Xcode 后：

- 选择 Team。
- 修改签名配置。
- 连接 iPhone 调试或 Archive 上架。

## 五、后续修改后同步

每次改 HTML/CSS/JS 后运行：

```bash
npm run native:sync
```

## 六、AI 功能说明

原网页版本通过 `server.js` 里的 `/api/chat` 代理 DeepSeek。原生 App 不能依赖用户手机本地运行 Node 服务，所以推荐部署一个 HTTPS 后端代理，接口保持：

```text
POST https://你的域名/api/chat
```

然后在 App 内设置：

```js
localStorage.setItem("morandi_ai_proxy_url", "https://你的域名")
```

不要把 DeepSeek API Key 写到前端代码里，否则打包后可能被反编译拿到。

## 七、当前限制

- 本包已经具备原生 App 项目配置，但 `android/` 和 `ios/` 工程需要在安装 Capacitor 依赖后用 `npx cap add` 生成。
- iOS 打包必须使用 macOS + Xcode。
- Android 打包需要 Android Studio / JDK。
