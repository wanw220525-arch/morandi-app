/**
 * gen-mobileconfig.js
 * 在 Windows 上运行：node gen-mobileconfig.js
 * 自动获取本机局域网 IP，生成正确的 .mobileconfig 描述文件
 * 然后用 iPhone Safari 打开：http://<IP>:5175/morandi-lifeplanner.mobileconfig
 */

const os = require("os");
const fs = require("fs");
const path = require("path");

// ── 获取局域网 IPv4 地址 ─────────────────────────────────────────────────────
function getLanIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // 跳过回环地址和 IPv6
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return null;
}

const ip = getLanIP();
if (!ip) {
  console.error("❌ 未能获取到局域网 IP，请检查 Wi-Fi 连接");
  process.exit(1);
}

const PORT = process.env.PORT || 5175;
const APP_URL = `http://${ip}:${PORT}`;

console.log(`\n✅ 检测到局域网 IP：${ip}`);
console.log(`   App 访问地址：${APP_URL}`);
console.log(`   安装引导页：${APP_URL}/install.html\n`);

// ── 生成 mobileconfig ────────────────────────────────────────────────────────
const mobileconfig = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>PayloadContent</key>
    <array>
        <dict>
            <key>PayloadDescription</key>
            <string>静谧生活 AI 生活规划助手 · 添加到主屏幕</string>
            <key>PayloadDisplayName</key>
            <string>静谧生活</string>
            <key>PayloadIdentifier</key>
            <string>com.morandi.lifeplanner.webclip</string>
            <key>PayloadType</key>
            <string>com.apple.webClip.managed</string>
            <key>PayloadUUID</key>
            <string>B2C3D4E5-F6A7-8901-BCDE-F12345678901</string>
            <key>PayloadVersion</key>
            <integer>1</integer>
            <key>FullScreen</key>
            <true/>
            <key>IsRemovable</key>
            <true/>
            <key>Label</key>
            <string>静谧生活</string>
            <key>URL</key>
            <string>${APP_URL}</string>
            <key>Precomposed</key>
            <true/>
        </dict>
    </array>
    <key>PayloadDescription</key>
    <string>静谧生活 AI 生活规划助手 — Morandi 风格，DeepSeek 驱动</string>
    <key>PayloadDisplayName</key>
    <string>静谧生活 App</string>
    <key>PayloadIdentifier</key>
    <string>com.morandi.lifeplanner</string>
    <key>PayloadOrganization</key>
    <string>Morandi Life Planner</string>
    <key>PayloadRemovalDisallowed</key>
    <false/>
    <key>PayloadType</key>
    <string>Configuration</string>
    <key>PayloadUUID</key>
    <string>A1B2C3D4-E5F6-7890-ABCD-EF1234567890</string>
    <key>PayloadVersion</key>
    <integer>1</integer>
</dict>
</plist>`;

const outPath = path.join(__dirname, "morandi-lifeplanner.mobileconfig");
fs.writeFileSync(outPath, mobileconfig, "utf-8");
console.log(`📱 描述文件已生成：morandi-lifeplanner.mobileconfig`);
console.log(`\n─────────────────────────────────────────────`);
console.log(`📋 iPhone 安装步骤：`);
console.log(`  1. 确保手机和电脑在同一 Wi-Fi`);
console.log(`  2. 先启动服务器：DEEPSEEK_API_KEY=你的密钥 node server.js`);
console.log(`  3. 用 iPhone Safari 打开：${APP_URL}/install.html`);
console.log(`  4. 点击页面上的「下载描述文件」按钮`);
console.log(`  5. 去「设置 → 通用 → VPN与设备管理」安装描述文件`);
console.log(`  6. 主屏幕会出现 🌿 静谧生活 图标，点击全屏使用`);
console.log(`─────────────────────────────────────────────\n`);
