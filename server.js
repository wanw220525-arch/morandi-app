const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const os = require("os");

const PORT = Number(process.env.PORT || 5175);
const HTTPS_PORT = Number(process.env.HTTPS_PORT || 443);
const ENABLE_HTTPS = process.env.MORANDI_HTTPS === "1" || process.env.MORANDI_HTTPS === "true";
const SSL_KEY = process.env.SSL_KEY || path.join(__dirname, "certs", "192.168.1.9-key.pem");
const SSL_CERT = process.env.SSL_CERT || path.join(__dirname, "certs", "192.168.1.9-cert.pem");
const HOST = process.env.HOST || "0.0.0.0";
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";
const ROOT = __dirname;

// ── 获取局域网 IP ─────────────────────────────────────────────────────────────
function getLanIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
    }
  }
  return "127.0.0.1";
}

const LAN_IP = getLanIP();

// ── 动态生成 mobileconfig（URL 使用真实局域网 IP）──────────────────────────────
function buildMobileconfig(ip, port) {
  const appUrl = `http://${ip}:${port}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
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
            <string>${appUrl}</string>
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
}

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".ico": "image/x-icon",
  ".mobileconfig": "application/x-apple-aspen-config",
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

function proxyDeepSeekStream(messages, res) {
  if (!DEEPSEEK_API_KEY) {
    res.writeHead(503, { "Content-Type": "application/json; charset=utf-8", ...corsHeaders() });
    res.end(JSON.stringify({ error: "服务器未配置 DEEPSEEK_API_KEY 环境变量，请联系管理员。" }));
    return;
  }

  const payload = JSON.stringify({
    model: "deepseek-chat",
    stream: true,
    max_tokens: 1024,
    temperature: 0.8,
    messages: [
      {
        role: "system",
        content: "你是晚晚，一个温柔、贴心的中文AI生活规划助手。用户使用名为「静谧生活」的iOS App来管理日程、清单和收支。你的风格：简洁优雅、有温度、不废话。回复语言：中文。回复长度：适中，不超过200字。可以主动提供日程/清单/收支建议，但不要重复用户的话。",
      },
      ...messages,
    ],
  });

  const options = {
    hostname: "api.deepseek.com",
    path: "/v1/chat/completions",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
      "Content-Length": Buffer.byteLength(payload),
    },
  };

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    ...corsHeaders(),
  });

  const upstream = https.request(options, (upRes) => {
    upRes.on("data", (chunk) => { res.write(chunk); });
    upRes.on("end", () => { res.write("data: [DONE]\n\n"); res.end(); });
  });

  upstream.on("error", (err) => {
    console.error("[DeepSeek proxy error]", err.message);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  });

  upstream.write(payload);
  upstream.end();
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  const urlPath = decodeURIComponent(req.url.split("?")[0]);

  // ── DeepSeek 流式代理 ────────────────────────────────────────────────────────
  if (urlPath === "/api/chat" && req.method === "POST") {
    try {
      const body = await readBody(req);
      const { messages } = JSON.parse(body);
      if (!Array.isArray(messages) || messages.length === 0) {
        res.writeHead(400, { "Content-Type": "application/json; charset=utf-8", ...corsHeaders() });
        res.end(JSON.stringify({ error: "messages 字段缺失或为空" }));
        return;
      }
      proxyDeepSeekStream(messages, res);
    } catch (err) {
      res.writeHead(400, { "Content-Type": "application/json; charset=utf-8", ...corsHeaders() });
      res.end(JSON.stringify({ error: "请求体解析失败：" + err.message }));
    }
    return;
  }

  // ── 健康检查 ─────────────────────────────────────────────────────────────────
  if (urlPath === "/api/health" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", ...corsHeaders() });
    res.end(JSON.stringify({ ok: true, app: "morandi-life-planner", apiKeySet: !!DEEPSEEK_API_KEY, lanIp: LAN_IP, httpPort: PORT, https: ENABLE_HTTPS, version: "2.3.0" }));
    return;
  }

  // ── 动态 mobileconfig（URL 自动使用当前局域网 IP）───────────────────────────
  if (urlPath === "/morandi-lifeplanner.mobileconfig") {
    const clientIp = req.socket.remoteAddress || LAN_IP;
    // 优先用服务器自己检测到的局域网 IP，确保 iPhone 能访问
    const content = buildMobileconfig(LAN_IP, PORT);
    res.writeHead(200, {
      "Content-Type": "application/x-apple-aspen-config",
      "Content-Disposition": 'attachment; filename="morandi-lifeplanner.mobileconfig"',
      ...corsHeaders(),
    });
    res.end(content);
    console.log(`[mobileconfig] 已下发，IP=${LAN_IP}:${PORT}，客户端=${clientIp}`);
    return;
  }

  // ── 静态文件 ─────────────────────────────────────────────────────────────────
  const requestedPath = urlPath === "/" ? "/index.html" : urlPath;
  const filePath = path.normalize(path.join(ROOT, requestedPath));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, corsHeaders());
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404, corsHeaders());
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "text/plain; charset=utf-8",
      ...corsHeaders(),
    });
    res.end(content);
  });
});

server.listen(PORT, HOST, () => {
  const appUrl = `http://${LAN_IP}:${PORT}`;
  console.log(`\n🌿 静谧生活 · Morandi Life Planner v2.3`);
  console.log(`   HTTP 本地地址： http://127.0.0.1:${PORT}`);
  console.log(`   HTTP 手机访问： ${appUrl}`);
  console.log(`   健康检查：     ${appUrl}/api/health`);
  console.log(`   📋 安装引导：   ${appUrl}/install.html`);
  console.log(`   DeepSeek Key：  ${DEEPSEEK_API_KEY ? "✅ 已配置" : "❌ 未配置（设置 DEEPSEEK_API_KEY 环境变量）"}`);
});

if (ENABLE_HTTPS) {
  if (!fs.existsSync(SSL_KEY) || !fs.existsSync(SSL_CERT)) {
    console.warn(`⚠️  已请求 HTTPS，但证书不存在：\n   key:  ${SSL_KEY}\n   cert: ${SSL_CERT}\n   请先生成/放入局域网证书，或使用反向代理提供 HTTPS。`);
  } else {
    https.createServer({ key: fs.readFileSync(SSL_KEY), cert: fs.readFileSync(SSL_CERT) }, server.listeners("request")[0])
      .listen(HTTPS_PORT, HOST, () => {
        console.log(`   HTTPS 手机访问：https://${LAN_IP}${HTTPS_PORT === 443 ? "" : ":" + HTTPS_PORT}`);
        console.log(`   HTTPS 健康检查：https://${LAN_IP}${HTTPS_PORT === 443 ? "" : ":" + HTTPS_PORT}/api/health\n`);
      });
  }
}
