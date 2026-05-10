# iOS 测试 / 发布 / 服务器配置说明

## 已内置服务器地址

App 已默认使用以下服务器地址：

- 首选 HTTPS：`https://192.168.1.9`
- HTTPS 端口备选：`https://192.168.1.9:5175`
- 局域网调试 HTTP 备选：`http://192.168.1.9:5175`
- HTTP 备选：`http://192.168.1.9`

AI 请求会自动访问 `/api/health` 探测可用服务器，再调用 `/api/chat`。

## 启动服务器

普通 HTTP 调试：

```bash
npm install
DEEPSEEK_API_KEY=你的Key npm start
```

HTTPS 调试：

```bash
MORANDI_HTTPS=1 HTTPS_PORT=443 DEEPSEEK_API_KEY=你的Key npm run start:https
```

如使用自签名证书，请把证书放到：

```txt
certs/192.168.1.9-key.pem
certs/192.168.1.9-cert.pem
```

注意：iPhone 真机访问自签名 HTTPS，需要在 iPhone 上信任证书；正式发布建议使用可信 CA 证书或把服务部署到正式域名。

## 内网自动发现

App 启动 AI 请求时会按顺序探测：

1. 用户之前保存的 `morandi_ai_proxy_url`
2. `https://192.168.1.9`
3. `https://192.168.1.9:5175`
4. `http://192.168.1.9:5175`
5. `http://192.168.1.9`

探测成功后，会自动保存到本机 `localStorage.morandi_ai_proxy_url`。

## iOS 模拟器测试版

模拟器不需要 Apple 设备签名：

```bash
npm install
npm run ios:open
```

然后在 Xcode 选择 iPhone Simulator，点击 Run。

## iPhone 真机测试版

真机测试仍需要 Apple 的开发签名；可以用免费 Apple ID 自动签名：

1. 用 Xcode 打开 `ios/App/App.xcworkspace`
2. 选择 `App` Target → `Signing & Capabilities`
3. 勾选 `Automatically manage signing`
4. 选择你的 Apple Team
5. 连接 iPhone，点击 Run

## 可发布版本

可发布到 TestFlight / App Store 的 IPA 必须使用 Apple Developer Program 的发布签名证书和 Provisioning Profile。当前包已包含 iOS 工程，但最终 archive/export 需要在 macOS + Xcode 中完成。

