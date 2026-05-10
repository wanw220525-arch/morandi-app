// Morandi App 服务器配置 — 自动探测，优先 HTTP 局域网
(function () {
  // 优先用页面自身的 origin（PWA / Safari 直接访问时最准确）
  const fromOrigin = (typeof location !== "undefined" && location.hostname !== "localhost" && location.hostname !== "127.0.0.1")
    ? location.origin
    : null;

  // 备用：写死的局域网地址（HTTP，不要用 HTTPS 否则需要证书）
  const FALLBACK_HOST = "192.168.1.9";
  const FALLBACK_PORT = "5175";

  const primary = fromOrigin || `http://${FALLBACK_HOST}:${FALLBACK_PORT}`;

  window.MORANDI_SERVER_CONFIG = {
    host: FALLBACK_HOST,
    defaultPort: FALLBACK_PORT,
    preferredBaseUrl: primary,
    fallbackBaseUrls: [
      `http://${FALLBACK_HOST}:${FALLBACK_PORT}`,
      `http://${FALLBACK_HOST}`,
      "http://localhost:5175",
      "http://127.0.0.1:5175",
    ],
    healthPath: "/api/health",
    chatPath: "/api/chat",
    discoveryTimeoutMs: 1200,
  };

  window.MORANDI_AI_PROXY_URL = (typeof localStorage !== "undefined" && localStorage.getItem("morandi_ai_proxy_url"))
    || primary;
})();
