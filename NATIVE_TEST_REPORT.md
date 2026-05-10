# 原生 App 测试与优化报告

测试日期：2026-05-10

## 已通过

- `node --check server.js` 通过
- `node --check src/router.js` 通过
- `npm install` 通过
- `npm run build:native` 通过，已生成 `www/` 原生资源
- `npx cap sync` 通过
- `npx cap add android` 通过，可生成 Android 工程
- 本地网页服务启动成功，首页与功能页返回 `200 OK`

## 已优化

- 移除 Capacitor 已废弃的 `bundledWebRuntime` 配置，避免后续版本警告
- 原生资源构建时不再复制 iOS Web Clip 的 `.mobileconfig` 到 `www/`，避免原生包内残留 `127.0.0.1` 安装描述文件
- 新增 `npm run test:native`，一条命令完成语法检查、原生资源构建和 Capacitor 同步
- 保留 AI 代理保护：原生 App 不把 DeepSeek Key 写入前端，需配置 HTTPS 后端代理

## 仍需真机/开发环境完成

- Android APK/AAB 编译需要 Android Studio 和 Gradle 依赖下载
- iOS IPA/TestFlight 编译需要 macOS + Xcode
- 页面里仍有 Google Fonts、Tailwind CDN、头像远程图等外部资源；离线环境下样式/字体/头像可能不完整。正式上架建议全部本地化。

## 推荐命令

```bash
npm install
npm run test:native
npm run native:android
```

或 iOS：

```bash
npm install
npm run test:native
npm run native:ios
```
