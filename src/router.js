const frame = document.querySelector("#app-frame");

// localStorage 的键名：所有运行时新增的数据都统一存到这里。
const DATA_KEY = "morandi-life-planner-runtime";

// 页面路由表：hash 中的路由名会被映射到 pages/ 下的原始 UI 页面。
const routes = {
  home: "./pages/home.html",
  finance: "./pages/finance.html",
  expense: "./pages/expense.html",
  "expense-alt": "./pages/expense-alt.html",
  calendar: "./pages/calendar.html",
  tasks: "./pages/tasks.html",
  "tasks-alt": "./pages/tasks-alt.html",
  ai: "./pages/ai.html",
  login: "./pages/login.html",
  profile: "./pages/profile.html",
  "edit-schedule": "./pages/edit-schedule.html"
};

// 底部导航图标和页面路由的对应关系。
// 这样不用改原始 HTML，只要识别图标名称就能完成跳转。
const bottomNavIconRoutes = {
  home: "home",
  home_app_logo: "home",
  account_balance_wallet: "expense",
  calendar_today: "calendar",
  format_list_bulleted: "tasks",
  smart_toy: "ai",
  person: "profile"
};

// 运行时状态：加载用户录入的账单、日程、清单、AI 消息等数据。
let runtime = loadRuntime();

// 从浏览器本地存储读取 app 运行数据。
// 如果用户第一次打开页面或数据损坏，就返回一套默认数据结构。
function loadRuntime() {
  try {
    const saved = JSON.parse(localStorage.getItem(DATA_KEY)) || {};
    return {
      // 用户新增的日程行程。
      calendarItems: saved.calendarItems || [],
      // 用户新增的清单任务。
      taskItems: saved.taskItems || [],
      // 清单分类列表。
      taskLists: saved.taskLists || ["工作任务", "个人生活", "购物清单"],
      // 当前选中的清单选项卡，默认展示全部清单。
      activeTaskList: saved.activeTaskList || "全部清单",
      // 每个清单折叠/展开的状态；true 表示展开。
      expandedTaskLists: saved.expandedTaskLists || {},
      // 原始静态任务的完成状态。
      staticTaskDone: saved.staticTaskDone || {},
      // 原始静态任务的删除状态。
      staticTaskDeleted: saved.staticTaskDeleted || {},
      // 原始静态日程的删除状态。
      staticCalendarDeleted: saved.staticCalendarDeleted || {},
      // AI 助手页用户发送过的消息。
      aiMessages: saved.aiMessages || [],
      // 记账页保存的收入/支出明细。
      accountingItems: saved.accountingItems || [],
      // 账本数据库列表：记账页的账本按钮映射到这些本地数据集合。
      accountBooks: saved.accountBooks || ["个人账本", "家庭账本", "工作账本"],
      // 当前选中的账本数据库名称。
      activeAccountBook: saved.activeAccountBook || "个人账本",
      // 账本管理模式：开启后账本按钮右上角显示删除按钮。
      accountBookManage: saved.accountBookManage || false,
      // 记账页当前未保存的输入草稿。
      accountingDrafts: saved.accountingDrafts || {
        expense: { amount: "", note: "" },
        income: { amount: "", note: "" }
      },
      // 服务器地址：默认 192.168.1.9，启动时会自动探测 HTTPS/局域网可用地址。
      aiProxyUrl: saved.aiProxyUrl || localStorage.getItem("morandi_ai_proxy_url") || getDefaultServerBaseUrl()
    };
  } catch {
    return {
      calendarItems: [],
      taskItems: [],
      taskLists: ["工作任务", "个人生活", "购物清单"],
      activeTaskList: "全部清单",
      expandedTaskLists: {},
      staticTaskDone: {},
      staticTaskDeleted: {},
      staticCalendarDeleted: {},
      aiMessages: [],
      accountingItems: [],
      accountBooks: ["个人账本", "家庭账本", "工作账本"],
      activeAccountBook: "个人账本",
      accountBookManage: false,
      accountingDrafts: {
        expense: { amount: "", note: "" },
        income: { amount: "", note: "" }
      },
      aiProxyUrl: localStorage.getItem("morandi_ai_proxy_url") || getDefaultServerBaseUrl()
    };
  }
}


function getServerConfig() {
  return window.MORANDI_SERVER_CONFIG || {
    preferredBaseUrl: "http://192.168.1.9",
    fallbackBaseUrls: ["http://192.168.1.9:5175", "http://192.168.1.9:5175", "http://192.168.1.9"],
    healthPath: "/api/health",
    chatPath: "/api/chat",
    discoveryTimeoutMs: 1200
  };
}

function getDefaultServerBaseUrl() {
  return getServerConfig().preferredBaseUrl || "http://192.168.1.9";
}

function normalizeBaseUrl(url) {
  return String(url || "").trim().replace(/\/$/, "");
}

async function pingServer(baseUrl) {
  const cfg = getServerConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.discoveryTimeoutMs || 1200);
  try {
    const resp = await fetch(`${normalizeBaseUrl(baseUrl)}${cfg.healthPath || "/api/health"}`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal
    });
    return resp.ok;
  } catch (_) {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function discoverServerBaseUrl() {
  const cfg = getServerConfig();
  const saved = localStorage.getItem("morandi_ai_proxy_url");
  const candidates = [
    saved,
    window.MORANDI_AI_PROXY_URL,
    runtime?.aiProxyUrl,
    cfg.preferredBaseUrl,
    ...(cfg.fallbackBaseUrls || [])
  ].map(normalizeBaseUrl).filter(Boolean);
  const unique = [...new Set(candidates)];

  for (const candidate of unique) {
    if (await pingServer(candidate)) {
      localStorage.setItem("morandi_ai_proxy_url", candidate);
      window.MORANDI_AI_PROXY_URL = candidate;
      if (runtime) {
        runtime.aiProxyUrl = candidate;
        saveRuntime();
      }
      return candidate;
    }
  }

  const fallback = normalizeBaseUrl(saved || window.MORANDI_AI_PROXY_URL || cfg.preferredBaseUrl || "http://192.168.1.9");
  localStorage.setItem("morandi_ai_proxy_url", fallback);
  window.MORANDI_AI_PROXY_URL = fallback;
  if (runtime) {
    runtime.aiProxyUrl = fallback;
    saveRuntime();
  }
  return fallback;
}

// 把当前运行时状态写回 localStorage，刷新页面后仍能保留数据。
function saveRuntime() {
  localStorage.setItem(DATA_KEY, JSON.stringify(runtime));
}

// 清单任务的状态统一从 done 字段推导，避免页面显示和数据库保存的状态不一致。
function getTaskStatus(item) {
  if (item.done) return "已完成";
  return item.status || "活动";
}

// 切换用户新增任务的完成状态，并把状态文本同步写回 taskItems 数据库。
function toggleRuntimeTaskDone(id) {
  runtime.taskItems = runtime.taskItems.map((item) => {
    if (String(item.id) !== String(id)) return item;

    const done = !item.done;
    return {
      ...item,
      done,
      status: done ? "已完成" : "活动"
    };
  });
  saveRuntime();
}

// 切换原始 UI 自带任务的完成状态，并保存到 staticTaskDone 数据库。
function toggleStaticTaskDone(index) {
  runtime.staticTaskDone[index] = !runtime.staticTaskDone[index];
  saveRuntime();
}

// 跳转到指定页面。
// replace=true 时替换当前历史记录，避免 hashchange 时反复堆叠历史。
function routeTo(route, replace = false) {
  // 如果传入未知路由，就回到首页，避免 iframe 加载失败。
  const nextRoute = routes[route] ? route : "home";
  const nextHash = `#${nextRoute}`;
  const isFigmaCapture = location.hash.includes("figmacapture=");

  // 同步浏览器地址栏 hash，方便用户刷新后仍停留在当前页面。
  // Figma 捕获时 hash 里保存 captureId，不能被 app 路由覆盖。
  if (!isFigmaCapture && location.hash !== nextHash) {
    if (replace) history.replaceState(null, "", nextHash);
    else history.pushState(null, "", nextHash);
  }

  // 如果已经在目标路由，不重复设置 iframe.src，避免 hashchange 造成二次加载闪烁。
  if (frame.dataset.currentRoute === nextRoute) return;

  // 加载新页面前先隐藏 iframe，防止原始页面在主题注入前闪现。
  frame.classList.add("is-loading");
  frame.dataset.currentRoute = nextRoute;

  // iframe 加载对应的原始 UI 页面。
  frame.src = routes[nextRoute];
}

// 从地址栏 hash 里读取当前路由；没有 hash 时默认首页。
function getRouteFromHash() {
  // Figma 捕获本地页面时会把 captureId 写进 hash；captureRoute 用来保留当前 app 路由。
  const captureRoute = new URLSearchParams(location.search).get("captureRoute");
  if (captureRoute && routes[captureRoute]) return captureRoute;

  // 普通访问仍然读取 hash 的第一段，兼容 #tasks&figmacapture=... 这种捕获 URL。
  return location.hash.replace("#", "").split("&")[0] || "home";
}

// 每次 iframe 页面加载完，给这个页面挂载运行时交互。
// 原始 UI 页面不直接改结构，所有交互都在这里动态增强。
function wireFrameNavigation() {
  const doc = frame.contentDocument;
  if (!doc) return;

  // 第一步：注入运行时 CSS，让动态弹窗/按钮和原 UI 风格保持一致。
  injectRuntimeStyles(doc);
  injectHomeReferenceStyles(doc);

  // 第二步：根据当前页面类型挂载对应功能。
  prepareRoute(doc, getRouteFromHash());

  // 第三步：等待浏览器应用完注入样式和动态结构后，再显示 iframe。
  // 连续两帧可以减少“先画原始 UI、再变主题”的闪烁概率。
  requestAnimationFrame(() => {
    requestAnimationFrame(() => frame.classList.remove("is-loading"));
  });

  // 第四步：使用事件委托捕获页面中的按钮/导航点击。
  doc.addEventListener("click", (event) => {
    const clicked = event.target.closest("a, button, nav div, [data-mlp-route]");
    if (!clicked) return;

    // 根据被点击元素推断要执行的路由或动作。
    const route = inferRouteFromClick(clicked);
    if (!route) return;

    // 阻止原始静态页面中的 # 链接跳动。
    event.preventDefault();
    event.stopPropagation();

    // 日程页右下角加号：打开新建日程弹窗。
    if (route === "calendar-modal") {
      openEntryModal(doc, "calendar");
      return;
    }

    // 清单页右下角加号：打开“新建任务”弹窗。
    if (route === "task-modal") {
      openEntryModal(doc, "tasks");
      return;
    }

    // 清单页顶部“新建清单”按钮：打开只录入清单名称的弹窗。
    if (route === "list-modal") {
      openEntryModal(doc, "list");
      return;
    }

    // 普通导航：进入对应页面。
    routeTo(route);
  });
}

// 根据当前页面类型执行不同增强逻辑。
function prepareRoute(doc, route) {
  // 所有页面都先统一底部导航行为。
  normalizeBottomNav(doc);
  // 给当前 iframe 页面套上 Pistachio Rose Neumo 主题，副本内统一视觉语言。
  applySunflowerAppShell(doc, route);

  // 首页状态模块：增强成可点击入口。
  if (route === "home") {
    wireHomeQuickLinks(doc);
    enhanceHomeComponentStyle(doc);
  }

  // 记账支出页 / 收入页：增强分段按钮、数字键盘、明细模块。
  if (route === "expense" || route === "expense-alt") {
    const mode = route === "expense-alt" ? "income" : "expense";
    wireAccountingTabs(doc, route);
    renderAccountingDraftBox(doc, mode);
    wireAccountingInput(doc, mode);
    wireAccountBookDatabaseControls(doc);
    renderAccountingDetails(doc, mode);
    enhanceAccountingColorSystem(doc);
  }

  // 收支视图页：展示记账页录入的数据汇总。
  if (route === "finance") {
    renderFinanceRuntimeView(doc);
  }

  // 日程页：改返回按钮、渲染新增日程、挂载删除按钮。
  if (route === "calendar") {
    convertCalendarMenuToBack(doc);
    enhanceCalendarGridCard(doc);
    simplifyCalendarPage(doc);
    renderCalendarCreateModule(doc);
    renderCalendarItems(doc);
    wireCalendarDeleteButtons(doc);
    enhanceCalendarTimelineMotion(doc);
  }

  // 清单页：渲染列表、勾选完成、动态任务、左滑删除。
  if (route === "tasks") {
    renderTaskLists(doc);
    wireStaticTaskToggles(doc);
    renderTaskItems(doc);
    renderTaskHighlights(doc);
    wireTaskSwipeDelete(doc);
  }

  // AI 页：把原提示按钮替换成真正的用户输入框。
  if (route === "ai") {
    injectAiInput(doc);
  }
}

// 统一底部导航栏的可点击行为。
// 有些原始页面底部导航是 a，有些是 div/button，这里统一加 data-mlp-route。
function normalizeBottomNav(doc) {
  doc.querySelectorAll("nav [class*='flex-col']").forEach((item) => {
    // 读取导航项里的 Material Symbols 图标名称。
    const icon = getIconName(item);

    // 根据图标找到对应路由；没有匹配时不处理。
    const route = bottomNavIconRoutes[icon];
    if (!route) return;

    // 写入统一路由标记，并补上基本可访问性属性。
    item.dataset.mlpRoute = route;
    item.style.cursor = "pointer";
    item.setAttribute("role", "button");
    item.setAttribute("tabindex", "0");
  });
}

// 给 iframe 内页面添加统一主题类名和当前路由标记，方便 CSS 做整站新拟态换肤。
function applySunflowerAppShell(doc, route) {
  doc.body.classList.add("mlp-sunflower-theme");
  doc.body.dataset.mlpRoute = route;
}

function injectHomeReferenceStyles(doc) {
  doc.querySelector("#mlp-home-reference-style")?.remove();

  const style = doc.createElement("style");
  style.id = "mlp-home-reference-style";
  style.textContent = `
    body[data-mlp-route="home"].mlp-sunflower-theme {
      background:
        radial-gradient(circle at 20% 7%, rgba(221, 228, 184, 0.52), transparent 30%),
        radial-gradient(circle at 86% 14%, rgba(232, 214, 211, 0.42), transparent 28%),
        linear-gradient(180deg, #F5F1DF 0%, #EEEAD8 56%, #F4F2E5 100%) !important;
    }

    body[data-mlp-route="home"] .mlp-home-screen {
      width: 100% !important;
      max-width: var(--mlp-ios-width) !important;
      margin: 0 auto !important;
      padding: calc(var(--mlp-ios-safe-top) + 66px) 14px var(--mlp-ios-page-bottom) !important;
      display: flex !important;
      flex-direction: column !important;
      gap: 20px !important;
    }

    body[data-mlp-route="home"] .mlp-home-stat-grid {
      display: grid !important;
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 12px !important;
      align-items: stretch !important;
    }

    body[data-mlp-route="home"] .mlp-home-progress-card,
    body[data-mlp-route="home"] .mlp-home-budget-card,
    body[data-mlp-route="home"] .mlp-home-suggestion-card,
    body[data-mlp-route="home"] .mlp-home-schedule-card {
      border: 1px solid rgba(255, 255, 247, 0.58) !important;
      background: rgba(244, 242, 229, 0.78) !important;
      box-shadow:
        8px 8px 18px rgba(101, 89, 76, 0.12),
        -7px -7px 16px rgba(255, 255, 247, 0.52),
        inset 1px 1px 0 rgba(255, 255, 247, 0.5) !important;
      backdrop-filter: blur(12px) saturate(1.05);
    }

    body[data-mlp-route="home"] .mlp-home-progress-card,
    body[data-mlp-route="home"] .mlp-home-budget-card {
      min-height: 118px !important;
      border-radius: 22px !important;
      padding: 14px !important;
      overflow: hidden !important;
    }

    body[data-mlp-route="home"] .mlp-home-progress-card {
      display: grid !important;
      grid-template-rows: auto 1fr auto !important;
      justify-items: center !important;
      gap: 6px !important;
      text-align: center !important;
    }

    body[data-mlp-route="home"] .mlp-home-progress-card .relative {
      width: 56px !important;
      height: 56px !important;
      border-radius: 999px !important;
      background: rgba(244, 242, 229, 0.86) !important;
      box-shadow:
        inset 5px 5px 11px rgba(101, 89, 76, 0.1),
        inset -5px -5px 12px rgba(255, 255, 247, 0.72) !important;
    }

    body[data-mlp-route="home"] .mlp-home-progress-card svg {
      width: 56px !important;
      height: 56px !important;
    }

    body[data-mlp-route="home"] .mlp-home-progress-card svg circle:first-child {
      color: rgba(232, 214, 211, 0.52) !important;
    }

    body[data-mlp-route="home"] .mlp-home-progress-card svg circle:last-child {
      color: #8FA06D !important;
    }

    body[data-mlp-route="home"] .mlp-home-progress-card .relative span {
      color: #8A9368 !important;
      font-size: 13px !important;
      font-weight: 900 !important;
    }

    body[data-mlp-route="home"] .mlp-home-progress-card p:first-child,
    body[data-mlp-route="home"] .mlp-home-budget-card p:first-child {
      color: #6B5843 !important;
      font-size: 13px !important;
      line-height: 1.2 !important;
      font-weight: 900 !important;
      text-transform: none !important;
    }

    body[data-mlp-route="home"] .mlp-home-progress-card p:last-child,
    body[data-mlp-route="home"] .mlp-home-budget-card p:last-child,
    body[data-mlp-route="home"] .mlp-home-budget-card span {
      color: rgba(107, 88, 67, 0.62) !important;
      font-size: 10px !important;
      line-height: 1.25 !important;
      font-weight: 800 !important;
    }

    body[data-mlp-route="home"] .mlp-home-link-hint {
      align-self: center !important;
      margin-top: 2px !important;
      padding: 6px 18px !important;
      border-radius: 999px !important;
      color: #8B6B55 !important;
      background: rgba(220, 193, 183, 0.42) !important;
      box-shadow: inset 2px 2px 5px rgba(101, 89, 76, 0.08), inset -2px -2px 6px rgba(255, 255, 247, 0.58) !important;
      font-size: 10px !important;
      font-weight: 900 !important;
    }

    body[data-mlp-route="home"] .mlp-home-link-hint .material-symbols-outlined {
      display: none !important;
    }

    body[data-mlp-route="home"] .mlp-home-budget-card {
      display: flex !important;
      flex-direction: column !important;
      justify-content: space-between !important;
      gap: 8px !important;
    }

    body[data-mlp-route="home"] .mlp-home-budget-card > div:first-child {
      align-items: flex-start !important;
    }

    body[data-mlp-route="home"] .mlp-home-budget-card .text-lg {
      margin-top: 4px !important;
      color: #6B5843 !important;
      font-size: 24px !important;
      line-height: 1 !important;
      font-weight: 900 !important;
    }

    body[data-mlp-route="home"] .mlp-home-budget-card .w-full.h-1 {
      height: 7px !important;
      border-radius: 999px !important;
      background: rgba(107, 88, 67, 0.14) !important;
      box-shadow: inset 2px 2px 4px rgba(101, 89, 76, 0.08) !important;
    }

    body[data-mlp-route="home"] .mlp-home-budget-card .w-full.h-1 > div {
      background: #CBD49B !important;
    }

    body[data-mlp-route="home"] .mlp-home-screen section:nth-of-type(2) > div:first-child,
    body[data-mlp-route="home"] .mlp-home-screen section:nth-of-type(3) > div:first-child {
      margin-bottom: 10px !important;
      padding: 0 !important;
    }

    body[data-mlp-route="home"] .mlp-home-screen section:nth-of-type(2) h3,
    body[data-mlp-route="home"] .mlp-home-screen section:nth-of-type(3) h3 {
      color: #6B5843 !important;
      font-size: 16px !important;
      font-weight: 900 !important;
    }

    body[data-mlp-route="home"] .mlp-home-screen section:nth-of-type(2) button,
    body[data-mlp-route="home"] .mlp-home-screen section:nth-of-type(3) span {
      color: rgba(107, 88, 67, 0.62) !important;
      font-size: 10px !important;
      font-weight: 800 !important;
      background: transparent !important;
      box-shadow: none !important;
      border: 0 !important;
    }

    body[data-mlp-route="home"] .mlp-home-screen section:nth-of-type(2) .overflow-x-auto {
      display: grid !important;
      grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
      gap: 8px !important;
      overflow: visible !important;
      margin: 0 !important;
      padding: 0 !important;
      scroll-snap-type: none !important;
    }

    body[data-mlp-route="home"] .mlp-home-suggestion-card {
      width: auto !important;
      min-height: 106px !important;
      padding: 12px 10px 13px !important;
      border-radius: 17px !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: flex-start !important;
      gap: 7px !important;
      snap-align: unset !important;
    }

    body[data-mlp-route="home"] .mlp-home-suggestion-card:nth-child(1) {
      background: rgba(239, 224, 210, 0.78) !important;
    }

    body[data-mlp-route="home"] .mlp-home-suggestion-card:nth-child(2) {
      background: rgba(239, 235, 216, 0.8) !important;
    }

    body[data-mlp-route="home"] .mlp-home-suggestion-card:nth-child(3) {
      background: rgba(232, 214, 211, 0.9) !important;
    }

    body[data-mlp-route="home"] .mlp-home-suggestion-card > div:first-child {
      width: 28px !important;
      height: 28px !important;
      display: grid !important;
      place-items: center !important;
      border-radius: 12px !important;
      margin-bottom: 1px !important;
      background: rgba(255, 255, 247, 0.42) !important;
      box-shadow:
        inset 1px 1px 0 rgba(255, 255, 247, 0.72),
        3px 4px 8px rgba(101, 89, 76, 0.08) !important;
    }

    body[data-mlp-route="home"] .mlp-home-suggestion-card > div:first-child .material-symbols-outlined {
      color: #6B5843 !important;
      font-size: 18px !important;
    }

    body[data-mlp-route="home"] .mlp-home-suggestion-card h4 {
      color: #6B5843 !important;
      font-size: 13px !important;
      line-height: 1.2 !important;
      margin: 0 !important;
      font-weight: 900 !important;
    }

    body[data-mlp-route="home"] .mlp-home-suggestion-card p {
      color: rgba(107, 88, 67, 0.72) !important;
      font-size: 11px !important;
      line-height: 1.35 !important;
      font-weight: 760 !important;
    }

    body[data-mlp-route="home"] .mlp-home-schedule-section > .relative {
      padding-left: 0 !important;
      max-height: 238px !important;
      overflow-y: auto !important;
      overflow-x: hidden !important;
      padding-right: 4px !important;
      scroll-snap-type: y proximity !important;
      scrollbar-width: none !important;
      mask-image: linear-gradient(to bottom, transparent 0, black 12px, black calc(100% - 18px), transparent 100%);
    }

    body[data-mlp-route="home"] .mlp-home-schedule-section > .relative > .absolute {
      display: none !important;
    }

    body[data-mlp-route="home"] .mlp-home-schedule-section > .relative::-webkit-scrollbar {
      display: none !important;
    }

    body[data-mlp-route="home"] .mlp-home-schedule-section .relative.flex {
      gap: 11px !important;
      padding: 5px 0 12px !important;
      align-items: stretch !important;
      scroll-snap-align: start !important;
      transition: transform 180ms ease, filter 180ms ease !important;
      animation: mlpHomeScheduleFloat 4.8s ease-in-out infinite;
    }

    body[data-mlp-route="home"] .mlp-home-schedule-section .relative.flex:nth-of-type(2n) {
      animation-delay: -1.4s;
    }

    body[data-mlp-route="home"] .mlp-home-schedule-section .relative.flex:hover,
    body[data-mlp-route="home"] .mlp-home-schedule-section .relative.flex:focus-within {
      transform: translateY(-2px);
      filter: saturate(1.04);
    }

    body[data-mlp-route="home"] .mlp-home-schedule-section .relative.flex:active {
      transform: translateY(1px) scale(0.99);
    }

    body[data-mlp-route="home"] .mlp-home-day-wheel {
      flex: 1 1 auto !important;
      min-width: 0 !important;
      height: 104px !important;
      max-height: 104px !important;
      display: flex !important;
      flex-direction: column !important;
      gap: 0 !important;
      overflow-y: auto !important;
      overflow-x: hidden !important;
      padding: 2px 8px 12px 0 !important;
      scroll-snap-type: y mandatory !important;
      scrollbar-width: none !important;
      perspective: 760px !important;
      transform-style: preserve-3d !important;
      mask-image: linear-gradient(to bottom, black 0, black calc(100% - 14px), transparent 100%);
    }

    body[data-mlp-route="home"] .mlp-home-day-wheel::-webkit-scrollbar {
      display: none !important;
    }

    body[data-mlp-route="home"] .mlp-home-day-wheel .mlp-home-schedule-card {
      flex: 0 0 auto !important;
      width: 100% !important;
      scroll-snap-align: start !important;
      transform-origin: center top !important;
      transition:
        transform 260ms cubic-bezier(0.22, 1, 0.36, 1),
        opacity 220ms ease,
        filter 220ms ease,
        box-shadow 260ms ease !important;
      will-change: transform, opacity !important;
    }

    body[data-mlp-route="home"] .mlp-home-day-wheel .mlp-home-schedule-card + .mlp-home-schedule-card {
      margin-top: -60px !important;
    }

    body[data-mlp-route="home"] .mlp-home-day-wheel.is-folded .mlp-home-schedule-card {
      opacity: 0.72 !important;
      filter: saturate(0.9) blur(0.2px) !important;
      transform: translateY(0) scale(0.94) rotateX(4deg) !important;
      box-shadow:
        6px 9px 16px rgba(101, 89, 76, 0.08),
        -5px -5px 12px rgba(255, 255, 247, 0.48),
        inset 1px 1px 0 rgba(255, 255, 255, 0.52) !important;
    }

    body[data-mlp-route="home"] .mlp-home-day-wheel.is-folded .mlp-home-schedule-card.is-active {
      opacity: 1 !important;
      filter: saturate(1.02) blur(0) !important;
      transform: translateY(0) scale(1) rotateX(0deg) !important;
      z-index: 4 !important;
      box-shadow:
        8px 12px 22px rgba(101, 89, 76, 0.13),
        -7px -7px 16px rgba(255, 255, 247, 0.62),
        inset 1px 1px 0 rgba(255, 255, 255, 0.68) !important;
    }

    body[data-mlp-route="home"] .mlp-home-day-wheel.is-folded .mlp-home-schedule-card.is-next {
      opacity: 0.9 !important;
      filter: saturate(0.98) blur(0) !important;
      transform: translateY(4px) scale(0.975) rotateX(2deg) !important;
      z-index: 3 !important;
    }

    body[data-mlp-route="home"] .mlp-home-day-wheel.is-folded .mlp-home-schedule-card.is-prev {
      opacity: 0.58 !important;
      transform: translateY(-4px) scale(0.92) rotateX(6deg) !important;
      z-index: 1 !important;
    }

    @keyframes mlpHomeScheduleFloat {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-2px); }
    }

    body[data-mlp-route="home"] .mlp-home-date-chip {
      width: 43px !important;
      height: 43px !important;
      flex: 0 0 43px !important;
      border-radius: 15px !important;
      color: rgba(107, 88, 67, 0.72) !important;
      background: rgba(244, 242, 229, 0.84) !important;
      box-shadow:
        5px 6px 12px rgba(101, 89, 76, 0.1),
        -5px -5px 12px rgba(255, 255, 247, 0.55) !important;
    }

    body[data-mlp-route="home"] .mlp-home-date-chip span:first-child {
      font-size: 12px !important;
      font-weight: 900 !important;
    }

    body[data-mlp-route="home"] .mlp-home-date-chip span:last-child {
      font-size: 9px !important;
      font-weight: 900 !important;
    }

    body[data-mlp-route="home"] .mlp-home-schedule-card {
      height: 84px !important;
      min-height: 84px !important;
      max-height: 84px !important;
      border-radius: 20px !important;
      padding: 12px 14px !important;
      display: grid !important;
      grid-template-columns: 1fr auto !important;
      grid-template-rows: auto auto auto !important;
      column-gap: 8px !important;
      row-gap: 3px !important;
      align-items: center !important;
      background: rgba(244, 242, 229, 0.82) !important;
      overflow: hidden !important;
    }

    body[data-mlp-route="home"] .mlp-home-schedule-card > div:first-child {
      grid-column: 1 !important;
      grid-row: 1 !important;
      display: block !important;
      margin-bottom: 0 !important;
      min-width: 0 !important;
    }

    body[data-mlp-route="home"] .mlp-home-schedule-card h4 {
      color: #6B5843 !important;
      font-size: 13px !important;
      line-height: 1.25 !important;
      font-weight: 900 !important;
      margin: 0 !important;
    }

    body[data-mlp-route="home"] .mlp-home-schedule-card > div:first-child > span {
      position: absolute !important;
      top: 13px !important;
      right: 14px !important;
      margin: 0 !important;
      background: rgba(203, 212, 155, 0.42) !important;
      color: rgba(107, 88, 67, 0.7) !important;
    }

    body[data-mlp-route="home"] .mlp-home-schedule-card > .space-y-2,
    body[data-mlp-route="home"] .mlp-home-schedule-card > div:not(:first-child):not(.pt-2) {
      grid-column: 1 !important;
      grid-row: 2 / span 2 !important;
      display: flex !important;
      flex-direction: column !important;
      gap: 4px !important;
      min-width: 0 !important;
    }

    body[data-mlp-route="home"] .mlp-home-schedule-card > .space-y-2 > div:first-child,
    body[data-mlp-route="home"] .mlp-home-schedule-card > div:not(:first-child):not(.pt-2):first-of-type {
      margin: 0 !important;
      display: flex !important;
      align-items: center !important;
      gap: 4px !important;
      color: rgba(107, 88, 67, 0.62) !important;
    }

    body[data-mlp-route="home"] .mlp-home-schedule-card .material-symbols-outlined {
      font-size: 13px !important;
      line-height: 1 !important;
    }

    body[data-mlp-route="home"] .mlp-home-schedule-card p {
      color: rgba(107, 88, 67, 0.62) !important;
      font-size: 10px !important;
      line-height: 1.25 !important;
      font-weight: 750 !important;
      margin: 0 !important;
    }

    body[data-mlp-route="home"] .mlp-home-schedule-card .pt-2,
    body[data-mlp-route="home"] .mlp-home-schedule-card button {
      display: none !important;
    }

    @media (max-width: 360px) {
      body[data-mlp-route="home"] .mlp-home-screen {
        padding-left: 10px !important;
        padding-right: 10px !important;
      }

      body[data-mlp-route="home"] .mlp-home-suggestion-card p {
        font-size: 12px !important;
      }
    }
  `;
  doc.head.append(style);
}

// 首页状态卡快捷入口：周进度进入清单，剩余预算进入收支统计。
function wireHomeQuickLinks(doc) {
  const cards = [...doc.querySelectorAll("main section > div, main .grid > div, main div")];
  const progressCard = cards.find((card) => card.textContent.includes("周进度") && card.textContent.includes("任务"));
  const budgetCard = cards.find((card) => card.textContent.includes("剩余预算"));

  // 给卡片写入统一路由标记，让全局点击代理负责真正跳转。
  enhanceHomeLinkCard(progressCard, "tasks", "查看清单");
  enhanceHomeLinkCard(budgetCard, "finance", "收支统计");
}

// 把普通展示卡增强成可点击卡，同时只追加一次轻量提示，避免重复加载时堆叠。
function enhanceHomeLinkCard(card, route, label) {
  if (!card || card.dataset.mlpRoute === route) return;

  card.dataset.mlpRoute = route;
  card.classList.add("mlp-home-link-card");
  card.style.cursor = "pointer";
  card.setAttribute("role", "button");
  card.setAttribute("tabindex", "0");
  card.setAttribute("aria-label", label);

  if (!card.querySelector(".mlp-home-link-hint")) {
    const hint = card.ownerDocument.createElement("span");
    hint.className = "mlp-home-link-hint";
    hint.innerHTML = `${label}<span class="material-symbols-outlined">chevron_right</span>`;
    card.append(hint);
  }
}

// 首页组件风格增强：只给现有模块补 class 和少量展示文案，保持原有排版骨架不变。
function enhanceHomeComponentStyle(doc) {
  const main = doc.querySelector("main");
  if (!main) return;
  main.classList.add("mlp-home-screen");

  const statCards = [...doc.querySelectorAll("main section.grid > div")];
  const progressCard = statCards.find((card) => card.textContent.includes("周进度"));
  const budgetCard = statCards.find((card) => card.textContent.includes("剩余预算"));
  progressCard?.closest("section")?.classList.add("mlp-home-stat-grid");
  progressCard?.classList.add("mlp-home-progress-card", "mlp-neumo-component");
  budgetCard?.classList.add("mlp-home-budget-card", "mlp-neumo-component");

  const suggestionCopy = {
    储蓄目标: "本周可多存 ¥320",
    投资提示: "预算稳定 可小额定投",
    税务优惠: "补充票据 减少遗漏"
  };
  [...doc.querySelectorAll("main h4")].forEach((title) => {
    const label = title.textContent.trim();
    const copy = suggestionCopy[label];
    if (!copy) return;
    const card = title.closest(".flex-none");
    card?.classList.add("mlp-home-suggestion-card", "mlp-neumo-component");
    const text = card?.querySelector("p");
    if (text) text.textContent = copy;
  });

  const scheduleTitle = [...doc.querySelectorAll("main h3")].find((title) => title.textContent.includes("日程概览"));
  const scheduleSection = scheduleTitle?.closest("section");
  scheduleSection?.classList.add("mlp-home-schedule-section");
  scheduleSection?.querySelectorAll(".w-14.h-14").forEach((chip) => chip.classList.add("mlp-home-date-chip"));
  scheduleSection?.querySelectorAll(".flex-grow").forEach((card) => card.classList.add("mlp-home-schedule-card", "mlp-neumo-component"));
  renderHomeScheduleItems(doc);
}

function renderHomeScheduleItems(doc) {
  const scheduleTitle = [...doc.querySelectorAll("main h3")].find((title) => title.textContent.includes("日程概览"));
  const scheduleSection = scheduleTitle?.closest("section");
  const timeline = scheduleSection?.querySelector(":scope > .relative");
  if (!scheduleSection || !timeline || !runtime.calendarItems.length) return;

  const items = [...runtime.calendarItems]
    .sort((a, b) => `${a.date || ""} ${a.time || ""}`.localeCompare(`${b.date || ""} ${b.time || ""}`));

  const rangeNode = scheduleSection.querySelector(".flex.justify-between span");
  if (rangeNode) rangeNode.textContent = formatHomeScheduleRange(items);

  timeline.innerHTML = "";
  groupCalendarItemsByDate(items).forEach(([dateKey, dayItems]) => {
    const date = parseLocalDate(dateKey);
    const node = doc.createElement("div");
    node.className = "relative flex gap-6 pb-8 mlp-home-day-group";
    node.dataset.mlpHomeCalendarDate = dateKey;
    node.innerHTML = `
      <div class="flex-none z-10">
        <div class="w-14 h-14 bg-surface-container-high text-text-main/60 rounded-2xl flex flex-col items-center justify-center mlp-home-date-chip">
          <span class="text-lg font-bold leading-none">${escapeHtml(formatHomeDay(date))}</span>
          <span class="text-[9px] font-bold uppercase mt-0.5 opacity-60">${escapeHtml(formatHomeMonth(date))}</span>
        </div>
      </div>
      <div class="mlp-home-day-wheel" aria-label="${escapeHtml(formatHomeDayLabel(date, dayItems.length))}">
        ${dayItems
          .map(
            (item, index) => `
          <div class="flex-grow bg-surface-container-lowest/60 p-4 rounded-3xl border border-outline-variant/10 mlp-home-schedule-card mlp-neumo-component" data-mlp-home-calendar-item="${item.id}" data-mlp-fold-index="${index}">
            <div class="flex justify-between items-start mb-2">
              <h4 class="font-bold text-text-main">${escapeHtml(item.title)}</h4>
              <span class="text-[10px] bg-secondary-container text-text-main px-2 py-0.5 rounded-full font-bold">${escapeHtml(item.time || "全天")}</span>
            </div>
            <div class="space-y-2">
              <div class="flex items-center gap-2 text-text-main/60">
                <span class="material-symbols-outlined text-base">${getHomeScheduleIcon(item.type)}</span>
                <p class="text-xs">${escapeHtml(item.note || item.type || "未填写地点")}</p>
              </div>
              <p class="text-[11px] text-text-main/80 line-clamp-2">${escapeHtml(formatHomeScheduleMeta(item))}</p>
            </div>
          </div>
        `
          )
          .join("")}
      </div>
    `;
    timeline.append(node);
  });
  hydrateHomeDayWheels(doc);
}

function hydrateHomeDayWheels(doc) {
  doc.querySelectorAll(".mlp-home-day-wheel").forEach((wheel) => {
    const cards = [...wheel.querySelectorAll(".mlp-home-schedule-card")];
    if (cards.length <= 1) {
      cards[0]?.classList.add("is-active");
      return;
    }

    wheel.classList.add("is-folded");

    const sync = () => {
      const activeIndex = cards.reduce(
        (closest, card, index) => {
          const distance = Math.abs(card.offsetTop - wheel.scrollTop);
          return distance < closest.distance ? { index, distance } : closest;
        },
        { index: 0, distance: Number.POSITIVE_INFINITY }
      ).index;

      cards.forEach((card, index) => {
        card.classList.toggle("is-active", index === activeIndex);
        card.classList.toggle("is-prev", index < activeIndex);
        card.classList.toggle("is-next", index === activeIndex + 1);
      });
    };

    sync();
    if (wheel.dataset.mlpHomeWheelWired) return;
    wheel.dataset.mlpHomeWheelWired = "true";
    wheel.addEventListener("scroll", () => requestAnimationFrame(sync), { passive: true });
    wheel.addEventListener("wheel", (event) => {
      if (Math.abs(event.deltaY) < 8) return;
      event.preventDefault();
      const currentIndex = cards.findIndex((card) => card.classList.contains("is-active"));
      const nextIndex = Math.max(0, Math.min(cards.length - 1, currentIndex + Math.sign(event.deltaY)));
      cards[nextIndex]?.scrollIntoView({ block: "start", behavior: "smooth" });
    }, { passive: false });
  });
}

function groupCalendarItemsByDate(items) {
  const groups = new Map();
  items.forEach((item) => {
    const key = item.date || new Date().toISOString().slice(0, 10);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });

  return [...groups.entries()].map(([date, dayItems]) => [
    date,
    dayItems.sort((a, b) => `${a.time || ""}`.localeCompare(`${b.time || ""}`))
  ]);
}

function formatHomeDayLabel(date, count) {
  return `${date.getMonth() + 1}月${date.getDate()}日，${count} 条计划`;
}

function parseLocalDate(value) {
  if (!value) return new Date();
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
}

function formatHomeDay(date) {
  return String(date.getDate()).padStart(2, "0");
}

function formatHomeMonth(date) {
  return date.toLocaleString("en-US", { month: "short" }).toUpperCase();
}

function formatHomeScheduleRange(items) {
  const dates = items.map((item) => parseLocalDate(item.date)).sort((a, b) => a - b);
  const first = dates[0];
  const last = dates[dates.length - 1];
  const firstText = `${first.getMonth() + 1}月${first.getDate()}日`;
  const lastText = `${last.getMonth() + 1}月${last.getDate()}日`;
  return firstText === lastText ? firstText : `${firstText} - ${lastText}`;
}

function formatHomeScheduleMeta(item) {
  const date = item.date ? `${parseLocalDate(item.date).getMonth() + 1}月${parseLocalDate(item.date).getDate()}日` : "今日";
  return `${date} · ${item.type || "日程"}${item.note ? " · 已同步到日程数据库" : ""}`;
}

function getHomeScheduleIcon(type) {
  const iconMap = {
    会议: "location_on",
    运动: "fitness_center",
    生活: "home",
    重要: "flag"
  };
  return iconMap[type] || "event";
}

// 记账页顶部“支出/收入”分段按钮绑定到对应页面。
function wireAccountingTabs(doc, route) {
  // 原 UI 中分段按钮位于 top-16 的固定区域。
  const tabBar = doc.querySelector(".fixed.top-16 .inline-flex");
  const buttons = tabBar ? [...tabBar.querySelectorAll("button")] : [];
  if (buttons.length < 2) return;

  // 第一个按钮固定进入支出录入页，第二个按钮进入收入录入页。
  buttons[0].dataset.mlpRoute = "expense";
  buttons[1].dataset.mlpRoute = "expense-alt";
  buttons[0].setAttribute("aria-label", "切换到支出录入");
  buttons[1].setAttribute("aria-label", "切换到收入录入");

  // 同步 aria-pressed，标记当前激活状态。
  buttons.forEach((button, index) => {
    const active = (route === "expense" && index === 0) || (route === "expense-alt" && index === 1);
    button.style.cursor = "pointer";
    button.setAttribute("aria-pressed", String(active));
  });
}

// 绑定记账页底部数字键盘，让用户输入金额和备注。
function wireAccountingInput(doc, mode) {
  // footer 是原始页面底部数字键盘区域。
  const footer = doc.querySelector("footer");

  // 金额展示区域是页面中字号为 40px 的数字节点。
  const amountDisplay = doc.querySelector("section .text-\\[40px\\]") || doc.querySelector("section div.text-\\[40px\\]");

  // 文本输入框用于保存备注/描述。
  const noteInput = footer?.querySelector("[data-mlp-note-input]") || footer?.querySelector("input");

  // 根据当前是支出还是收入，读取对应草稿。
  const draft = runtime.accountingDrafts[mode] || { amount: "", note: "" };

  // 把草稿金额显示到页面大数字区域。
  if (amountDisplay) amountDisplay.textContent = formatDraftAmount(draft.amount);

  // 把草稿备注显示到输入框，并在输入时保存。
  if (noteInput) {
    noteInput.value = draft.note || "";
    noteInput.addEventListener("input", () => {
      runtime.accountingDrafts[mode] = { ...runtime.accountingDrafts[mode], note: noteInput.value };
      saveRuntime();
      renderAccountingDraftBox(doc, mode);
    });
  }

  // 避免同一个 footer 重复绑定点击事件。
  if (!footer || footer.dataset.mlpAccountingWired) return;
  footer.dataset.mlpAccountingWired = "true";

  // 监听数字键盘点击。
  footer.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;

    // 获取用户点击的按键文本，比如 1、2、.、完成等。
    const key = button.textContent.trim();

    // 当前模式从路由判断，保证切换收入/支出后仍写入正确草稿。
    const currentMode = getRouteFromHash() === "expense-alt" ? "income" : "expense";
    const currentDraft = runtime.accountingDrafts[currentMode] || { amount: "", note: "" };

    // 数字和小数点：追加到金额草稿。
    if (/^[0-9.]$/.test(key)) {
      currentDraft.amount = nextAmountValue(currentDraft.amount, key);
    // 删除键：删掉最后一位金额。
    } else if (button.querySelector(".material-symbols-outlined")?.textContent.trim() === "backspace") {
      currentDraft.amount = currentDraft.amount.slice(0, -1);
    // 加减号目前只保留原 UI，不写入数据。
    } else if (key.includes("+") || key.includes("-")) {
      return;
    // “完成”按钮：保存一条明细。
    } else if (button.className.includes("col-span-2")) {
      commitAccountingItem(doc, currentMode);
      return;
    } else {
      return;
    }

    // 保存草稿并刷新当前金额显示。
    runtime.accountingDrafts[currentMode] = currentDraft;
    saveRuntime();
    renderAccountingDraftBox(doc, currentMode);
    wireAccountingInput(doc, currentMode);
  });
}

// 在记账页显示金额和备注输入预览。
// 这里只展示还没点击“完成”的输入内容，避免用户误以为已经写入数据库。
function renderAccountingDraftBox(doc, mode) {
  doc.querySelector("[data-mlp-accounting-draft]")?.remove();
  const footer = doc.querySelector("footer");
  if (!footer) return;

  const draft = runtime.accountingDrafts[mode] || { amount: "", note: "" };
  const amountText = `¥${formatDraftAmount(draft.amount)}`;
  const noteText = draft.note || "";

  const section = doc.createElement("section");
  section.dataset.mlpAccountingDraft = "true";
  section.className = "mlp-accounting-draft mlp-accounting-draft-inline";
  section.innerHTML = `
    <label class="mlp-draft-label" for="mlp-draft-note-${mode}">金额</label>
    <div class="mlp-draft-field mlp-draft-amount">
      <strong>${escapeHtml(amountText)}</strong>
    </div>
    <label class="mlp-draft-label" for="mlp-draft-note-${mode}">备注</label>
    <div class="mlp-draft-note-row">
      <input id="mlp-draft-note-${mode}" data-mlp-note-input value="${escapeHtml(noteText)}" placeholder="输入文字智能记账" autocomplete="off" />
      <button class="mlp-draft-note-action" type="button" aria-label="语音输入">
        <span class="material-symbols-outlined" data-icon="mic">mic</span>
      </button>
    </div>
  `;

  // 原页面的输入组件在 footer 顶部，这里把草稿状态放进同一个输入组件区域。
  const inputContainer = footer.querySelector(".px-6.pt-4") || footer.firstElementChild || footer;
  inputContainer.innerHTML = "";
  inputContainer.append(section);
}

// 计算用户按下数字键后的下一个金额字符串。
function nextAmountValue(value, key) {
  // 一个金额只允许一个小数点。
  if (key === "." && value.includes(".")) return value;
  // 第一个输入是小数点时补成 0.。
  if (key === "." && !value) return "0.";
  // 避免 00012 这种显示。
  if (value === "0" && key !== ".") return key;
  // 限制长度，避免撑破 UI。
  return `${value}${key}`.slice(0, 10);
}

// 把金额草稿格式化成页面显示用的数字文本。
function formatDraftAmount(value) {
  if (!value) return "0.00";
  const number = Number(value);
  if (Number.isNaN(number)) return value;
  return number.toLocaleString("zh-CN", {
    minimumFractionDigits: value.includes(".") ? 0 : 2,
    maximumFractionDigits: 2
  });
}

// 用户点击“完成”后，保存一条收入/支出记录。
function commitAccountingItem(doc, mode) {
  // 读取当前模式的金额和备注草稿。
  const draft = runtime.accountingDrafts[mode] || { amount: "", note: "" };
  const amount = Number(draft.amount || 0);

  // 金额为空或 0 时不保存。
  if (!amount) return;

  // 新记录放到数组最前面，收支视图和明细页都读取这个数组。
  runtime.accountingItems.unshift({
    id: Date.now(),
    mode,
    amount,
    note: draft.note || (mode === "income" ? "收入记录" : "支出记录"),
    book: runtime.activeAccountBook || "个人账本",
    createdAt: new Date().toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
  });

  // 保存后清空当前模式的草稿。
  runtime.accountingDrafts[mode] = { amount: "", note: "" };
  saveRuntime();

  // 刷新当前页金额和明细模块。
  renderAccountingDraftBox(doc, mode);
  wireAccountingInput(doc, mode);
  renderAccountingDetails(doc, mode);
}

// 账本选择按钮代表后端/本地数据库集合，这里只切换或管理数据，不做页面跳转。
function wireAccountBookDatabaseControls(doc) {
  const section = [...doc.querySelectorAll("section")].find((node) => node.textContent.includes("账本选择") || node.textContent.includes("选择账户"));
  if (!section) return;

  const header = [...section.querySelectorAll("span")].find((node) => ["管理", "详情", "完成"].includes(node.textContent.trim()));
  const buttonRow = section.querySelector(".overflow-x-auto") || section.querySelector(".flex.gap-3");
  if (!buttonRow) return;

  if (!runtime.accountBooks.length) {
    runtime.accountBooks = ["个人账本"];
    runtime.activeAccountBook = "个人账本";
    saveRuntime();
  }
  if (!runtime.accountBooks.includes(runtime.activeAccountBook)) runtime.activeAccountBook = runtime.accountBooks[0];

  if (header && !header.dataset.mlpBookManageReady) {
    header.dataset.mlpBookManageReady = "true";
    header.style.cursor = "pointer";
    header.setAttribute("role", "button");
    header.setAttribute("tabindex", "0");
    header.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      runtime.accountBookManage = !runtime.accountBookManage;
      saveRuntime();
      wireAccountBookDatabaseControls(doc);
    });
  }
  if (header) header.textContent = runtime.accountBookManage ? "完成" : "管理";

  buttonRow.innerHTML = "";
  runtime.accountBooks.forEach((name, index) => {
    const active = runtime.activeAccountBook === name;
    const button = doc.createElement("button");
    button.type = "button";
    button.className = `mlp-book-chip ${active ? "is-active" : ""}`;
    button.dataset.mlpBookName = name;
    button.innerHTML = `
      <span class="material-symbols-outlined" data-icon="${index === 0 ? "person" : index === 1 ? "groups" : "work"}">${index === 0 ? "person" : index === 1 ? "groups" : "work"}</span>
      <span>${escapeHtml(name)}</span>
      ${runtime.accountBookManage ? `<span class="mlp-book-delete" data-delete-book="${escapeHtml(name)}">×</span>` : ""}
    `;

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const deleteTarget = event.target.closest("[data-delete-book]");
      if (deleteTarget) {
        const targetName = deleteTarget.dataset.deleteBook;
        runtime.accountBooks = runtime.accountBooks.filter((book) => book !== targetName);
        if (!runtime.accountBooks.length) runtime.accountBooks = ["个人账本"];
        if (runtime.activeAccountBook === targetName) runtime.activeAccountBook = runtime.accountBooks[0];
      } else {
        runtime.activeAccountBook = name;
      }
      saveRuntime();
      wireAccountBookDatabaseControls(doc);
      renderAccountingDraftBox(doc, getRouteFromHash() === "expense-alt" ? "income" : "expense");
    });

    buttonRow.append(button);
  });
}

// 在收入页/支出页下方渲染“明细”模块。
function renderAccountingDetails(doc, mode) {
  // 先删除旧模块，避免重复渲染。
  doc.querySelector("[data-mlp-accounting-details]")?.remove();
  const main = doc.querySelector("main");
  if (!main) return;

  // 只显示当前模式的数据：收入页显示收入，支出页显示支出。
  const items = runtime.accountingItems.filter((item) => item.mode === mode);
  const section = doc.createElement("section");
  section.dataset.mlpAccountingDetails = "true";
  section.className = "space-y-4 mlp-accounting-details";
  section.innerHTML = `
    <div class="flex justify-between items-center">
      <h3 class="text-body-md font-bold text-dark-forest">明细</h3>
      <span class="text-label-sm text-primary font-semibold">${mode === "income" ? "收入" : "支出"}</span>
    </div>
    <div class="space-y-2">
      ${
        items.length
          ? items
              .map(
                (item) => `
                  <div class="mlp-accounting-row">
                    <div class="mlp-accounting-row-icon">
                      <span class="material-symbols-outlined">${mode === "income" ? "trending_up" : "receipt_long"}</span>
                    </div>
                    <div class="mlp-accounting-row-copy">
                      <div class="text-body-md font-bold text-dark-forest">${escapeHtml(item.note)}</div>
                      <div class="text-label-sm text-dark-forest/50">${escapeHtml(item.createdAt)}</div>
                    </div>
                    <div class="mlp-accounting-row-amount">¥${item.amount.toLocaleString("zh-CN")}</div>
                  </div>
                `
              )
              .join("")
          : `<div class="bg-surface-container-lowest border border-dashed border-outline-variant/40 rounded-2xl p-4 text-center text-dark-forest/50">暂无明细，输入金额后点击完成保存。</div>`
      }
    </div>
  `;
  main.append(section);
}

function enhanceAccountingColorSystem(doc) {
  const section = [...doc.querySelectorAll("section")].find((node) => node.textContent.includes("账本选择") || node.textContent.includes("选择账户"));
  section?.classList.add("mlp-account-book-section");
}

function simplifyCalendarPage(doc) {
  [...doc.querySelectorAll("section")].forEach((section) => {
    if (section.textContent.includes("今日预约") && section.textContent.includes("专注时长")) section.remove();
  });

  const calendarGrid = doc.querySelector(".grid.grid-cols-7.gap-2");
  calendarGrid?.classList.add("mlp-calendar-grid-clean");
  calendarGrid?.querySelectorAll(":scope > div").forEach((cell, index) => {
    if (index < 7) cell.classList.add("mlp-weekday-label");
    else cell.classList.add("mlp-calendar-day-cell");
  });
}

// 在“收支视图”页面追加一个运行时汇总模块。
// 这里把记账页保存的数据同步展示出来，不修改原始收支视图模块。
function renderFinanceRuntimeView(doc) {
  // 防止重复插入。
  doc.querySelector("[data-mlp-finance-runtime]")?.remove();
  const main = doc.querySelector("main");
  if (!main) return;

  // 收支统计页需要完全以记账录入数据为准，所以隐藏原静态示例模块。
  main.querySelectorAll(":scope > section:not([data-mlp-finance-runtime])").forEach((section) => {
    section.dataset.mlpOriginalFinance = "true";
    section.hidden = true;
  });

  // 计算收入总额。
  const income = runtime.accountingItems.filter((item) => item.mode === "income").reduce((sum, item) => sum + item.amount, 0);

  // 计算支出总额。
  const expense = runtime.accountingItems.filter((item) => item.mode === "expense").reduce((sum, item) => sum + item.amount, 0);

  // 计算结余和圆环图比例；没有数据时给一个柔和的默认比例，避免图表空白。
  const balance = income - expense;
  const total = income + expense;
  const incomeAngle = total ? Math.max(8, Math.round((income / total) * 100)) : 52;

  // 最近 10 条收入/支出明细作为“数据库联动”的可见结果。
  const recentItems = runtime.accountingItems.slice(0, 10);

  // 简单按备注聚合支出，生成横向条形图。
  const expenseGroups = runtime.accountingItems
    .filter((item) => item.mode === "expense")
    .reduce((result, item) => {
      const key = item.note || "支出记录";
      result[key] = (result[key] || 0) + item.amount;
      return result;
    }, {});
  const topExpenseGroups = Object.entries(expenseGroups)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const maxExpense = Math.max(...topExpenseGroups.map(([, amount]) => amount), 1);
  const aiAdvice = buildFinanceAdvice(income, expense, balance, topExpenseGroups);

  // 生成新的收支统计仪表盘：毛玻璃 + 新拟态，所有数字都来自记账页保存的数据。
  const section = doc.createElement("section");
  section.dataset.mlpFinanceRuntime = "true";
  section.className = "mlp-finance-dashboard";
  section.innerHTML = `
    <div class="mlp-finance-hero">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h3>收支统计</h3>
          <p class="text-sm text-on-surface-variant mt-1">数据实时连接记账页录入内容</p>
        </div>
        <button class="mlp-primary" type="button" data-mlp-route="expense">继续记账</button>
      </div>
      <div class="mlp-finance-balance">
        <div class="mlp-finance-pill">
          <span>总收入</span>
          <strong>¥${income.toLocaleString("zh-CN")}</strong>
        </div>
        <div class="mlp-finance-pill">
          <span>总支出</span>
          <strong>¥${expense.toLocaleString("zh-CN")}</strong>
        </div>
      </div>
      <div class="mlp-finance-pill mt-3">
        <span>当前结余</span>
        <strong>${balance >= 0 ? "" : "-"}¥${Math.abs(balance).toLocaleString("zh-CN")}</strong>
      </div>
    </div>
    <div class="mlp-finance-grid">
      <div class="mlp-finance-card">
        <h4>收支占比</h4>
        <div class="mlp-donut" style="--income-angle: ${incomeAngle}%"></div>
        <div class="flex justify-between text-xs font-bold">
          <span style="color: var(--mlp-leaf)">收入 ${incomeAngle}%</span>
          <span style="color: #A95C24">支出 ${100 - incomeAngle}%</span>
        </div>
      </div>
      <div class="mlp-finance-card">
        <h4>支出分布</h4>
        <div class="mlp-bars">
          ${
            topExpenseGroups.length
              ? topExpenseGroups
                  .map(
                    ([name, amount]) => `
                      <div class="mlp-bar">
                        <div class="flex justify-between mlp-chart-label">
                          <span>${escapeHtml(name)}</span>
                          <span>¥${amount.toLocaleString("zh-CN")}</span>
                        </div>
                        <div class="mlp-bar-track"><div class="mlp-bar-fill" style="--bar: ${Math.max(8, Math.round((amount / maxExpense) * 100))}%"></div></div>
                      </div>
                    `
                  )
                  .join("")
              : `<div class="mlp-empty-state">暂无支出数据</div>`
          }
        </div>
      </div>
    </div>
    <div class="mlp-finance-ai">
      <div class="mlp-ai-orb"><span class="material-symbols-outlined" data-icon="smart_toy">smart_toy</span></div>
      <div>
        <h4>AI 建议</h4>
        <p>${escapeHtml(aiAdvice)}</p>
      </div>
    </div>
    <div class="mlp-finance-card">
      <div class="flex items-center justify-between">
        <h4>录入明细</h4>
        <span class="mlp-chart-label">${recentItems.length} 条记录</span>
      </div>
      <div class="mlp-finance-list">
        ${
          recentItems.length
            ? recentItems
                .map(
                  (item) => `
                    <div class="mlp-finance-row ${item.mode === "expense" ? "is-expense" : ""}">
                      <div>
                        <p class="text-sm font-bold text-on-surface">${escapeHtml(item.note)}</p>
                        <span>${escapeHtml(item.createdAt)} · ${item.mode === "income" ? "收入" : "支出"}</span>
                      </div>
                      <strong>${item.mode === "income" ? "+" : "-"}¥${item.amount.toLocaleString("zh-CN")}</strong>
                    </div>
                  `
                )
                .join("")
            : `<div class="mlp-empty-state">暂无录入明细，前往记账页添加收入或支出。</div>`
        }
      </div>
    </div>
  `;
  main.prepend(section);
}

// 根据当前收支数据生成一条轻量 AI 建议，作为本地模拟分析结果。
function buildFinanceAdvice(income, expense, balance, topExpenseGroups) {
  if (!income && !expense) return "先记录一笔收入或支出，我会根据真实录入数据给出预算和节奏建议。";
  if (balance < 0) return "本期支出已经高于收入，建议先暂停非必要消费，并把高频支出拆成每周预算。";
  if (expense > income * 0.7) return "支出占收入比例偏高，建议把固定开销和弹性消费分开记录，优先压缩弹性消费。";
  if (topExpenseGroups.length) return `目前支出最高的是“${topExpenseGroups[0][0]}”，可以先给这一类设置一个提醒额度。`;
  return "当前结余状态不错，可以继续保持记录频率，并把稳定结余转入储蓄或长期目标。";
}

// 日程页左上角原本是 menu，这里按需求改成返回箭头。
function convertCalendarMenuToBack(doc) {
  const firstIcon = doc.querySelector("header .material-symbols-outlined");
  if (!firstIcon || firstIcon.textContent.trim() !== "menu") return;

  // 只替换图标文本，不改动 header 结构。
  firstIcon.textContent = "arrow_back";
  firstIcon.dataset.icon = "arrow_back";
  firstIcon.closest("button")?.setAttribute("aria-label", "返回首页");
}

// 日程页不再使用右下角浮动加号作为入口，而是在页面内容中插入一个新建日程模块。
function renderCalendarCreateModule(doc) {
  if (doc.querySelector("[data-mlp-calendar-create-module]")) return;

  // 隐藏原右下角浮动按钮，避免同一个功能出现两个入口。
  const floatingAdd = [...doc.querySelectorAll(".fixed.right-6.bottom-24, .fixed.bottom-24")].find((node) => node.textContent.includes("add"));
  if (floatingAdd) floatingAdd.hidden = true;

  // 找到时间轴区块，把新建模块放在时间轴上方，用户浏览日程时可以自然看到。
  const timelineSection = [...doc.querySelectorAll("section")].find((section) => section.querySelector(".relative.space-y-gutter"));
  if (!timelineSection) return;

  const module = doc.createElement("section");
  module.dataset.mlpCalendarCreateModule = "true";
  module.className = "px-margin pb-md";
  module.innerHTML = `
    <button class="mlp-calendar-create-module" type="button" data-mlp-route="calendar-modal">
      <span class="material-symbols-outlined" data-icon="add_circle">add_circle</span>
      <div>
        <strong>新建日程</strong>
        <p>添加日期、时间和类型，同步到日程表与时间轴。</p>
      </div>
      <span class="material-symbols-outlined" data-icon="chevron_right">chevron_right</span>
    </button>
  `;
  timelineSection.before(module);
}

// 强化日程页顶部日历卡：让日期格、周标题、当日状态和新增日程呈现更完整。
function enhanceCalendarGridCard(doc) {
  if (doc.body.dataset.mlpCalendarEnhanced) return;
  doc.body.dataset.mlpCalendarEnhanced = "true";

  const calendarSection = [...doc.querySelectorAll("section")].find((section) => section.querySelector(".grid.grid-cols-7.gap-2"));
  if (!calendarSection) return;

  calendarSection.classList.add("mlp-calendar-card");
  const grid = calendarSection.querySelector(".grid.grid-cols-7.gap-2");
  grid?.classList.add("mlp-calendar-grid");

  // 给日期格补充统一的状态类名，让当前日期、空白日期和有安排日期更清楚。
  [...(grid?.children || [])].forEach((cell) => {
    const dayText = cell.querySelector("span")?.textContent.trim();
    if (!dayText) return;
    cell.classList.add("mlp-day-cell");
    if (dayText === "15") cell.classList.add("is-today");
    if (cell.textContent.includes("周会") || cell.textContent.includes("瑜伽") || cell.textContent.includes("读书")) cell.classList.add("has-event");
    if (["13", "14", "18", "19"].includes(dayText)) cell.classList.add("is-muted");
  });

  // 在日历卡底部追加一个小型摘要，补足“这个日历卡能表达什么”的信息层次。
  const footer = doc.createElement("div");
  footer.className = "mlp-calendar-card-footer";
  footer.innerHTML = `
    <span><strong>今日</strong> 4 场</span>
    <span>本周 12 项安排</span>
  `;
  calendarSection.append(footer);
}

// 根据用户点击的元素推断要跳转的页面或要打开的弹窗。
function inferRouteFromClick(clicked) {
  const currentRoute = getRouteFromHash();
  const icon = getIconName(clicked);
  const text = clicked.textContent.replace(/\s+/g, "");

  // 清单页顶部新增列表按钮单独打开“新建清单”弹窗。
  if (clicked.dataset.mlpAction === "new-list") return "list-modal";

  // 日程页浮动加号：新建日程。
  if (currentRoute === "calendar" && isFloatingAdd(clicked)) return "calendar-modal";

  // 清单页浮动加号：新建任务，并选择保存到哪个清单。
  if (currentRoute === "tasks" && isFloatingAdd(clicked)) return "task-modal";

  // 记账页右上角 ...：进入收支视图。
  if ((currentRoute === "expense" || currentRoute === "expense-alt") && icon === "more_horiz") return "finance";

  // 优先读取我们主动写入的路由标记。
  if (clicked.dataset.mlpRoute) return clicked.dataset.mlpRoute;

  // 再根据底部导航图标匹配路由。
  if (bottomNavIconRoutes[icon]) return bottomNavIconRoutes[icon];

  // 返回箭头统一回首页。
  if (icon === "arrow_back") return "home";

  // 兜底：根据按钮文字推断跳转。
  if (text.includes("记账") || text.includes("账本")) return "expense";
  if (text.includes("收支视图") || text.includes("查看详情")) return "finance";
  if (text.includes("日程") || text.includes("会议") || text.includes("时间轴")) return "calendar";
  if (text.includes("任务") || text.includes("待办") || text.includes("清单")) return "tasks";
  if (text.includes("AI") || text.includes("晚晚") || text.includes("智能")) return "ai";
  if (text.includes("登录") || text.includes("注册") || text.includes("账号")) return "login";
  if (text.includes("个人") || text.includes("偏好")) return "profile";
  if (text.includes("首页") || text.includes("静谧生活")) return "home";

  return "";
}

// 读取元素内部的 Material Symbols 图标名。
function getIconName(element) {
  const icon = element.querySelector?.("[data-icon], .material-symbols-outlined");
  return icon?.dataset.icon || icon?.textContent.trim() || "";
}

// 判断用户点击的是否是页面右下角浮动加号。
function isFloatingAdd(element) {
  const icon = getIconName(element);
  const button = element.closest("button");
  const wrapper = element.closest("div");
  const className = `${button?.className || ""} ${wrapper?.className || ""}`;

  return icon === "add" && className.includes("fixed") && className.includes("bottom-24");
}

// 注入所有运行时新增组件需要的 CSS。
// 原始页面仍使用自己的 Tailwind/CSS，这里只补弹窗、滑动删除、AI 输入框等动态 UI。
function injectRuntimeStyles(doc) {
  // 同一个 iframe 页面只注入一次样式。
  if (doc.querySelector("#mlp-runtime-style")) return;

  const style = doc.createElement("style");
  style.id = "mlp-runtime-style";
  style.textContent = `
    :root {
      --mlp-sun-bg: #F4F2E5;
      --mlp-sun-bg-2: #ECE7D7;
      --mlp-sun-yellow: #D8A7A0;
      --mlp-sun-gold: #B98782;
      --mlp-leaf: #9CAF88;
      --mlp-leaf-deep: #5E7255;
      --mlp-pistachio-nav: #CBD49B;
      --mlp-pistachio-soft: #DDE4B8;
      --mlp-pistachio-light: #EEF0D4;
      --mlp-sage-mist: #C7D0B7;
      --mlp-rose-soft: #E8D6D3;
      --mlp-clay-soft: #DCC1B7;
      --mlp-seed: #5B5147;
      --mlp-rose: #D8A7A0;
      --mlp-rose-deep: #A66F6C;
      --mlp-cream: rgba(244, 242, 229, 0.86);
      --mlp-glass: rgba(244, 242, 229, 0.76);
      --mlp-glass-strong: rgba(248, 245, 235, 0.92);
      --mlp-border: rgba(255, 255, 247, 0.78);
      --mlp-shadow-dark: rgba(101, 89, 76, 0.15);
      --mlp-shadow-light: rgba(229, 226, 215, 0.72);
      --mlp-shadow-light-soft: rgba(236, 232, 221, 0.54);
      --mlp-ios-width: 393px;
      --mlp-ios-height: 852px;
      --mlp-ios-safe-top: 47px;
      --mlp-ios-header-height: 58px;
      --mlp-ios-home-indicator: 34px;
      --mlp-ios-bottom-nav-height: 66px;
      --mlp-ios-page-bottom: calc(var(--mlp-ios-home-indicator) + var(--mlp-ios-bottom-nav-height) + 22px);
    }
    body.mlp-sunflower-theme {
      width: 100%;
      min-height: 100dvh;
      overflow-x: hidden;
      box-sizing: border-box;
      color: var(--mlp-seed) !important;
      background:
        radial-gradient(circle at 14% 2%, rgba(221, 228, 184, 0.48), transparent 32%),
        radial-gradient(circle at 84% 10%, rgba(232, 214, 211, 0.36), transparent 30%),
        radial-gradient(circle at 90% 72%, rgba(199, 208, 183, 0.32), transparent 30%),
        linear-gradient(180deg, #F4F2E5 0%, #F0EEDB 54%, #E7E8D0 100%) !important;
    }
    body.mlp-sunflower-theme::before {
      content: "";
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: var(--mlp-ios-safe-top);
      z-index: 900;
      pointer-events: none;
      background: linear-gradient(180deg, rgba(244, 242, 229, 0.96), rgba(244, 242, 229, 0.72));
      backdrop-filter: blur(14px) saturate(1.12);
      -webkit-backdrop-filter: blur(14px) saturate(1.12);
    }
    body.mlp-sunflower-theme::after {
      content: "";
      position: fixed;
      left: 50%;
      bottom: 8px;
      z-index: 1001;
      width: 134px;
      height: 5px;
      border-radius: 999px;
      pointer-events: none;
      transform: translateX(-50%);
      background: rgba(65, 55, 45, 0.72);
      box-shadow: 0 1px 3px rgba(255, 255, 247, 0.35);
    }
    body.mlp-sunflower-theme main {
      position: relative;
      z-index: 1;
      width: 100%;
      max-width: var(--mlp-ios-width);
      margin-left: auto;
      margin-right: auto;
      box-sizing: border-box;
      padding-bottom: var(--mlp-ios-page-bottom) !important;
    }
    body.mlp-sunflower-theme main.pt-24,
    body.mlp-sunflower-theme main[class*="pt-24"],
    body.mlp-sunflower-theme main[class*="mt-16"] {
      padding-top: calc(var(--mlp-ios-safe-top) + 74px) !important;
      margin-top: 0 !important;
    }
    body.mlp-sunflower-theme main::before {
      content: "";
      position: fixed;
      inset: 0;
      z-index: -1;
      pointer-events: none;
      background-image:
        linear-gradient(rgba(255, 255, 255, 0.22) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.16) 1px, transparent 1px);
      background-size: 28px 28px;
      opacity: 0.32;
      mask-image: linear-gradient(to bottom, black, transparent 82%);
    }
    body.mlp-sunflower-theme header,
    body.mlp-sunflower-theme footer,
    body.mlp-sunflower-theme nav.fixed.bottom-0 {
      background: rgba(244, 242, 229, 0.78) !important;
      border-color: rgba(255, 255, 247, 0.78) !important;
      box-shadow: 0 8px 18px rgba(101, 89, 76, 0.08) !important;
      backdrop-filter: blur(16px) saturate(1.12);
    }
    body.mlp-sunflower-theme header.fixed.top-0,
    body.mlp-sunflower-theme header.docked.top-0,
    body.mlp-sunflower-theme nav.fixed.top-0 {
      top: var(--mlp-ios-safe-top) !important;
      height: var(--mlp-ios-header-height) !important;
      min-height: var(--mlp-ios-header-height) !important;
      padding-top: 0 !important;
      z-index: 920 !important;
    }
    body.mlp-sunflower-theme header.sticky.top-0,
    body.mlp-sunflower-theme header.sticky,
    body.mlp-sunflower-theme header.docked.sticky {
      top: var(--mlp-ios-safe-top) !important;
      margin-top: var(--mlp-ios-safe-top) !important;
      min-height: var(--mlp-ios-header-height) !important;
      z-index: 920 !important;
    }
    body.mlp-sunflower-theme nav.fixed.bottom-0 {
      left: 50% !important;
      right: auto !important;
      bottom: calc(var(--mlp-ios-home-indicator) + 8px) !important;
      width: calc(100% - 28px) !important;
      max-width: 365px !important;
      height: var(--mlp-ios-bottom-nav-height) !important;
      min-height: var(--mlp-ios-bottom-nav-height) !important;
      padding: 8px 12px !important;
      border-radius: 24px !important;
      transform: translateX(-50%);
      background: #CBD49B !important;
      border-color: rgba(255, 255, 247, 0.66) !important;
      box-shadow: 0 -8px 20px rgba(94, 114, 85, 0.14) !important;
    }
    body.mlp-sunflower-theme footer.fixed.bottom-0 {
      left: 50% !important;
      right: auto !important;
      bottom: calc(var(--mlp-ios-home-indicator) + 8px) !important;
      width: calc(100% - 24px) !important;
      max-width: 369px !important;
      transform: translateX(-50%);
      border-radius: 28px 28px 22px 22px !important;
      overflow: hidden;
    }
    body.mlp-sunflower-theme nav.fixed.bottom-0 *,
    body.mlp-sunflower-theme nav.fixed.bottom-0 button,
    body.mlp-sunflower-theme nav.fixed.bottom-0 [class*='rounded'] {
      text-shadow: none !important;
      box-shadow: none !important;
    }
    body.mlp-sunflower-theme nav.fixed.bottom-0 [class*='flex-col'],
    body.mlp-sunflower-theme nav.fixed.bottom-0 button {
      color: rgba(48, 64, 42, 0.72) !important;
    }
    body.mlp-sunflower-theme nav.fixed.bottom-0 [class*='text-\\[\\#1B3220\\]'],
    body.mlp-sunflower-theme nav.fixed.bottom-0 .text-primary {
      color: #263822 !important;
    }
    body.mlp-sunflower-theme .bg-surface-container-lowest,
    body.mlp-sunflower-theme .bg-white,
    body.mlp-sunflower-theme .glass-card,
    body.mlp-sunflower-theme section > .rounded-xl,
    body.mlp-sunflower-theme section > .rounded-2xl,
    body.mlp-sunflower-theme section > .rounded-\\[24px\\],
    body.mlp-sunflower-theme section > .rounded-\\[28px\\] {
      background: var(--mlp-glass) !important;
      border-color: var(--mlp-border) !important;
      box-shadow:
        6px 6px 16px rgba(101, 89, 76, 0.11),
        -6px -6px 16px var(--mlp-shadow-light),
        inset 1px 1px 0 rgba(236, 232, 221, 0.24) !important;
      backdrop-filter: blur(14px) saturate(1.12);
    }
    body.mlp-sunflower-theme button {
      transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease, opacity 0.18s ease;
    }
    .mlp-neumo-component {
      border: 1px solid rgba(255, 255, 247, 0.58) !important;
      background: rgba(244, 242, 229, 0.82) !important;
      box-shadow:
        11px 11px 24px rgba(101, 89, 76, 0.11),
        -9px -9px 22px rgba(229, 226, 215, 0.62) !important;
      backdrop-filter: blur(14px) saturate(1.08);
    }
    body[data-mlp-route="home"] .mlp-home-screen {
      padding-left: 22px !important;
      padding-right: 22px !important;
      padding-top: calc(var(--mlp-ios-safe-top) + 66px) !important;
      padding-bottom: var(--mlp-ios-page-bottom) !important;
      gap: 28px !important;
    }
    body[data-mlp-route="home"] .mlp-home-stat-grid {
      gap: 26px !important;
      align-items: stretch;
    }
    .mlp-home-progress-card,
    .mlp-home-budget-card {
      min-height: 150px;
      border-radius: 32px !important;
      padding: 26px 24px !important;
    }
    .mlp-home-progress-card {
      display: grid !important;
      grid-template-columns: 82px 1fr !important;
      align-items: center !important;
      justify-items: start !important;
      text-align: left !important;
      gap: 20px !important;
    }
    .mlp-home-progress-card .relative {
      width: 70px !important;
      height: 70px !important;
      border-radius: 999px;
      background: rgba(244, 242, 229, 0.78);
      box-shadow: inset 5px 5px 13px rgba(101, 89, 76, 0.1), inset -5px -5px 13px rgba(255, 255, 247, 0.72);
    }
    .mlp-home-progress-card svg circle:first-child {
      color: rgba(232, 214, 211, 0.66) !important;
    }
    .mlp-home-progress-card svg circle:last-child {
      color: #7C8E5C !important;
    }
    .mlp-home-progress-card p:first-child,
    .mlp-home-budget-card p:first-child {
      color: #6A4C2F !important;
      font-size: 20px !important;
      font-weight: 900 !important;
      letter-spacing: 0 !important;
      text-transform: none !important;
    }
    .mlp-home-progress-card p:last-child {
      margin-top: 6px;
      color: rgba(106, 76, 47, 0.72) !important;
      font-size: 15px !important;
      line-height: 1.35;
    }
    .mlp-home-budget-card {
      gap: 16px !important;
      background: rgba(244, 242, 229, 0.76) !important;
    }
    .mlp-home-budget-card > div:first-child {
      align-items: center !important;
    }
    .mlp-home-budget-card > div:first-child span:last-child {
      border-radius: 999px !important;
      padding: 6px 12px !important;
      color: rgba(106, 76, 47, 0.72) !important;
      background: rgba(232, 214, 211, 0.42) !important;
    }
    .mlp-home-budget-card .text-lg {
      margin-top: 10px;
      color: #6A4C2F !important;
      font-size: 34px !important;
      line-height: 1 !important;
      letter-spacing: 0 !important;
    }
    .mlp-home-budget-card .w-full.h-1 {
      height: 12px !important;
      border-radius: 999px !important;
      background: rgba(106, 76, 47, 0.12) !important;
      box-shadow: inset 2px 2px 5px rgba(101, 89, 76, 0.08);
    }
    .mlp-home-budget-card .w-full.h-1 > div {
      background: #CBD49B !important;
    }
    .mlp-home-suggestion-card {
      width: 182px !important;
      min-height: 166px;
      display: flex !important;
      flex-direction: column !important;
      justify-content: center !important;
      border-radius: 30px !important;
      padding: 24px 22px !important;
      background: rgba(244, 242, 229, 0.78) !important;
    }
    .mlp-home-suggestion-card:nth-child(3n) {
      background: rgba(232, 214, 211, 0.54) !important;
    }
    .mlp-home-suggestion-card > div:first-child {
      display: none !important;
    }
    .mlp-home-suggestion-card h4 {
      color: #6A4C2F !important;
      font-size: 18px !important;
      line-height: 1.25 !important;
      margin-bottom: 18px !important;
    }
    .mlp-home-suggestion-card p {
      color: rgba(106, 76, 47, 0.7) !important;
      font-size: 20px !important;
      line-height: 1.28 !important;
    }
    .mlp-home-schedule-section > .relative {
      padding-left: 0 !important;
    }
    .mlp-home-schedule-section > .relative > .absolute {
      display: none !important;
    }
    .mlp-home-schedule-section .relative.flex {
      gap: 20px !important;
      padding-bottom: 18px !important;
    }
    .mlp-home-date-chip {
      width: 58px !important;
      height: 58px !important;
      border-radius: 22px !important;
      color: rgba(106, 76, 47, 0.72) !important;
      background: rgba(244, 242, 229, 0.78) !important;
      box-shadow: 7px 7px 16px rgba(101, 89, 76, 0.1), -6px -6px 15px rgba(229, 226, 215, 0.62) !important;
    }
    .mlp-home-schedule-card {
      border-radius: 30px !important;
      padding: 24px 28px !important;
      background: rgba(244, 242, 229, 0.82) !important;
    }
    .mlp-home-schedule-card h4 {
      color: #6A4C2F !important;
      font-size: 21px !important;
      line-height: 1.25 !important;
    }
    .mlp-home-schedule-card button:first-of-type {
      max-width: 82px;
      margin-left: auto;
      border-radius: 999px !important;
      color: #5B6A39 !important;
      background: #CBD49B !important;
      box-shadow: none !important;
    }
    .mlp-home-link-card {
      position: relative;
      overflow: hidden;
      transition: transform 0.16s ease, box-shadow 0.16s ease;
    }
    .mlp-home-link-card:hover {
      transform: translateY(-2px);
      box-shadow:
        8px 8px 18px rgba(101, 89, 76, 0.12),
        -8px -8px 18px var(--mlp-shadow-light),
        inset 1px 1px 0 rgba(236, 232, 221, 0.28) !important;
    }
    .mlp-home-link-hint {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      align-self: flex-start;
      margin-top: 8px;
      border-radius: 999px;
      padding: 5px 8px;
      color: rgba(61, 76, 52, 0.78);
      background: rgba(203, 212, 155, 0.45);
      box-shadow: inset 1px 1px 3px rgba(94, 114, 85, 0.08), inset -1px -1px 3px rgba(255, 255, 247, 0.72);
      font-size: 10px;
      font-weight: 900;
      line-height: 1;
    }
    .mlp-home-link-hint .material-symbols-outlined {
      font-size: 14px;
    }
    body.mlp-sunflower-theme button:active {
      transform: scale(0.96);
    }
    body.mlp-sunflower-theme .bg-primary,
    body.mlp-sunflower-theme .bg-forest-green {
      background: linear-gradient(145deg, var(--mlp-leaf), #B7C8A4) !important;
    }
    body.mlp-sunflower-theme .bg-secondary-container,
    body.mlp-sunflower-theme .bg-\\[\\#FEC654\\],
    body.mlp-sunflower-theme .bg-\\[\\#fec654\\] {
      color: var(--mlp-seed) !important;
      background: linear-gradient(145deg, #E8D6D3, var(--mlp-rose)) !important;
      border-color: rgba(255, 255, 247, 0.72) !important;
      box-shadow:
        7px 7px 18px rgba(101, 89, 76, 0.14),
        -7px -7px 18px var(--mlp-shadow-light),
        inset 1px 1px 0 rgba(236, 232, 221, 0.28) !important;
    }
    body.mlp-sunflower-theme .bg-secondary-container\\/20,
    body.mlp-sunflower-theme .bg-tertiary-container\\/10,
    body.mlp-sunflower-theme .bg-tertiary-fixed,
    body.mlp-sunflower-theme .bg-tertiary-fixed\\/30,
    body.mlp-sunflower-theme .bg-tertiary-fixed\\/40 {
      background: rgba(216, 167, 160, 0.22) !important;
    }
    body.mlp-sunflower-theme .bg-surface-container,
    body.mlp-sunflower-theme .bg-surface-container-low,
    body.mlp-sunflower-theme .bg-surface-container-high {
      background: rgba(236, 231, 215, 0.8) !important;
    }
    body.mlp-sunflower-theme .text-primary,
    body.mlp-sunflower-theme .text-forest-green,
    body.mlp-sunflower-theme .text-dark-forest,
    body.mlp-sunflower-theme .text-charcoal,
    body.mlp-sunflower-theme .text-on-surface {
      color: var(--mlp-seed) !important;
    }
    body.mlp-sunflower-theme .text-on-surface-variant,
    body.mlp-sunflower-theme .text-charcoal\\/70 {
      color: rgba(95, 59, 24, 0.68) !important;
    }
    body.mlp-sunflower-theme .fixed.bottom-24,
    body.mlp-sunflower-theme button.fixed.bottom-24,
    body.mlp-sunflower-theme .fixed.right-6.bottom-24 {
      bottom: calc(var(--mlp-ios-home-indicator) + var(--mlp-ios-bottom-nav-height) + 22px) !important;
      box-shadow:
        8px 8px 18px rgba(116, 80, 12, 0.24),
        -8px -8px 18px var(--mlp-shadow-light-soft) !important;
    }
    body[data-mlp-route="expense"] footer,
    body[data-mlp-route="expense-alt"] footer {
      height: 260px !important;
      min-height: 260px;
      overflow: hidden;
      background: rgba(244, 242, 229, 0.92) !important;
      box-shadow: 0 -8px 22px rgba(101, 89, 76, 0.12) !important;
    }
    body[data-mlp-route="expense"] .fixed.top-16,
    body[data-mlp-route="expense-alt"] .fixed.top-16 {
      background: rgba(244, 242, 229, 0.72) !important;
      box-shadow: none !important;
    }
    body[data-mlp-route="expense"] .fixed.top-16 .inline-flex,
    body[data-mlp-route="expense-alt"] .fixed.top-16 .inline-flex {
      border: 0 !important;
      padding: 4px !important;
      background: rgba(244, 242, 229, 0.68) !important;
      box-shadow: inset 4px 4px 10px rgba(101, 89, 76, 0.09), inset -4px -4px 10px rgba(255, 255, 247, 0.7) !important;
    }
    body[data-mlp-route="expense"] .fixed.top-16 button,
    body[data-mlp-route="expense-alt"] .fixed.top-16 button {
      min-width: 78px;
      color: rgba(106, 76, 47, 0.76) !important;
      background: transparent !important;
      box-shadow: none !important;
    }
    body[data-mlp-route="expense"] .fixed.top-16 button[aria-pressed="true"],
    body[data-mlp-route="expense-alt"] .fixed.top-16 button[aria-pressed="true"] {
      color: #FFFFFF !important;
      background: #9DAF86 !important;
    }
    body[data-mlp-route="expense"] main,
    body[data-mlp-route="expense-alt"] main {
      padding-bottom: 278px !important;
    }
    body[data-mlp-route="expense"] main > section:first-of-type,
    body[data-mlp-route="expense-alt"] main > section:first-of-type {
      padding-top: 26px !important;
      padding-bottom: 26px !important;
    }
    body[data-mlp-route="expense"] main > section:first-of-type .text-\\[40px\\],
    body[data-mlp-route="expense-alt"] main > section:first-of-type .text-\\[40px\\] {
      color: #7C8E5C !important;
      font-size: 34px !important;
      line-height: 1.05 !important;
    }
    body[data-mlp-route="expense"] main > section:nth-of-type(2) .grid.grid-cols-4,
    body[data-mlp-route="expense-alt"] main > section:nth-of-type(2) .grid.grid-cols-4 {
      gap: 12px !important;
    }
    body[data-mlp-route="expense"] main > section:nth-of-type(2) .grid.grid-cols-4 > div,
    body[data-mlp-route="expense-alt"] main > section:nth-of-type(2) .grid.grid-cols-4 > div {
      border: 1px solid rgba(255, 255, 247, 0.48) !important;
      border-radius: 18px !important;
      background: rgba(244, 242, 229, 0.74) !important;
      box-shadow: 5px 5px 13px rgba(101, 89, 76, 0.08), -5px -5px 13px rgba(229, 226, 215, 0.58) !important;
    }
    body[data-mlp-route="expense"] main > section:nth-of-type(2) .grid.grid-cols-4 > div:first-child > div,
    body[data-mlp-route="expense-alt"] main > section:nth-of-type(2) .grid.grid-cols-4 > div:first-child > div {
      background: #CBD49B !important;
    }
    body[data-mlp-route="expense"] footer > .px-6,
    body[data-mlp-route="expense-alt"] footer > .px-6 {
      padding-top: 12px !important;
    }
    body[data-mlp-route="expense"] footer .grid.grid-cols-4,
    body[data-mlp-route="expense-alt"] footer .grid.grid-cols-4 {
      gap: 2px 8px !important;
      padding: 6px 30px 2px !important;
    }
    body[data-mlp-route="expense"] footer .grid.grid-cols-4 button,
    body[data-mlp-route="expense-alt"] footer .grid.grid-cols-4 button {
      min-height: 22px;
      border-radius: 12px !important;
      box-shadow: none !important;
    }
    body[data-mlp-route="expense"] footer .grid.grid-cols-4 button.col-span-2,
    body[data-mlp-route="expense-alt"] footer .grid.grid-cols-4 button.col-span-2,
    body[data-mlp-route="home"] main button:not(.mlp-home-link-card),
    body[data-mlp-route="calendar"] main button:not(.mlp-calendar-create-module) {
      border: 0 !important;
      color: #FFFFFF !important;
      background: #9DAF86 !important;
      box-shadow: inset 1px 1px 0 rgba(255, 255, 247, 0.26), 4px 4px 10px rgba(101, 89, 76, 0.1) !important;
    }
    body[data-mlp-route="home"] main button:not(.mlp-home-link-card):hover,
    body[data-mlp-route="calendar"] main button:not(.mlp-calendar-create-module):hover {
      filter: saturate(1.08) brightness(1.02);
    }
    .mlp-book-chip {
      position: relative;
      display: inline-grid;
      grid-template-rows: auto auto;
      justify-items: center;
      align-items: center;
      gap: 7px;
      flex: 0 0 auto;
      border: 1px solid rgba(255, 255, 255, 0.68);
      border-radius: 20px;
      padding: 12px 15px;
      min-width: 88px;
      min-height: 88px;
      color: rgba(95, 59, 24, 0.76);
      background: rgba(244, 242, 229, 0.78);
      box-shadow:
        7px 8px 16px rgba(101, 89, 76, 0.1),
        -6px -6px 14px rgba(255, 255, 247, 0.62),
        inset 1px 1px 0 rgba(255, 255, 247, 0.62);
      font-size: 12px;
      font-weight: 900;
      white-space: nowrap;
    }
    .mlp-book-chip.is-active {
      color: var(--mlp-leaf-deep);
      border-color: rgba(63, 83, 38, 0.38);
      background: linear-gradient(145deg, rgba(203, 212, 155, 0.68), rgba(244, 242, 229, 0.84));
      box-shadow:
        inset 3px 3px 8px rgba(63, 83, 38, 0.1),
        inset -3px -3px 8px rgba(255, 255, 247, 0.64),
        4px 5px 12px rgba(101, 89, 76, 0.08);
    }
    .mlp-book-chip .material-symbols-outlined {
      width: 40px;
      height: 40px;
      display: grid;
      place-items: center;
      border-radius: 999px;
      color: #fff;
      background: var(--mlp-leaf);
      font-size: 20px;
      box-shadow:
        inset 1px 1px 0 rgba(255, 255, 247, 0.42),
        3px 4px 9px rgba(63, 83, 38, 0.16);
    }
    .mlp-book-chip:nth-child(2) .material-symbols-outlined {
      background: #F3A529;
    }
    .mlp-book-chip:nth-child(3) .material-symbols-outlined {
      background: #DCA2A0;
    }
    .mlp-account-book-section .overflow-x-auto,
    .mlp-account-book-section .flex.gap-3 {
      gap: 14px !important;
    }
    .mlp-account-book-section button:not(.mlp-book-delete) {
      border-color: rgba(255, 255, 247, 0.68) !important;
      color: rgba(95, 59, 24, 0.76) !important;
      background: rgba(244, 242, 229, 0.78) !important;
      box-shadow:
        7px 8px 16px rgba(101, 89, 76, 0.1),
        -6px -6px 14px rgba(255, 255, 247, 0.62),
        inset 1px 1px 0 rgba(255, 255, 247, 0.62) !important;
    }
    .mlp-account-book-section button:not(.mlp-book-delete) > div {
      background: var(--mlp-leaf) !important;
      color: #fff !important;
    }
    .mlp-account-book-section button:not(.mlp-book-delete):nth-child(2) > div {
      background: #F3A529 !important;
    }
    .mlp-account-book-section button:not(.mlp-book-delete):nth-child(3) > div {
      background: #DCA2A0 !important;
    }
    .mlp-book-delete {
      position: absolute;
      top: -6px;
      right: -6px;
      width: 18px;
      height: 18px;
      display: grid;
      place-items: center;
      border-radius: 999px;
      color: #fff;
      background: var(--mlp-rose-deep);
      box-shadow: 0 3px 8px rgba(112, 56, 36, 0.22);
      font-size: 13px;
      line-height: 1;
      font-weight: 900;
    }
    .mlp-calendar-card {
      margin: 0 12px 16px;
      padding: 16px 12px !important;
      border: 1px solid rgba(255, 255, 255, 0.72) !important;
      border-radius: 28px;
      background: rgba(244, 242, 229, 0.82) !important;
      box-shadow: 5px 5px 16px rgba(126, 100, 35, 0.09) !important;
      box-shadow:
        10px 10px 24px rgba(101, 89, 76, 0.1),
        -8px -8px 20px rgba(229, 226, 215, 0.58) !important;
      backdrop-filter: blur(16px) saturate(1.08);
      overflow: hidden;
    }
    .mlp-calendar-card > .flex:first-child {
      margin-bottom: 12px !important;
    }
    .mlp-calendar-card h2 {
      color: var(--mlp-leaf-deep) !important;
      font-size: 20px !important;
    }
    .mlp-calendar-card .grid.grid-cols-7 > .text-center {
      padding-bottom: 6px !important;
      color: rgba(91, 81, 71, 0.7);
    }
    .mlp-calendar-grid {
      gap: 8px !important;
      align-items: stretch;
    }
    .mlp-day-cell {
      position: relative;
      aspect-ratio: auto !important;
      min-height: 48px !important;
      border-radius: 18px !important;
      padding: 10px 4px !important;
      align-items: center !important;
      text-align: center;
      background: rgba(248, 245, 235, 0.64) !important;
      border: 1px solid rgba(255, 255, 255, 0.64) !important;
      box-shadow: 4px 4px 10px rgba(126, 100, 35, 0.06), -4px -4px 10px rgba(229, 226, 215, 0.46) !important;
    }
    .mlp-day-cell span:first-child {
      width: 100%;
      text-align: center;
    }
    .mlp-day-cell.is-muted {
      opacity: 0.58;
    }
    .mlp-day-cell.is-today {
      border-color: rgba(79, 125, 58, 0.45) !important;
      background: linear-gradient(180deg, rgba(232, 214, 211, 0.86), rgba(244, 242, 229, 0.82)) !important;
      box-shadow: inset 0 0 0 1px rgba(79, 125, 58, 0.18), 3px 3px 10px rgba(126, 100, 35, 0.08) !important;
    }
    .mlp-day-cell.has-event::after {
      content: "";
      position: absolute;
      right: 8px;
      top: 8px;
      width: 6px;
      height: 6px;
      border-radius: 999px;
      background: var(--mlp-leaf);
    }
    .mlp-calendar-card-footer {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      margin-top: 12px;
      padding: 10px 12px;
      border-radius: 18px;
      color: rgba(95, 59, 24, 0.68);
      background: rgba(232, 214, 211, 0.54);
      box-shadow: inset 2px 2px 6px rgba(126, 100, 35, 0.06);
      font-size: 12px;
      font-weight: 800;
    }
    .mlp-finance-dashboard {
      display: grid;
      gap: 16px;
      margin-top: 6px;
    }
    .mlp-finance-hero,
    .mlp-finance-card,
    .mlp-list-tabs {
      border: 1px solid var(--mlp-border);
      background: var(--mlp-glass-strong);
      box-shadow:
        7px 7px 18px var(--mlp-shadow-dark),
        -7px -7px 18px var(--mlp-shadow-light),
        inset 1px 1px 0 rgba(255, 255, 247, 0.24);
      backdrop-filter: blur(16px) saturate(1.12);
    }
    .mlp-finance-hero {
      overflow: hidden;
      border-radius: 28px;
      padding: 20px;
    }
    .mlp-finance-hero h3,
    .mlp-finance-card h4 {
      margin: 0;
      color: var(--mlp-seed);
      font-weight: 900;
    }
    .mlp-finance-balance {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-top: 16px;
    }
    .mlp-finance-pill {
      border-radius: 20px;
      padding: 14px;
      background: rgba(244, 242, 229, 0.78);
      box-shadow: inset 2px 2px 7px rgba(132, 93, 20, 0.08), inset -2px -2px 7px rgba(255, 255, 255, 0.72);
    }
    .mlp-finance-pill span,
    .mlp-finance-row span,
    .mlp-chart-label {
      color: rgba(95, 59, 24, 0.62);
      font-size: 11px;
      font-weight: 800;
    }
    .mlp-finance-pill strong {
      display: block;
      color: var(--mlp-seed);
      font-size: 20px;
      line-height: 1.25;
      margin-top: 4px;
    }
    .mlp-finance-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }
    .mlp-finance-card {
      border-radius: 24px;
      padding: 16px;
    }
    .mlp-donut {
      --income-angle: 50%;
      width: 132px;
      aspect-ratio: 1;
      margin: 14px auto;
      border-radius: 50%;
      background: conic-gradient(var(--mlp-leaf) 0 var(--income-angle), var(--mlp-rose-deep) var(--income-angle) 100%);
      box-shadow: 5px 5px 14px rgba(104, 68, 10, 0.12), -5px -5px 14px rgba(255, 255, 255, 0.68);
      position: relative;
    }
    .mlp-donut::after {
      content: "";
      position: absolute;
      inset: 28px;
      border-radius: 50%;
      background: #F4F2E5;
      box-shadow: inset 3px 3px 9px rgba(108, 76, 18, 0.08), inset -3px -3px 9px rgba(255, 255, 255, 0.78);
    }
    .mlp-bars {
      display: grid;
      gap: 10px;
      margin-top: 14px;
    }
    .mlp-bar {
      display: grid;
      gap: 5px;
    }
    .mlp-bar-track {
      height: 12px;
      border-radius: 999px;
      background: rgba(122, 91, 22, 0.08);
      box-shadow: inset 2px 2px 6px rgba(102, 75, 19, 0.1), inset -2px -2px 6px rgba(255, 255, 255, 0.72);
      overflow: hidden;
    }
    .mlp-bar-fill {
      height: 100%;
      width: var(--bar, 8%);
      border-radius: inherit;
      background: linear-gradient(90deg, var(--mlp-rose), var(--mlp-rose-deep));
    }
    .mlp-finance-list {
      display: grid;
      gap: 10px;
      margin-top: 12px;
    }
    .mlp-finance-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      border-radius: 18px;
      padding: 12px;
      background: rgba(244, 242, 229, 0.72);
      box-shadow: inset 2px 2px 7px rgba(112, 80, 15, 0.08), inset -2px -2px 7px rgba(255, 255, 255, 0.72);
    }
    .mlp-finance-row strong {
      white-space: nowrap;
      color: var(--mlp-leaf-deep);
    }
    .mlp-finance-row.is-expense strong {
      color: #A95C24;
    }
    .mlp-finance-ai,
    .mlp-accounting-draft {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      border: 1px solid rgba(255, 255, 247, 0.5);
      border-radius: 24px;
      padding: 16px;
      background: rgba(244, 242, 229, 0.82);
      box-shadow: 4px 4px 12px rgba(126, 100, 35, 0.08);
      backdrop-filter: blur(14px) saturate(1.08);
    }
    .mlp-finance-ai h4,
    .mlp-accounting-draft h3 {
      margin: 0;
      color: var(--mlp-seed);
      font-size: 16px;
      font-weight: 900;
    }
    .mlp-finance-ai p {
      margin: 6px 0 0;
      color: rgba(95, 59, 24, 0.72);
      font-size: 13px;
      line-height: 1.55;
    }
    .mlp-ai-orb {
      width: 38px;
      height: 38px;
      display: grid;
      place-items: center;
      flex: 0 0 auto;
      border-radius: 16px;
      color: #fff;
      background: linear-gradient(145deg, var(--mlp-leaf), #B7C8A4);
      box-shadow: 4px 4px 10px rgba(63, 83, 38, 0.14), -4px -4px 10px rgba(255, 255, 255, 0.58);
    }
    .mlp-accounting-draft {
      display: grid;
      gap: 10px;
    }
    .mlp-accounting-draft-inline {
      margin-top: 0;
      padding: 0;
      border: 0;
      border-radius: 0;
      gap: 7px;
      background: transparent;
      box-shadow: none;
      backdrop-filter: none;
    }
    .mlp-accounting-draft > .flex span {
      color: rgba(95, 59, 24, 0.56);
      font-size: 12px;
      font-weight: 800;
    }
    .mlp-accounting-draft-inline h3 {
      font-size: 12px;
    }
    .mlp-accounting-draft-inline > .flex span {
      font-size: 10px;
    }
    .mlp-draft-inline-grid {
      display: grid;
      grid-template-columns: 0.86fr 1.14fr;
      gap: 7px;
    }
    .mlp-draft-field {
      display: grid;
      gap: 4px;
      border-radius: 16px;
      padding: 11px 12px;
      background: rgba(244, 242, 229, 0.78);
      box-shadow: inset 2px 2px 7px rgba(112, 80, 15, 0.07);
    }
    .mlp-draft-field label {
      color: rgba(95, 59, 24, 0.72);
      font-size: 11px;
      font-weight: 900;
    }
    .mlp-draft-field strong,
    .mlp-draft-field p {
      margin: 0;
      color: rgba(95, 59, 24, 0.76);
      font-size: 15px;
      font-weight: 800;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .mlp-accounting-draft-inline .mlp-draft-field {
      border-radius: 14px;
      padding: 7px 14px;
    }
    .mlp-accounting-draft-inline .mlp-draft-field strong,
    .mlp-accounting-draft-inline .mlp-draft-field p {
      font-size: 12px;
    }
    .mlp-accounting-draft-inline .mlp-draft-amount strong {
      font-size: 20px;
      line-height: 1.15;
      color: rgba(95, 59, 24, 0.76);
    }
    .mlp-accounting-draft-inline .mlp-draft-note p {
      font-size: 12px;
      color: rgba(95, 59, 24, 0.76);
    }
    .mlp-draft-tip {
      margin: 0;
      color: rgba(95, 59, 24, 0.58);
      font-size: 12px;
      line-height: 1.45;
    }
    .mlp-accounting-draft-inline .mlp-draft-tip {
      font-size: 9px;
      line-height: 1.15;
    }
    .mlp-draft-label {
      color: rgba(95, 59, 24, 0.72);
      font-size: 12px;
      font-weight: 800;
      line-height: 1;
    }
    .mlp-draft-note-row {
      display: grid;
      grid-template-columns: 1fr 31px;
      align-items: center;
      gap: 8px;
      border-radius: 16px;
      padding: 5px 6px 5px 14px;
      background: rgba(244, 242, 229, 0.78);
      box-shadow: inset 2px 2px 7px rgba(112, 80, 15, 0.07);
    }
    .mlp-draft-note-row input {
      min-width: 0;
      border: 0 !important;
      padding: 0 !important;
      color: rgba(95, 59, 24, 0.76) !important;
      background: transparent !important;
      box-shadow: none !important;
      font-size: 12px !important;
      outline: none !important;
    }
    .mlp-draft-note-row input::placeholder {
      color: rgba(95, 59, 24, 0.4);
    }
    .mlp-draft-note-action {
      width: 28px;
      height: 28px;
      display: grid;
      place-items: center;
      border: 0;
      border-radius: 999px;
      color: #fff;
      background: var(--mlp-leaf);
      box-shadow: none;
    }
    .mlp-draft-note-action .material-symbols-outlined {
      font-size: 17px;
    }
    .mlp-accounting-details .space-y-2 {
      display: grid;
      gap: 10px;
    }
    .mlp-accounting-row {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: 12px;
      border: 1px solid rgba(255, 255, 247, 0.64);
      border-radius: 20px;
      padding: 12px;
      background: rgba(244, 242, 229, 0.78);
      box-shadow:
        7px 8px 18px rgba(101, 89, 76, 0.09),
        -6px -6px 16px rgba(255, 255, 247, 0.58),
        inset 1px 1px 0 rgba(255, 255, 247, 0.56);
    }
    .mlp-accounting-row-icon {
      width: 38px;
      height: 38px;
      display: grid;
      place-items: center;
      border-radius: 15px;
      color: #fff;
      background: linear-gradient(145deg, var(--mlp-leaf), #CBD49B);
      box-shadow: inset 1px 1px 0 rgba(255, 255, 247, 0.36), 4px 5px 10px rgba(63, 83, 38, 0.12);
    }
    .mlp-accounting-row-icon .material-symbols-outlined {
      font-size: 19px;
    }
    .mlp-accounting-row-copy {
      min-width: 0;
    }
    .mlp-accounting-row-amount {
      color: var(--mlp-leaf-deep);
      font-size: 16px;
      font-weight: 950;
      white-space: nowrap;
    }
    .mlp-calendar-create-module {
      width: 100%;
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: 12px;
      border: 1px solid rgba(255, 255, 255, 0.72);
      border-radius: 24px;
      padding: 14px 15px;
      color: var(--mlp-seed);
      background: rgba(232, 214, 211, 0.62);
      box-shadow: 8px 8px 18px rgba(101, 89, 76, 0.1), -6px -6px 16px rgba(229, 226, 215, 0.54);
      text-align: left;
      backdrop-filter: blur(14px) saturate(1.08);
    }
    .mlp-calendar-create-module > .material-symbols-outlined:first-child {
      width: 38px;
      height: 38px;
      display: grid;
      place-items: center;
      border-radius: 15px;
      color: #fff;
      background: #DCA2A0;
      box-shadow: none;
    }
    .mlp-calendar-create-module strong {
      display: block;
      font-size: 15px;
      font-weight: 900;
    }
    .mlp-calendar-create-module p {
      margin: 2px 0 0;
      color: rgba(95, 59, 24, 0.6);
      font-size: 12px;
      line-height: 1.35;
    }
    body[data-mlp-route="calendar"] .fixed.right-6.bottom-24,
    body[data-mlp-route="calendar"] .fixed.bottom-24 {
      display: none !important;
    }
    body[data-mlp-route="calendar"] .mlp-calendar-grid-clean .mlp-weekday-label {
      aspect-ratio: auto !important;
      min-height: 22px !important;
      border: 0 !important;
      border-radius: 0 !important;
      padding: 0 0 8px !important;
      background: transparent !important;
      box-shadow: none !important;
    }
    body[data-mlp-route="calendar"] .mlp-calendar-grid-clean .mlp-weekday-label span {
      display: inline !important;
      border: 0 !important;
      background: transparent !important;
      color: rgba(95, 59, 24, 0.58) !important;
      font-weight: 900 !important;
    }
    body[data-mlp-route="calendar"] .mlp-calendar-grid-clean .mlp-calendar-day-cell {
      border-color: rgba(203, 212, 155, 0.3) !important;
      background: rgba(244, 242, 229, 0.66) !important;
      box-shadow: inset 2px 2px 5px rgba(101, 89, 76, 0.05), inset -2px -2px 5px rgba(255, 255, 247, 0.5) !important;
    }
    .mlp-timeline-motion .flex.gap-md.relative,
    .mlp-timeline-motion [data-mlp-timeline-item] {
      transition: transform 0.22s ease, filter 0.22s ease;
    }
    .mlp-timeline-motion .flex.gap-md.relative:hover,
    .mlp-timeline-motion [data-mlp-timeline-item]:hover {
      transform: translateX(4px);
      filter: saturate(1.08);
    }
    .mlp-timeline-motion .w-3.h-3.rounded-full {
      animation: mlpTimelinePulse 2.4s ease-in-out infinite;
    }
    @keyframes mlpTimelinePulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(244, 197, 66, 0.42); }
      50% { box-shadow: 0 0 0 7px rgba(244, 197, 66, 0); }
    }
    .mlp-list-tabs {
      display: flex;
      gap: 4px;
      align-items: center;
      overflow-x: auto;
      scrollbar-width: none;
      border-radius: 999px;
      padding: 5px;
      margin-bottom: 18px;
    }
    .mlp-list-tabs::-webkit-scrollbar {
      display: none;
    }
    .mlp-list-tab,
    .mlp-new-list-button {
      position: relative;
      flex: 0 0 auto;
      border: 0;
      border-radius: 999px;
      padding: 8px 9px;
      color: rgba(95, 59, 24, 0.74);
      background: transparent;
      font-size: 12px;
      font-weight: 900;
      box-shadow: none;
    }
    .mlp-list-tab.is-active {
      color: #FFFFFF;
      background: linear-gradient(145deg, var(--mlp-leaf), #B7C8A4);
      box-shadow: 3px 3px 9px rgba(63, 83, 38, 0.12), inset 1px 1px 0 rgba(255, 255, 255, 0.2);
    }
    .mlp-list-tab-delete {
      position: absolute;
      top: -7px;
      right: -4px;
      width: 18px;
      height: 18px;
      display: grid;
      place-items: center;
      border-radius: 999px;
      color: #fff;
      background: var(--mlp-rose-deep);
      box-shadow: 0 3px 8px rgba(112, 56, 36, 0.22);
      font-size: 13px;
      line-height: 1;
      font-weight: 900;
    }
    .mlp-new-list-button {
      color: var(--mlp-leaf-deep);
      background: rgba(255, 248, 206, 0.72);
      box-shadow: inset 2px 2px 6px rgba(117, 83, 12, 0.08), inset -2px -2px 6px rgba(255, 255, 255, 0.72);
    }
    .mlp-task-root {
      display: grid;
      gap: 12px;
    }
    .mlp-task-highlight-card {
      border-radius: 24px !important;
      border: 1px solid rgba(255, 255, 247, 0.62) !important;
      background:
        radial-gradient(circle at 12% 10%, rgba(255, 252, 235, 0.76), transparent 34%),
        linear-gradient(145deg, rgba(203, 212, 155, 0.62), rgba(244, 242, 229, 0.78)) !important;
      box-shadow:
        10px 12px 24px rgba(101, 89, 76, 0.12),
        -8px -8px 18px rgba(255, 255, 247, 0.62),
        inset 1px 1px 0 rgba(255, 255, 247, 0.66) !important;
      transition: transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease;
    }
    .mlp-task-highlight-card.is-shopping {
      border-color: rgba(220, 162, 160, 0.46) !important;
      background:
        radial-gradient(circle at 12% 10%, rgba(255, 252, 235, 0.7), transparent 34%),
        linear-gradient(145deg, rgba(232, 214, 211, 0.66), rgba(244, 242, 229, 0.78)) !important;
    }
    .mlp-task-highlight-card:hover {
      transform: translateY(-2px);
      filter: saturate(1.04);
    }
    .mlp-task-highlight-card .material-symbols-outlined {
      color: #6A4C2F !important;
    }
    .mlp-task-highlight-card div {
      color: #6A4C2F !important;
    }
    .mlp-task-highlight-card div:last-child {
      color: #321808 !important;
    }
    .mlp-highlight-list {
      display: grid;
      gap: 10px;
      margin-top: 14px;
    }
    .mlp-highlight-list article {
      display: grid;
      gap: 5px;
      border-radius: 18px;
      padding: 13px 14px;
      border: 1px solid rgba(255, 255, 247, 0.5);
      background: rgba(244, 242, 229, 0.78);
      box-shadow:
        6px 6px 14px rgba(101, 89, 76, 0.09),
        -5px -5px 12px rgba(255, 255, 247, 0.66);
    }
    .mlp-highlight-list article strong {
      color: var(--mlp-seed);
      font-size: 14px;
      font-weight: 900;
    }
    .mlp-highlight-list article span {
      color: rgba(95, 59, 24, 0.6);
      font-size: 12px;
      font-weight: 700;
    }
    .mlp-task-accordion {
      overflow: hidden;
      border-radius: 0;
      background: transparent !important;
      box-shadow: none !important;
      border: 0 !important;
    }
    .mlp-task-accordion > button {
      width: 100%;
      border: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 4px;
      color: var(--mlp-seed);
      background: transparent;
      font-weight: 900;
      text-align: left;
    }
    .mlp-task-accordion > button .material-symbols-outlined {
      transition: transform 0.22s ease;
    }
    .mlp-task-accordion.is-open > button .material-symbols-outlined {
      transform: rotate(180deg);
    }
    .mlp-task-panel .material-symbols-outlined {
      transform: none !important;
    }
    .mlp-task-panel {
      display: grid;
      gap: 10px;
      max-height: 0;
      overflow: hidden;
      padding: 0 12px;
      transition: max-height 0.28s ease, padding 0.28s ease;
    }
    .mlp-task-accordion.is-open .mlp-task-panel {
      max-height: 680px;
      padding: 0 0 10px;
    }
    .mlp-task-card {
      border: 1px solid rgba(255, 255, 255, 0.55) !important;
      border-radius: 18px !important;
      background: rgba(244, 242, 229, 0.76) !important;
      box-shadow: 4px 4px 12px rgba(126, 100, 35, 0.08), -4px -4px 12px rgba(255, 255, 255, 0.64) !important;
    }
    .mlp-task-card.is-done {
      border-color: rgba(94, 114, 85, 0.18) !important;
      background: rgba(238, 240, 212, 0.64) !important;
    }
    .mlp-check-button {
      width: 24px;
      height: 24px;
      display: grid;
      place-items: center;
      flex: 0 0 auto;
      border: 2px solid var(--mlp-leaf);
      border-radius: 8px;
      color: transparent;
      background: transparent;
      box-shadow: none;
    }
    .mlp-check-button .material-symbols-outlined {
      color: transparent !important;
      font-size: 18px;
      line-height: 1;
    }
    .mlp-check-button.is-done {
      border-color: transparent;
      color: #fff;
      background: linear-gradient(145deg, var(--mlp-leaf), #B7C8A4);
      box-shadow: inset 1px 1px 0 rgba(255, 255, 255, 0.18);
    }
    .mlp-check-button.is-done .material-symbols-outlined {
      color: #fff !important;
    }
    .mlp-task-status-pill {
      flex: 0 0 auto;
      border-radius: 999px;
      padding: 4px 9px;
      color: var(--mlp-leaf-deep);
      background: rgba(203, 212, 155, 0.38);
      box-shadow: inset 1px 1px 3px rgba(94, 114, 85, 0.08), inset -1px -1px 3px rgba(255, 255, 247, 0.72);
      font-size: 10px;
      font-weight: 900;
      white-space: nowrap;
    }
    .mlp-task-status-pill.is-done {
      color: rgba(91, 81, 71, 0.62);
      background: rgba(232, 214, 211, 0.52);
    }
    .mlp-empty-state {
      border-radius: 18px;
      padding: 14px;
      color: rgba(95, 59, 24, 0.62);
      background: rgba(232, 214, 211, 0.42);
      text-align: center;
      font-size: 13px;
      font-weight: 700;
    }
    .mlp-modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 999;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      padding: calc(var(--mlp-ios-safe-top) + 12px) 14px calc(var(--mlp-ios-home-indicator) + 14px);
      background: rgba(91, 81, 71, 0.16);
      backdrop-filter: blur(18px) saturate(1.18);
    }
    .mlp-modal {
      width: min(100%, calc(var(--mlp-ios-width) - 28px));
      max-height: calc(100dvh - var(--mlp-ios-safe-top) - var(--mlp-ios-home-indicator) - 28px);
      overflow-y: auto;
      overscroll-behavior: contain;
      border: 1px solid rgba(255, 255, 247, 0.46);
      border-radius: 28px;
      padding: 20px;
      color: var(--mlp-seed);
      background: linear-gradient(145deg, rgba(244, 242, 229, 0.56), rgba(232, 214, 211, 0.38));
      box-shadow: 0 18px 38px rgba(91, 81, 71, 0.18);
      backdrop-filter: blur(26px) saturate(1.36);
      -webkit-backdrop-filter: blur(26px) saturate(1.36);
      font-family: Manrope, "Microsoft YaHei", sans-serif;
    }
    .mlp-modal.is-calendar {
      border: 1px solid rgba(255, 255, 247, 0.44);
      background: linear-gradient(145deg, rgba(232, 214, 211, 0.58), rgba(244, 242, 229, 0.36));
      box-shadow: 0 18px 38px rgba(91, 81, 71, 0.18);
    }
    .mlp-wheel-field {
      position: relative;
      display: grid !important;
      gap: 9px;
      min-width: 0;
      color: rgba(95, 59, 24, 0.72);
      font-size: 12px;
      font-weight: 900;
    }
    .mlp-wheel-label {
      display: block !important;
      color: rgba(95, 59, 24, 0.72) !important;
      font-size: 12px !important;
      font-weight: 900 !important;
      line-height: 1 !important;
    }
    .mlp-picker-trigger {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      gap: 10px !important;
      width: 100% !important;
      min-height: 74px !important;
      border: 1px solid rgba(255, 255, 247, 0.64) !important;
      border-radius: 16px !important;
      padding: 0 14px !important;
      color: rgba(95, 59, 24, 0.78) !important;
      background: rgba(244, 242, 229, 0.48) !important;
      box-shadow:
        inset 3px 3px 9px rgba(101, 89, 76, 0.08),
        inset -3px -3px 9px rgba(255, 255, 247, 0.44) !important;
      text-align: left !important;
      font-size: 15px !important;
      font-weight: 900 !important;
      backdrop-filter: blur(18px) saturate(1.16);
      -webkit-backdrop-filter: blur(18px) saturate(1.16);
    }
    .mlp-picker-trigger .material-symbols-outlined {
      color: rgba(35, 31, 28, 0.86) !important;
      font-size: 19px !important;
      line-height: 1 !important;
    }
    .mlp-picker-input-trigger {
      color: rgba(95, 59, 24, 0.38) !important;
      font-weight: 800 !important;
    }
    .mlp-picker-input-trigger.has-value {
      color: rgba(95, 59, 24, 0.78) !important;
      font-weight: 900 !important;
    }
    .mlp-plain-field {
      display: grid;
      gap: 6px;
      min-width: 0;
    }
    .mlp-modal .mlp-modal-input {
      width: 100% !important;
      min-height: 48px !important;
      border: 1px solid rgba(255, 255, 247, 0.64) !important;
      border-radius: 16px !important;
      padding: 0 14px !important;
      color: rgba(95, 59, 24, 0.78) !important;
      background: rgba(244, 242, 229, 0.52) !important;
      box-shadow:
        inset 3px 3px 9px rgba(101, 89, 76, 0.08),
        inset -3px -3px 9px rgba(255, 255, 247, 0.44) !important;
      font-size: 15px !important;
      font-weight: 900 !important;
      backdrop-filter: blur(18px) saturate(1.16);
      -webkit-backdrop-filter: blur(18px) saturate(1.16);
    }
    .mlp-modal .mlp-modal-input::placeholder {
      color: rgba(95, 59, 24, 0.36) !important;
      font-weight: 800 !important;
    }
    .mlp-picker-panel {
      display: none !important;
      position: absolute;
      left: 0;
      right: 0;
      top: calc(100% + 4px);
      z-index: 60;
      border: 1px solid rgba(255, 255, 247, 0.62);
      border-radius: 18px;
      padding: 7px;
      background: linear-gradient(145deg, rgba(244, 242, 229, 0.76), rgba(232, 214, 211, 0.56));
      box-shadow: 0 18px 34px rgba(91, 81, 71, 0.18), inset 1px 1px 0 rgba(255, 255, 247, 0.48);
      backdrop-filter: blur(24px) saturate(1.28);
      -webkit-backdrop-filter: blur(24px) saturate(1.28);
    }
    .mlp-wheel-field.is-open .mlp-picker-panel,
    .mlp-modal-choice-field.is-open .mlp-picker-panel {
      display: block !important;
    }
    .mlp-wheel-shell {
      position: relative;
      display: grid !important;
      grid-auto-flow: column !important;
      grid-auto-columns: minmax(0, 1fr) !important;
      gap: 6px;
      border: 1px solid rgba(255, 255, 247, 0.52);
      border-radius: 18px;
      padding: 7px;
      background: rgba(244, 242, 229, 0.42);
      box-shadow:
        inset 3px 3px 9px rgba(101, 89, 76, 0.08),
        inset -3px -3px 9px rgba(255, 255, 247, 0.42);
      backdrop-filter: blur(20px) saturate(1.18);
      -webkit-backdrop-filter: blur(20px) saturate(1.18);
    }
    .mlp-wheel-column {
      max-height: 104px !important;
      overflow-y: auto !important;
      display: grid !important;
      gap: 5px;
      padding: 34px 0;
      scroll-snap-type: y mandatory;
      scrollbar-width: none;
      mask-image: linear-gradient(to bottom, transparent, black 26%, black 74%, transparent);
    }
    .mlp-wheel-column::-webkit-scrollbar {
      display: none;
    }
    .mlp-wheel-column button {
      display: block !important;
      width: 100% !important;
      height: 30px !important;
      border: 0 !important;
      border-radius: 12px !important;
      padding: 0 !important;
      color: rgba(95, 59, 24, 0.52) !important;
      background: transparent !important;
      scroll-snap-align: center !important;
      font-size: 12px !important;
      font-weight: 900 !important;
      transition: transform 0.16s ease, background 0.16s ease, color 0.16s ease;
    }
    .mlp-wheel-column button small {
      margin-left: 1px;
      font-size: 9px;
      opacity: 0.68;
    }
    .mlp-wheel-column button.is-selected {
      color: var(--mlp-seed);
      background: rgba(203, 212, 155, 0.45);
      box-shadow: inset 1px 1px 4px rgba(63, 83, 38, 0.08), inset -1px -1px 4px rgba(255, 255, 247, 0.58);
      transform: scale(1.02);
    }
    .mlp-modal-choice-field {
      position: relative;
      display: grid;
      gap: 9px;
      min-width: 0;
    }
    .mlp-modal-choice-grid {
      display: grid !important;
      grid-template-columns: 1fr !important;
      grid-auto-flow: row !important;
      gap: 0 !important;
      overflow: hidden;
      border-radius: 13px;
      background: rgba(255, 255, 247, 0.42);
    }
    .mlp-modal-choice {
      display: block !important;
      width: 100% !important;
      min-height: 44px !important;
      border: 0 !important;
      border-radius: 0 !important;
      padding: 0 16px !important;
      color: rgba(95, 59, 24, 0.72) !important;
      background: transparent !important;
      text-align: left !important;
      font-size: 15px !important;
      font-weight: 900 !important;
      box-shadow: none !important;
    }
    .mlp-modal-choice.is-selected {
      color: #5B6B42;
      background: linear-gradient(145deg, rgba(203, 212, 155, 0.76), rgba(244, 242, 229, 0.68));
      box-shadow: inset 2px 2px 6px rgba(63, 83, 38, 0.08), inset -2px -2px 6px rgba(255, 255, 247, 0.58);
    }
    .mlp-modal.is-calendar .mlp-modal-choice.is-selected {
      color: #7A5956;
      background: linear-gradient(145deg, rgba(232, 214, 211, 0.86), rgba(244, 242, 229, 0.72));
    }
    .mlp-neumo-modal-backdrop {
      background: rgba(244, 242, 229, 0.46);
      backdrop-filter: blur(8px) saturate(1.04);
      -webkit-backdrop-filter: blur(8px) saturate(1.04);
    }
    .mlp-modal.mlp-task-highlight-modal {
      border: 1px solid rgba(255, 255, 247, 0.64);
      background:
        radial-gradient(circle at 18% 0%, rgba(203, 212, 155, 0.2), transparent 34%),
        linear-gradient(145deg, rgba(244, 242, 229, 0.96), rgba(232, 230, 213, 0.94));
      box-shadow:
        14px 14px 30px rgba(101, 89, 76, 0.14),
        -10px -10px 24px rgba(229, 226, 215, 0.76),
        inset 1px 1px 0 rgba(255, 255, 247, 0.56);
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
    }
    .mlp-modal.mlp-task-highlight-modal h2 {
      color: #6A4C2F;
      font-size: 24px;
      font-weight: 900;
    }
    .mlp-modal.mlp-task-highlight-modal p {
      color: rgba(106, 76, 47, 0.62);
      line-height: 1.45;
    }
    .mlp-task-highlight-modal .mlp-modal-actions {
      padding-top: 14px;
    }
    .mlp-task-highlight-modal .mlp-primary {
      color: #FFFFFF;
      background: #9DAF86;
      box-shadow:
        5px 5px 12px rgba(101, 89, 76, 0.12),
        -4px -4px 10px rgba(255, 255, 247, 0.62);
    }
    .mlp-modal h2 {
      margin: 0 0 6px;
      color: var(--mlp-seed);
      font-size: 22px;
      font-weight: 800;
    }
    .mlp-modal.is-calendar h2 {
      color: var(--mlp-seed);
    }
    .mlp-modal p {
      margin: 0 0 16px;
      color: rgba(91, 81, 71, 0.68);
      font-size: 13px;
    }
    .mlp-modal form {
      display: grid;
      gap: 12px;
    }
    .mlp-modal label {
      display: grid;
      gap: 6px;
      color: rgba(91, 81, 71, 0.72);
      font-size: 12px;
      font-weight: 700;
    }
    .mlp-modal input,
    .mlp-modal select {
      width: 100%;
      border: 1px solid rgba(255, 255, 247, 0.68);
      border-radius: 16px;
      padding: 12px 14px;
      color: var(--mlp-seed);
      background: rgba(244, 242, 229, 0.54);
      box-shadow: inset 3px 3px 9px rgba(101, 89, 76, 0.08);
      backdrop-filter: blur(12px) saturate(1.18);
      outline: none;
    }
    .mlp-modal-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .mlp-choice-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .mlp-modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding-top: 4px;
    }
    .mlp-ghost,
    .mlp-primary,
    .mlp-choice {
      border: 0;
      border-radius: 999px;
      padding: 10px 16px;
      font-weight: 800;
    }
    .mlp-modal .mlp-ghost,
    .mlp-modal .mlp-primary,
    .mlp-modal .mlp-choice {
      box-shadow: none;
    }
    .mlp-ghost,
    .mlp-choice {
      color: var(--mlp-seed);
      background: #E8D6D3;
    }
    .mlp-primary,
    .mlp-choice.is-active {
      color: #FFFFFF;
      background: linear-gradient(145deg, var(--mlp-leaf), #B7C8A4);
    }
    .mlp-modal.is-calendar .mlp-primary,
    .mlp-modal.is-calendar .mlp-choice.is-active {
      color: #FFFFFF;
      background: linear-gradient(145deg, var(--mlp-rose), var(--mlp-rose-deep));
    }
    .mlp-delete-button {
      border: 0;
      border-radius: 999px;
      padding: 5px 10px;
      color: #FFFFFF;
      background: var(--mlp-rose-deep);
      font-size: 11px;
      font-weight: 800;
    }
    .mlp-swipe-wrap {
      position: relative;
      overflow: hidden;
      border-radius: 0.75rem;
    }
    .mlp-swipe-delete {
      position: absolute;
      top: 0;
      right: 0;
      bottom: 0;
      width: 74px;
      border: 0;
      color: #FFFFFF;
      background: var(--mlp-rose-deep);
      font-weight: 800;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.18s ease;
    }
    .mlp-swipe-content {
      position: relative;
      z-index: 1;
      width: 100%;
      transition: transform 0.18s ease;
      background: inherit;
      touch-action: pan-y;
    }
    .mlp-swipe-wrap.is-dragging .mlp-swipe-content {
      transition: none;
    }
    .mlp-swipe-wrap.is-open .mlp-swipe-content {
      transform: translateX(-74px);
    }
    .mlp-swipe-wrap.is-open .mlp-swipe-delete {
      opacity: 1;
      pointer-events: auto;
    }
    .mlp-ai-input {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 10px;
      margin-top: 10px;
    }
    .mlp-ai-input input {
      min-width: 0;
      border: 1px solid rgba(255, 255, 247, 0.72);
      border-radius: 18px;
      padding: 12px 14px;
      color: var(--mlp-seed);
      background: rgba(244, 242, 229, 0.88);
      box-shadow: inset 3px 3px 8px rgba(101, 89, 76, 0.08);
      outline: none;
    }
    body[data-mlp-route="ai"] main {
      padding-bottom: 210px !important;
      scroll-padding-bottom: 230px;
    }
    body[data-mlp-route="ai"] .fixed.bottom-\\[96px\\] {
      bottom: 88px !important;
    }
    body[data-mlp-route="ai"] .fixed.bottom-\\[96px\\] .flex.overflow-x-auto {
      padding-bottom: 8px !important;
    }
    body[data-mlp-route="ai"] .mlp-ai-input {
      border-radius: 20px !important;
      background: rgba(244, 242, 229, 0.86) !important;
      box-shadow: 8px 8px 18px rgba(101, 89, 76, 0.12), -6px -6px 16px rgba(229, 226, 215, 0.56) !important;
    }
    body[data-mlp-route="ai"] .mlp-ai-input .mlp-primary {
      min-width: 58px;
      border-radius: 16px;
      color: #FFFFFF;
      background: #9DAF86;
      box-shadow: none;
    }
    body[data-mlp-route="ai"] .chat-bubble-user,
    .mlp-ai-message {
      display: block;
      width: fit-content;
      max-width: min(78%, 320px);
      margin: 10px 0 0 auto;
      padding: 10px 13px;
      border-radius: 18px 18px 6px 18px;
      color: #4D443C;
      background: linear-gradient(145deg, rgba(216, 167, 160, 0.72), rgba(232, 214, 211, 0.86));
      box-shadow: 5px 5px 14px rgba(101, 89, 76, 0.12), -5px -5px 14px rgba(255, 255, 247, 0.74);
      font-size: 14px;
      line-height: 1.5;
      overflow-wrap: anywhere;
      white-space: pre-wrap;
    }
    body[data-mlp-route="ai"] .chat-bubble-ai {
      width: fit-content;
      max-width: min(82%, 340px);
      background: rgba(244, 242, 229, 0.84) !important;
      color: var(--mlp-seed) !important;
      box-shadow: 5px 5px 14px rgba(101, 89, 76, 0.1), -5px -5px 14px rgba(255, 255, 247, 0.76) !important;
      overflow-wrap: anywhere;
    }
  `;
  doc.head.append(style);
}

// 打开“新建日程”或“新建清单”弹窗。
function openEntryModal(doc, type) {
  // 根据 type 判断弹窗类型。
  const isCalendar = type === "calendar";
  const isList = type === "list";

  // 清单弹窗中的列表按钮，来自 runtime.taskLists。
  const listChoices = runtime.taskLists
    .map((name, index) => `<button class="mlp-choice ${index === 0 ? "is-active" : ""}" type="button" data-list-choice="${escapeHtml(name)}">${escapeHtml(name)}</button>`)
    .join("");

  // 日程弹窗默认日期为今天。
  const today = new Date().toISOString().slice(0, 10);

  // 创建遮罩层，弹窗内容通过 innerHTML 插入。
  const overlay = doc.createElement("div");
  overlay.className = "mlp-modal-backdrop";
  overlay.innerHTML = `
    <section class="mlp-modal ${isCalendar ? "is-calendar" : ""}" role="dialog" aria-modal="true">
      <h2>${isList ? "新建清单" : isCalendar ? "新建日程" : "新建任务"}</h2>
      <p>${isList ? "输入清单名称后，会显示在清单页顶部选项卡和折叠列表中。" : isCalendar ? "选择日期、时间和类型，保存后同步到日程表与时间轴。" : "选择任务要保存到哪个清单列表，保存后会进入对应折叠清单。"}</p>
      <form>
        ${
          isList
            ? `
              <label>
                清单名称
                <input name="listName" required maxlength="18" placeholder="例如：学习计划" />
              </label>
            `
            : `
              <label>
                ${isCalendar ? "日程名称" : "任务名称"}
                <input name="title" required maxlength="28" placeholder="${isCalendar ? "例如：产品复盘会议" : "例如：准备周会资料"}" />
              </label>
            `
        }
        ${
          isList
            ? ""
            : isCalendar
            ? `
              <div class="mlp-modal-row">
                ${buildDateInputMarkup()}
                ${buildTimeInputMarkup()}
              </div>
              <input name="type" type="hidden" value="会议" />
              ${buildModalChoiceField("类型", "type", ["会议", "运动", "生活", "重要"], "会议")}
            `
            : `
              <div class="mlp-modal-row">
                <input name="time" type="hidden" value="18:00" />
                ${buildTimeInputMarkup()}
                <input name="priority" type="hidden" value="普通" />
                ${buildModalChoiceField("优先级", "priority", ["普通", "重要", "紧急", "低优先级"], "普通")}
              </div>
            `
        }
        ${
          isCalendar
            ? `
              <label>
                地点 / 备注
                <input name="note" maxlength="34" placeholder="例如：静安会议室 A201" />
              </label>
            `
            : ""
        }
        ${
          isCalendar || isList
            ? ""
            : `
              <label>
                清单列表
                <div class="mlp-choice-row" data-list-choices>${listChoices}</div>
              </label>
            `
        }
        <div class="mlp-modal-actions">
          <button class="mlp-ghost" type="button" data-mlp-close>取消</button>
          <button class="mlp-primary" type="submit">保存</button>
        </div>
      </form>
    </section>
  `;

  // 把弹窗挂到当前 iframe 页面 body。
  doc.body.append(overlay);
  normalizePickerControls(overlay);

  // 自动聚焦第一个输入框，方便用户立即输入。
  overlay.querySelector("input:not([type='hidden'])")?.focus();
  wireModalWheelPickers(overlay);
  wireModalChoiceFields(overlay);

  // 清单弹窗需要额外挂载列表选择按钮逻辑。
  if (!isCalendar && !isList) wireTaskListPicker(overlay);

  // 点击遮罩或取消按钮时关闭弹窗。
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay || event.target.closest("[data-mlp-close]")) overlay.remove();
  });

  // 提交弹窗表单。
  overlay.querySelector("form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;

    // 新建清单：只保存清单名称，并立即刷新顶部选项卡和折叠清单。
    if (isList) {
      const listName = form.elements.listName.value.trim();
      if (!listName) return;
      if (!runtime.taskLists.includes(listName)) runtime.taskLists.push(listName);
      runtime.activeTaskList = listName;
      runtime.expandedTaskLists[listName] = true;
      saveRuntime();
      renderTaskLists(doc);
      renderTaskItems(doc);
      overlay.remove();
      return;
    }

    // 统一整理表单数据，日程和清单共用 item 结构。
    const item = {
      id: Date.now(),
      title: form.elements.title.value.trim(),
      date: isCalendar ? normalizeDateInput(form.elements.date.value) : "",
      time: normalizeTimeInput(form.elements.time.value) || (isCalendar ? "15:30" : "18:00"),
      type: isCalendar ? form.elements.type.value : "",
      status: isCalendar ? "" : "活动",
      priority: isCalendar ? "" : form.elements.priority.value,
      note: form.elements.note?.value.trim() || "",
      listName: isCalendar ? "" : resolveSelectedTaskList(overlay, form)
    };

    // 标题为空时不保存。
    if (!item.title) return;

    // 日程：写入 calendarItems，并刷新日程表格/时间轴。
    if (isCalendar) {
      runtime.calendarItems.push(item);
      renderCalendarItems(doc);
    // 清单：写入 taskItems，并刷新清单分类/任务列表。
    } else {
      if (item.listName && !runtime.taskLists.includes(item.listName)) runtime.taskLists.push(item.listName);
      runtime.taskItems.push({ ...item, done: false });
      renderTaskLists(doc);
      renderTaskItems(doc);
      renderTaskHighlights(doc);
    }

    // 保存数据并关闭弹窗。
    saveRuntime();
    overlay.remove();
  });
}

// 清单弹窗中的“保存到哪个列表”按钮逻辑。
function wireTaskListPicker(overlay) {
  overlay.querySelectorAll("[data-list-choice]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      // 被点击的按钮高亮，其它按钮取消高亮。
      overlay.querySelectorAll("[data-list-choice]").forEach((item) => item.classList.toggle("is-active", item === button));
    });
  });
}

function normalizeDateInput(value) {
  const text = value.trim();
  if (!text) return new Date().toISOString().slice(0, 10);
  const normalized = text.replace(/[年月.]/g, "/").replace(/日/g, "");
  const parts = normalized.split(/[/-]/).map((part) => Number(part));
  if (parts.length >= 3 && parts.every(Boolean)) {
    const [year, month, day] = parts;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return new Date().toISOString().slice(0, 10);
}

function normalizeTimeInput(value) {
  const text = value.trim();
  if (!text) return "";
  const match = text.match(/^(\d{1,2})[:：时点]?(\d{0,2})/);
  if (!match) return "";
  const hour = Math.min(23, Number(match[1] || 0));
  const minute = Math.min(59, Number(match[2] || 0));
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function buildDatePickerMarkup(value) {
  const date = parseLocalDate(value);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const years = Array.from({ length: 5 }, (_, index) => year - 1 + index);
  const months = Array.from({ length: 12 }, (_, index) => index + 1);
  const days = Array.from({ length: 31 }, (_, index) => index + 1);

  return `
    <div class="mlp-wheel-field" data-mlp-date-picker>
      <span class="mlp-wheel-label">日期</span>
      <button class="mlp-picker-trigger mlp-picker-input-trigger" type="button" data-picker-trigger data-placeholder="年/月/日"><span>年/月/日</span><span class="material-symbols-outlined">calendar_month</span></button>
      <div class="mlp-picker-panel">
      <div class="mlp-wheel-shell">
        ${buildWheelColumn("year", years, year, "年")}
        ${buildWheelColumn("month", months, month, "月")}
        ${buildWheelColumn("day", days, day, "日")}
      </div>
      </div>
    </div>
  `;
}

function buildDateInputMarkup() {
  return `
    <label class="mlp-plain-field">
      日期
      <input name="date" class="mlp-modal-input" placeholder="年/月/日" autocomplete="off" inputmode="numeric" />
    </label>
  `;
}

function buildTimeInputMarkup() {
  return `
    <label class="mlp-plain-field">
      时间
      <input name="time" class="mlp-modal-input" placeholder="00:00" autocomplete="off" inputmode="numeric" />
    </label>
  `;
}

function buildTimePickerMarkup(value) {
  const [hour = "18", minute = "00"] = value.split(":");
  const hours = Array.from({ length: 24 }, (_, index) => index);
  const minutes = Array.from({ length: 12 }, (_, index) => index * 5);

  return `
    <div class="mlp-wheel-field" data-mlp-time-picker>
      <span class="mlp-wheel-label">时间</span>
      <button class="mlp-picker-trigger mlp-picker-input-trigger" type="button" data-picker-trigger data-placeholder="00:00"><span>00:00</span><span class="material-symbols-outlined">schedule</span></button>
      <div class="mlp-picker-panel">
      <div class="mlp-wheel-shell">
        ${buildWheelColumn("hour", hours, Number(hour), "时", 2)}
        ${buildWheelColumn("minute", minutes, Number(minute), "分", 2)}
      </div>
      </div>
    </div>
  `;
}

function buildModalChoiceField(label, name, options, selected) {
  return `
    <div class="mlp-modal-choice-field" data-modal-choice-field="${name}">
      <span class="mlp-wheel-label">${label}</span>
      <button class="mlp-picker-trigger" type="button" data-picker-trigger><span>${escapeHtml(selected)}</span><span class="material-symbols-outlined">expand_more</span></button>
      <div class="mlp-picker-panel">
      <div class="mlp-modal-choice-grid">
        ${options.map((option) => `<button class="mlp-modal-choice ${option === selected ? "is-selected" : ""}" type="button" data-choice-value="${escapeHtml(option)}">${escapeHtml(option)}</button>`).join("")}
      </div>
      </div>
    </div>
  `;
}

function buildWheelColumn(part, values, selected, unit, pad = 0) {
  return `
    <div class="mlp-wheel-column" data-wheel-part="${part}">
      ${values
        .map((value) => {
          const text = pad ? String(value).padStart(pad, "0") : String(value);
          return `<button class="${value === selected ? "is-selected" : ""}" type="button" data-wheel-value="${value}">${text}<small>${unit}</small></button>`;
        })
        .join("")}
    </div>
  `;
}

function wireModalWheelPickers(overlay) {
  const form = overlay.querySelector("form");
  if (!form) return;

    const syncDate = () => {
      const picker = overlay.querySelector("[data-mlp-date-picker]");
      if (!picker || !form.elements.date) return;
      const year = picker.querySelector("[data-wheel-part='year'] .is-selected")?.dataset.wheelValue;
      const month = picker.querySelector("[data-wheel-part='month'] .is-selected")?.dataset.wheelValue;
      const day = picker.querySelector("[data-wheel-part='day'] .is-selected")?.dataset.wheelValue;
      form.elements.date.value = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const trigger = picker.querySelector("[data-picker-trigger]");
      if (trigger && trigger.classList.contains("has-value")) trigger.querySelector("span:first-child").textContent = `${year}年${Number(month)}月${Number(day)}日`;
    };

    const syncTime = () => {
      const picker = overlay.querySelector("[data-mlp-time-picker]");
      if (!picker || !form.elements.time) return;
      const hour = picker.querySelector("[data-wheel-part='hour'] .is-selected")?.dataset.wheelValue;
      const minute = picker.querySelector("[data-wheel-part='minute'] .is-selected")?.dataset.wheelValue;
      form.elements.time.value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      const trigger = picker.querySelector("[data-picker-trigger]");
      if (trigger && trigger.classList.contains("has-value")) trigger.querySelector("span:first-child").textContent = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    };

  overlay.querySelectorAll(".mlp-wheel-column").forEach((column) => {
    const selectButton = (button) => {
      if (!button) return;
      column.querySelectorAll("button").forEach((item) => item.classList.toggle("is-selected", item === button));
      button.scrollIntoView({ block: "center", behavior: "smooth" });
      column.closest(".mlp-wheel-field")?.querySelector("[data-picker-trigger]")?.classList.add("has-value");
      syncDate();
      syncTime();
    };
    column.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      selectButton(button);
    });
    column.addEventListener("wheel", (event) => {
      event.preventDefault();
      const buttons = [...column.querySelectorAll("button")];
      const currentIndex = Math.max(0, buttons.findIndex((button) => button.classList.contains("is-selected")));
      const nextIndex = Math.max(0, Math.min(buttons.length - 1, currentIndex + Math.sign(event.deltaY)));
      selectButton(buttons[nextIndex]);
    }, { passive: false });
    column.addEventListener("keydown", (event) => {
      if (!["ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault();
      const buttons = [...column.querySelectorAll("button")];
      const currentIndex = Math.max(0, buttons.findIndex((button) => button.classList.contains("is-selected")));
      const nextIndex = Math.max(0, Math.min(buttons.length - 1, currentIndex + (event.key === "ArrowDown" ? 1 : -1)));
      selectButton(buttons[nextIndex]);
    });
    column.querySelector(".is-selected")?.scrollIntoView({ block: "center" });
  });
  syncDate();
  syncTime();
  wirePickerPanels(overlay);
}

function normalizePickerControls(overlay) {
  overlay.querySelectorAll(".mlp-wheel-field, .mlp-modal-choice-field").forEach((field) => {
    field.style.position = "relative";
    field.style.display = "grid";
    field.style.gap = "9px";
    field.style.minWidth = "0";
  });

  overlay.querySelectorAll("[data-picker-trigger]").forEach((trigger) => {
    trigger.style.cssText = [
      "display:flex",
      "align-items:center",
      "justify-content:space-between",
      "gap:10px",
      "width:100%",
      "min-height:48px",
      "border:1px solid rgba(255,255,247,.64)",
      "border-radius:16px",
      "padding:0 14px",
      trigger.classList.contains("mlp-picker-input-trigger") ? "color:rgba(95,59,24,.38)" : "color:rgba(95,59,24,.78)",
      "background:rgba(244,242,229,.52)",
      "box-shadow:inset 3px 3px 9px rgba(101,89,76,.08), inset -3px -3px 9px rgba(255,255,247,.44)",
      "text-align:left",
      "font-size:15px",
      "font-weight:900",
      "backdrop-filter:blur(18px) saturate(1.16)",
      "-webkit-backdrop-filter:blur(18px) saturate(1.16)"
    ].join(";");
    const icon = trigger.querySelector(".material-symbols-outlined");
    if (icon) {
      icon.style.color = "rgba(35,31,28,.86)";
      icon.style.fontSize = "19px";
      icon.style.lineHeight = "1";
    }
  });

  overlay.querySelectorAll(".mlp-picker-panel").forEach((panel) => {
    panel.style.cssText = [
      "display:none",
      "position:absolute",
      "left:0",
      "right:0",
      "top:calc(100% + 4px)",
      "z-index:60",
      "border:1px solid rgba(255,255,247,.62)",
      "border-radius:18px",
      "padding:7px",
      "background:linear-gradient(145deg, rgba(244,242,229,.78), rgba(232,214,211,.58))",
      "box-shadow:0 18px 34px rgba(91,81,71,.18), inset 1px 1px 0 rgba(255,255,247,.48)",
      "backdrop-filter:blur(24px) saturate(1.28)",
      "-webkit-backdrop-filter:blur(24px) saturate(1.28)"
    ].join(";");
  });

  overlay.querySelectorAll(".mlp-modal-choice-grid").forEach((grid) => {
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "1fr";
    grid.style.gridAutoFlow = "row";
    grid.style.gap = "0";
    grid.style.width = "100%";
  });

  overlay.querySelectorAll(".mlp-modal-choice").forEach((button) => {
    button.style.display = "block";
    button.style.width = "100%";
    button.style.minHeight = "44px";
    button.style.textAlign = "left";
    button.style.padding = "0 16px";
  });
}

function wireModalChoiceFields(overlay) {
  const form = overlay.querySelector("form");
  if (!form) return;
  overlay.querySelectorAll("[data-modal-choice-field]").forEach((field) => {
    const name = field.dataset.modalChoiceField;
    field.querySelectorAll("[data-choice-value]").forEach((button) => {
      button.addEventListener("click", () => {
        field.querySelectorAll("[data-choice-value]").forEach((item) => item.classList.toggle("is-selected", item === button));
        if (form.elements[name]) form.elements[name].value = button.dataset.choiceValue;
        const trigger = field.querySelector("[data-picker-trigger]");
        if (trigger) trigger.querySelector("span:first-child").textContent = button.dataset.choiceValue;
        field.classList.remove("is-open");
        const panel = field.querySelector(".mlp-picker-panel");
        if (panel) panel.style.display = "none";
      });
    });
  });
  wirePickerPanels(overlay);
}

function wirePickerPanels(overlay) {
  if (overlay.dataset.mlpPickerPanelsWired) return;
  overlay.dataset.mlpPickerPanelsWired = "true";
  overlay.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-picker-trigger]");
    if (trigger) {
      event.preventDefault();
      event.stopPropagation();
      const field = trigger.closest(".mlp-wheel-field, .mlp-modal-choice-field");
      const willOpen = !field.classList.contains("is-open");
      overlay.querySelectorAll(".mlp-wheel-field.is-open, .mlp-modal-choice-field.is-open").forEach((node) => {
        node.classList.remove("is-open");
        const panel = node.querySelector(".mlp-picker-panel");
        if (panel) panel.style.display = "none";
      });
      field.classList.toggle("is-open", willOpen);
      const panel = field.querySelector(".mlp-picker-panel");
      if (panel) panel.style.display = willOpen ? "block" : "none";
      return;
    }
    if (!event.target.closest(".mlp-picker-panel")) {
      overlay.querySelectorAll(".mlp-wheel-field.is-open, .mlp-modal-choice-field.is-open").forEach((node) => {
        node.classList.remove("is-open");
        const panel = node.querySelector(".mlp-picker-panel");
        if (panel) panel.style.display = "none";
      });
    }
  });
}

// 返回当前选中的清单列表名称。
function resolveSelectedTaskList(overlay, form) {
  return overlay.querySelector("[data-list-choice].is-active")?.dataset.listChoice || runtime.taskLists[0] || "工作任务";
}

// 清单页顶部重点卡片：把“紧急任务”和“所需物品”改成可点击的数据入口。
function renderTaskHighlights(doc) {
  const highlightSection = [...doc.querySelectorAll("main section.grid")].find((section) => section.textContent.includes("紧急任务") && section.textContent.includes("所需物品"));
  if (!highlightSection) return;

  const urgentItems = runtime.taskItems.filter((item) => !item.done && (item.priority === "紧急" || item.status === "紧急"));
  const shoppingItems = runtime.taskItems.filter((item) => !item.done && (item.listName === "购物清单" || item.type === "购物"));

  const cards = [...highlightSection.children];
  const urgentCard = cards.find((card) => card.textContent.includes("紧急任务"));
  const shoppingCard = cards.find((card) => card.textContent.includes("所需物品"));

  enhanceTaskHighlightCard(urgentCard, {
    type: "urgent",
    count: urgentItems.length,
    unit: "待办",
    aria: "查看紧急任务"
  });
  enhanceTaskHighlightCard(shoppingCard, {
    type: "shopping",
    count: shoppingItems.length,
    unit: "待买",
    aria: "查看购物清单"
  });

  if (!highlightSection.dataset.mlpHighlightWired) {
    highlightSection.dataset.mlpHighlightWired = "true";
    highlightSection.addEventListener("click", (event) => {
      const card = event.target.closest("[data-mlp-highlight]");
      if (!card) return;
      event.preventDefault();
      event.stopPropagation();
      openTaskHighlightModal(doc, card.dataset.mlpHighlight);
    });
  }
}

// 给重点卡片补充新拟态材质、计数和可访问点击属性。
function enhanceTaskHighlightCard(card, config) {
  if (!card) return;
  card.classList.add("mlp-task-highlight-card", `is-${config.type}`);
  card.dataset.mlpHighlight = config.type;
  card.setAttribute("role", "button");
  card.setAttribute("tabindex", "0");
  card.setAttribute("aria-label", config.aria);
  card.style.cursor = "pointer";

  const countNode = [...card.querySelectorAll("div")].reverse().find((node) => /\d+\s*(待办|待买)/.test(node.textContent));
  if (countNode) countNode.textContent = `${config.count} ${config.unit}`;
}

// 点击“紧急任务/所需物品”后，用毛玻璃弹窗展示对应数据库里的任务。
function openTaskHighlightModal(doc, type) {
  doc.querySelector("[data-mlp-highlight-modal]")?.remove();
  const isShopping = type === "shopping";
  const items = runtime.taskItems.filter((item) => {
    if (item.done) return false;
    return isShopping ? item.listName === "购物清单" || item.type === "购物" : item.priority === "紧急" || item.status === "紧急";
  });

  const overlay = doc.createElement("div");
  overlay.className = "mlp-modal-backdrop mlp-neumo-modal-backdrop";
  overlay.dataset.mlpHighlightModal = "true";
  overlay.innerHTML = `
    <section class="mlp-modal mlp-task-highlight-modal" role="dialog" aria-modal="true">
      <h2>${isShopping ? "所需物品" : "紧急任务"}</h2>
      <p>${isShopping ? "这里显示保存到购物清单中的未完成内容。" : "这里显示优先级为紧急的未完成任务。"}</p>
      <div class="mlp-highlight-list">
        ${
          items.length
            ? items.map((item) => `
                <article>
                  <strong>${escapeHtml(item.title)}</strong>
                  <span>${escapeHtml(item.time || "今天")} · ${escapeHtml(item.priority || item.status || "活动")} · ${escapeHtml(item.listName || "清单")}</span>
                </article>
              `).join("")
            : `<div class="mlp-empty-state">${isShopping ? "购物清单暂时没有待买内容。" : "暂时没有紧急任务。"}</div>`
        }
      </div>
      <div class="mlp-modal-actions">
        <button class="mlp-primary" type="button" data-mlp-close>知道了</button>
      </div>
    </section>
  `;

  doc.body.append(overlay);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay || event.target.closest("[data-mlp-close]")) overlay.remove();
  });
}

// 渲染用户新增的所有日程：同时更新日程表格和时间轴。
function renderCalendarItems(doc) {
  // 先清理旧的动态日程，避免重复显示。
  doc.querySelectorAll("[data-mlp-calendar-item], [data-mlp-timeline-item]").forEach((node) => node.remove());

  // 每条日程都写入日历格子和时间轴。
  runtime.calendarItems.forEach((item) => {
    appendCalendarBadge(doc, item);
    appendTimelineItem(doc, item);
  });
}

// 把某条日程追加到日历表格中对应日期的格子里。
function appendCalendarBadge(doc, item) {
  // 从日期字符串里取出“几号”。
  const day = String(new Date(`${item.date || new Date().toISOString().slice(0, 10)}T00:00:00`).getDate());

  // 找到日历网格中的目标日期格。
  const cells = [...doc.querySelectorAll(".grid.grid-cols-7.gap-2 > div")];
  const targetCell = cells.find((cell) => cell.querySelector("span")?.textContent.trim() === day) || cells.find((cell) => cell.textContent.includes("15")) || cells.at(-1);
  if (!targetCell) return;

  // 新增一个小标签显示“类型·标题”。
  const badge = doc.createElement("div");
  badge.dataset.mlpCalendarItem = item.id;
  badge.className = "bg-forest-green px-1 py-0.5 rounded text-[8px] text-white truncate";
  badge.textContent = `${item.type || "活动"}·${item.title}`;
  targetCell.append(badge);
}

// 把某条日程追加到时间轴里，并带删除按钮。
function appendTimelineItem(doc, item) {
  const timeline = doc.querySelector(".relative.space-y-gutter");
  if (!timeline) return;

  // 创建和原时间轴类似的行程卡片。
  const node = doc.createElement("div");
  node.dataset.mlpTimelineItem = item.id;
  node.className = "flex gap-md relative";
  node.innerHTML = `
    <div class="w-12 pt-1 text-right">
      <span class="font-label-sm text-label-sm text-charcoal/70">${escapeHtml(item.time)}</span>
    </div>
    <div class="z-10 mt-2 w-3 h-3 rounded-full border-2 border-white bg-mustard-gold shadow-sm"></div>
    <div class="flex-1 bg-white p-md rounded-xl border border-warm-sand/30 hover:border-warm-sand transition-colors cursor-pointer">
      <div class="flex justify-between items-start mb-1">
        <h4 class="font-body-md font-semibold text-charcoal">${escapeHtml(item.title)}</h4>
        <div class="flex items-center gap-2">
          <span class="font-label-sm text-[10px] px-2 py-0.5 bg-mustard-gold/20 text-mustard-gold rounded-full">${escapeHtml(item.type || "活动")}</span>
          <button class="mlp-delete-button" type="button" data-delete-calendar="${item.id}">删除</button>
        </div>
      </div>
      <p class="font-label-sm text-charcoal/70 text-xs">${escapeHtml(item.date || "")} ${escapeHtml(item.note || "新增日程")}</p>
    </div>
  `;
  timeline.append(node);
}

// 给日程页行程挂载删除按钮逻辑。
function wireCalendarDeleteButtons(doc) {
  // 用户新增的日程：根据 id 从 runtime.calendarItems 中删除。
  doc.querySelectorAll("[data-delete-calendar]").forEach((button) => {
    if (button.dataset.mlpWired) return;
    button.dataset.mlpWired = "true";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const id = Number(button.dataset.deleteCalendar);
      runtime.calendarItems = runtime.calendarItems.filter((item) => item.id !== id);
      saveRuntime();
      renderCalendarItems(doc);
      wireCalendarDeleteButtons(doc);
    });
  });

  // 原始静态日程：不能从 HTML 真正删除，所以用 hidden + localStorage 记录删除状态。
  const originalRows = [...doc.querySelectorAll(".relative.space-y-gutter > .flex.gap-md.relative:not([data-mlp-timeline-item])")];
  originalRows.forEach((row, index) => {
    // 如果之前删过，就继续隐藏。
    if (runtime.staticCalendarDeleted[index]) {
      row.hidden = true;
      return;
    }
    const card = row.querySelector(".flex-1");
    if (!card || card.querySelector("[data-delete-static-calendar]")) return;

    // 给原始日程卡片追加一个删除按钮。
    const button = doc.createElement("button");
    button.className = "mlp-delete-button";
    button.type = "button";
    button.dataset.deleteStaticCalendar = String(index);
    button.textContent = "删除";
    card.append(button);
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      // 记录删除状态，并立即隐藏这一行。
      runtime.staticCalendarDeleted[index] = true;
      saveRuntime();
      row.hidden = true;
    });
  });
}

// 给日程时间轴加轻量微动效：卡片悬停轻移、时间点呼吸闪烁、点击短暂高亮。
function enhanceCalendarTimelineMotion(doc) {
  const timeline = doc.querySelector(".relative.space-y-gutter");
  if (!timeline || timeline.dataset.mlpMotionReady) return;
  timeline.dataset.mlpMotionReady = "true";
  timeline.classList.add("mlp-timeline-motion");

  // 点击某条时间轴内容时，让卡片有一个短暂的按压反馈。
  timeline.addEventListener("click", (event) => {
    const row = event.target.closest(".flex.gap-md.relative, [data-mlp-timeline-item]");
    if (!row) return;
    row.animate(
      [
        { transform: "translateX(0) scale(1)" },
        { transform: "translateX(4px) scale(0.985)" },
        { transform: "translateX(0) scale(1)" }
      ],
      { duration: 260, easing: "cubic-bezier(.2,.8,.2,1)" }
    );
  });
}

// 渲染清单页顶部横向分类列表。
function renderTaskLists(doc) {
  const categoryNav = doc.querySelector("main nav.mlp-list-tabs, main nav.flex.gap-sm");
  if (!categoryNav) return;

  if (!doc.body.dataset.mlpTaskManageDismissWired) {
    doc.body.dataset.mlpTaskManageDismissWired = "true";
    doc.addEventListener("pointerdown", (event) => {
      if (!runtime.taskListManage) return;
      if (event.target.closest(".mlp-list-tabs")) return;
      runtime.taskListManage = false;
      saveRuntime();
      renderTaskLists(doc);
    });
  }

  // 把原本横向按钮改造成真正的选项卡；保留“全部清单”，并追加用户新建的清单。
  const tabs = ["全部清单", ...runtime.taskLists.filter((name) => name !== "全部清单")];
  if (!tabs.includes(runtime.activeTaskList)) runtime.activeTaskList = "全部清单";

  categoryNav.className = "mlp-list-tabs";
  categoryNav.innerHTML = "";

  tabs.forEach((name) => {
    const button = doc.createElement("button");
    button.type = "button";
    button.className = `mlp-list-tab ${runtime.activeTaskList === name ? "is-active" : ""}`;
    button.dataset.mlpListFilter = name;
    button.dataset.mlpLongPressed = "false";
    button.innerHTML = `
      <span>${escapeHtml(name)}</span>
      ${runtime.taskListManage && name !== "全部清单" ? `<span class="mlp-list-tab-delete" data-delete-list="${escapeHtml(name)}">×</span>` : ""}
    `;
    let pressTimer;
    button.addEventListener("pointerdown", () => {
      clearTimeout(pressTimer);
      pressTimer = setTimeout(() => {
        button.dataset.mlpLongPressed = "true";
        runtime.taskListManage = true;
        saveRuntime();
        renderTaskLists(doc);
      }, 520);
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach((eventName) => {
      button.addEventListener(eventName, () => clearTimeout(pressTimer));
    });
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const deleteTarget = event.target.closest("[data-delete-list]");
      if (deleteTarget) {
        const targetName = deleteTarget.dataset.deleteList;
        runtime.taskLists = runtime.taskLists.filter((item) => item !== targetName);
        runtime.taskItems = runtime.taskItems.filter((item) => item.listName !== targetName);
        if (runtime.activeTaskList === targetName) runtime.activeTaskList = "全部清单";
        delete runtime.expandedTaskLists[targetName];
        if (!runtime.taskLists.length) runtime.taskLists = ["工作任务", "个人生活", "购物清单"];
        saveRuntime();
        renderTaskLists(doc);
        renderTaskItems(doc);
        renderTaskHighlights(doc);
        return;
      }
      if (button.dataset.mlpLongPressed === "true") {
        button.dataset.mlpLongPressed = "false";
        return;
      }
      runtime.activeTaskList = name;
      saveRuntime();
      renderTaskLists(doc);
      renderTaskItems(doc);
    });
    categoryNav.append(button);
  });

  // 新建清单按钮只负责创建清单名称，不直接创建任务。
  const createButton = doc.createElement("button");
  createButton.type = "button";
  createButton.className = "mlp-new-list-button";
  createButton.dataset.mlpAction = "new-list";
  createButton.textContent = "+ 新建清单";
  categoryNav.append(createButton);
  createButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openEntryModal(doc, "list");
  });
}

// 给原始静态任务左侧小方框挂载“完成/未完成”切换。
function wireStaticTaskToggles(doc) {
  const taskCards = [...doc.querySelectorAll("section.space-y-sm .bg-surface-container-lowest")];
  taskCards.forEach((card, index) => {
    // 如果这条原始任务已经被用户删除，则隐藏。
    if (runtime.staticTaskDeleted[index]) {
      card.hidden = true;
      return;
    }
    const button = card.querySelector("button");
    const title = card.querySelector("h4");
    const check = button?.querySelector(".material-symbols-outlined");
    if (!button || !title || button.dataset.mlpStaticWired) return;

    // 保存静态任务索引，滑动删除时会用到。
    button.dataset.mlpStaticWired = "true";
    card.dataset.mlpStaticIndex = String(index);

    // 初始化完成状态。
    applyTaskDoneState(card, button, title, check, Boolean(runtime.staticTaskDone[index]));

    // 点击方框时切换完成状态并保存。
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleStaticTaskDone(index);
      applyTaskDoneState(card, button, title, check, runtime.staticTaskDone[index]);
    });
  });
}

// 根据 done 状态更新任务卡片的视觉表现。
function applyTaskDoneState(card, button, title, check, done) {
  card.classList.toggle("opacity-60", done);
  title.classList.toggle("line-through", done);
  button.classList.toggle("bg-primary-container", done);
  button.classList.toggle("border-2", !done);
  button.classList.toggle("is-done", done);
  check?.classList.toggle("opacity-0", !done);
}

// 渲染用户新增的清单任务，并按清单列表分组。
function renderTaskItems(doc) {
  // 清理旧动态任务、动态分组和左滑容器，避免重复渲染。
  doc.querySelectorAll("[data-mlp-task-section], [data-mlp-task-accordion-root]").forEach((node) => node.remove());
  const taskRoot = doc.querySelector("section.space-y-sm");
  if (!taskRoot) return;

  // 原始静态任务只作为数据来源，新的视觉会在折叠列表里重建一份。
  // 原页面结构是“标题 h3 + div.space-y-xs 卡片组”，这里连同标题一起隐藏。
  const staticItems = [];
  const originalGroups = [...taskRoot.querySelectorAll("div.space-y-xs")];
  originalGroups.forEach((group) => {
    const heading = group.previousElementSibling?.matches("h3") ? group.previousElementSibling : null;
    const rawListName = heading?.textContent.replace(/\s+/g, "").trim() || runtime.taskLists[0] || "工作任务";
    const listNameMap = { 工作: "工作任务", 个人: "个人生活", 购物: "购物清单" };
    const listName = listNameMap[rawListName] || rawListName;

    if (heading) {
      heading.hidden = true;
      heading.style.display = "none";
    }
    group.hidden = true;
    group.style.display = "none";
    group.dataset.mlpSourceGroup = "true";

    [...group.querySelectorAll(".bg-surface-container-lowest")].forEach((card) => {
      const index = Number(card.dataset.mlpStaticIndex || staticItems.length);
      const hasSavedDoneState = Object.prototype.hasOwnProperty.call(runtime.staticTaskDone, index);
      const originalLooksDone = card.textContent.includes("已完成") || !card.querySelector(".material-symbols-outlined[data-icon='check']")?.classList.contains("opacity-0");
      const done = hasSavedDoneState ? Boolean(runtime.staticTaskDone[index]) : originalLooksDone;
      const status = getTaskStatus({ done, status: card.textContent.includes("已完成") ? "已完成" : "活动" });
      card.dataset.mlpSourceTask = String(index);
      if (runtime.staticTaskDeleted[index]) return;
      staticItems.push({
        id: `static-${index}`,
        staticIndex: index,
        listName,
        title: card.querySelector("h4")?.textContent.trim() || `任务 ${index + 1}`,
        time: card.querySelector("p")?.textContent.trim() || "今天",
        status,
        done
      });
    });
  });

  // 用户新增任务保留自己选择的清单名称。
  const dynamicItems = runtime.taskItems.map((item) => ({
    ...item,
    done: Boolean(item.done),
    status: getTaskStatus(item),
    priority: item.priority || "普通",
    listName: item.listName || runtime.taskLists[0] || "工作任务"
  }));

  const allItems = [...staticItems, ...dynamicItems];
  const activeList = runtime.activeTaskList || "全部清单";

  // 按 listName 把任务分组；全部清单显示所有分组，单个选项卡只显示该清单。
  const groups = allItems.reduce((result, item) => {
    const listName = item.listName || "清单活动";
    if (activeList !== "全部清单" && listName !== activeList) return result;
    result[listName] = result[listName] || [];
    result[listName].push(item);
    return result;
  }, {});

  // 如果某个清单还没有任务，也要显示一个可折叠空列表，用户能看到新建清单已经成功。
  if (activeList !== "全部清单" && !groups[activeList]) groups[activeList] = [];
  if (activeList === "全部清单") {
    runtime.taskLists.forEach((listName) => {
      if (!groups[listName]) groups[listName] = [];
    });
  }

  const accordionRoot = doc.createElement("div");
  accordionRoot.dataset.mlpTaskAccordionRoot = "true";
  accordionRoot.className = "mlp-task-root";
  taskRoot.prepend(accordionRoot);

  // 每个清单列表单独生成一个可折叠区块。
  Object.entries(groups).forEach(([listName, items], groupIndex) => {
    const isOpen = runtime.expandedTaskLists[listName] ?? (activeList !== "全部清单" || groupIndex === 0);
    const section = doc.createElement("div");
    section.dataset.mlpTaskSection = listName;
    section.className = `mlp-task-accordion ${isOpen ? "is-open" : ""}`;
    section.innerHTML = `
      <button type="button" data-mlp-toggle-list="${escapeHtml(listName)}">
        <span>${escapeHtml(listName)}</span>
        <span class="text-xs text-on-surface-variant">${items.length} 项</span>
        <span class="material-symbols-outlined" data-icon="expand_more">expand_more</span>
      </button>
      <div class="mlp-task-panel" data-mlp-task-list="${escapeHtml(listName)}"></div>
    `;
    accordionRoot.append(section);

    const targetList = section.querySelector("[data-mlp-task-list]");

    // 折叠标题点击时切换展开状态，并保存到 localStorage。
    section.querySelector("[data-mlp-toggle-list]").addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const nextOpen = !section.classList.contains("is-open");
      runtime.expandedTaskLists[listName] = nextOpen;
      saveRuntime();
      section.classList.toggle("is-open", nextOpen);
    });

    // 在对应分组下渲染每条任务卡片；没有任务时展示空状态。
    if (!items.length) {
      targetList.innerHTML = `<div class="mlp-empty-state">这个清单还没有任务，点击右下角 + 添加。</div>`;
      return;
    }

    items.forEach((item) => {
      const status = getTaskStatus(item);
      const meta = item.priority ? `${item.priority} · ${status}` : status;
      const node = doc.createElement("div");
      if (item.staticIndex !== undefined) node.dataset.mlpStaticIndex = String(item.staticIndex);
      else node.dataset.mlpTaskItem = item.id;
      node.dataset.mlpTaskDone = String(Boolean(item.done));
      node.className = `bg-surface-container-lowest mlp-task-card ${item.done ? "is-done" : ""} p-md rounded-xl border border-outline-variant/30 flex items-center justify-between group hover:border-primary-container/60 transition-all duration-300`;
      node.innerHTML = `
        <div class="flex items-center gap-md ${item.done ? "opacity-60" : ""}">
          <button type="button" class="mlp-check-button ${item.done ? "is-done" : ""}" aria-pressed="${String(Boolean(item.done))}" aria-label="${item.done ? "标记为未完成" : "标记为已完成"}" ${item.staticIndex !== undefined ? `data-mlp-static-toggle="${item.staticIndex}"` : `data-mlp-task-toggle="${item.id}"`}>
            <span class="material-symbols-outlined" data-icon="check">check</span>
          </button>
          <div>
            <h4 class="text-body-lg font-h3 text-on-surface ${item.done ? "line-through" : ""}">${escapeHtml(item.title)}</h4>
            <p class="text-label-sm text-on-surface-variant flex items-center gap-xs">
              <span class="material-symbols-outlined text-[14px]" data-icon="local_activity">local_activity</span>
              ${escapeHtml(item.time)} · ${escapeHtml(meta)} · ${escapeHtml(item.listName || "清单活动")}
            </p>
          </div>
        </div>
        <span class="mlp-task-status-pill ${item.done ? "is-done" : ""}">${escapeHtml(item.priority || status)}</span>
      `;
      targetList.prepend(node);
    });
  });

  // 动态任务支持点击小方框切换完成状态。
  doc.querySelectorAll("[data-mlp-task-toggle]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleRuntimeTaskDone(button.dataset.mlpTaskToggle);
      renderTaskItems(doc);
      renderTaskHighlights(doc);
    });
  });

  // 原始静态任务的克隆卡片也支持完成状态切换，并同步保存。
  doc.querySelectorAll("[data-mlp-static-toggle]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const index = Number(button.dataset.mlpStaticToggle);
      toggleStaticTaskDone(index);
      renderTaskItems(doc);
      renderTaskHighlights(doc);
    });
  });

  // 动态任务渲染完后，统一挂载左滑删除交互。
  wireTaskSwipeDelete(doc);
}

// 给清单任务增加“向左滑动显示删除按钮”的交互。
function wireTaskSwipeDelete(doc) {
  // 找到还没有被包装过的任务卡片。
  const cards = [...doc.querySelectorAll("section.space-y-sm .bg-surface-container-lowest:not([data-mlp-swipe-ready]):not([data-mlp-source-task])")];
  cards.forEach((card, index) => {
    if (card.closest(".mlp-swipe-wrap")) return;

    // 动态任务有 data-mlp-task-item，静态任务没有。
    const dynamicId = card.dataset.mlpTaskItem;

    // 创建滑动容器和右侧删除按钮。
    const wrapper = doc.createElement("div");
    wrapper.className = "mlp-swipe-wrap";
    wrapper.dataset.mlpSwipeReady = "true";
    const deleteButton = doc.createElement("button");
    deleteButton.className = "mlp-swipe-delete";
    deleteButton.type = "button";
    deleteButton.textContent = "删除";

    // 用 wrapper 包住原卡片，让卡片可以向左移动露出删除按钮。
    const parent = card.parentNode;
    parent.insertBefore(wrapper, card);
    card.classList.add("mlp-swipe-content");
    card.dataset.mlpSwipeReady = "true";
    wrapper.append(deleteButton, card);

    let startX = 0;
    let currentX = 0;
    let isDragging = false;
    const maxReveal = 74;

    // 记录手指/鼠标按下的位置。
    wrapper.addEventListener("pointerdown", (event) => {
      // 点击完成方框或删除按钮时不启动滑动手势，避免滑动容器吞掉按钮点击。
      if (event.target.closest(".mlp-check-button, .mlp-swipe-delete")) return;

      startX = event.clientX;
      currentX = startX;
      isDragging = true;
      wrapper.classList.add("is-dragging");
      wrapper.setPointerCapture?.(event.pointerId);
    });

    // 记录滑动过程中的当前位置，并让任务卡片跟随手指向左移动。
    wrapper.addEventListener("pointermove", (event) => {
      if (!isDragging) return;
      currentX = event.clientX;
      const deltaX = Math.max(-maxReveal, Math.min(0, currentX - startX));
      card.style.transform = `translateX(${deltaX}px)`;
      deleteButton.style.opacity = String(Math.min(1, Math.abs(deltaX) / maxReveal));
    });

    // 松开时判断是否向左滑动超过阈值，超过则打开删除按钮。
    const finishSwipe = () => {
      if (!isDragging) return;
      isDragging = false;
      wrapper.classList.remove("is-dragging");
      const shouldOpen = currentX - startX < -36;
      wrapper.classList.toggle("is-open", shouldOpen);
      card.style.transform = "";
      deleteButton.style.opacity = "";
    };
    wrapper.addEventListener("pointerup", finishSwipe);
    wrapper.addEventListener("pointercancel", finishSwipe);

    // 点击删除按钮：动态任务从数组删除，静态任务记录删除状态。
    deleteButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (dynamicId) {
        runtime.taskItems = runtime.taskItems.filter((item) => String(item.id) !== String(dynamicId));
      } else {
        runtime.staticTaskDeleted[card.dataset.mlpStaticIndex || index] = true;
      }
      saveRuntime();
      wrapper.remove();
      renderTaskHighlights(doc);
    });
  });
}

// ── AI 助手页：注入真实对话框 + DeepSeek 流式调用 ──────────────────────────────
// 对话历史（仅含 user/assistant 角色，不含 system）。
const aiChatHistory = [];

// 给 AI 助手页注入真实输入框，并连接 DeepSeek API。
function injectAiInput(doc) {
  if (doc.querySelector("[data-mlp-ai-form]")) return;
  const container = doc.querySelector(".fixed.bottom-\\[96px\\] .max-w-md") || doc.querySelector(".fixed.bottom-\\[96px\\]");
  if (!container) return;

  // 快捷提示按钮 → 直接发送文本。
  container.querySelectorAll("button").forEach((btn) => {
    const text = btn.textContent.trim();
    if (text && !btn.textContent.includes("How can I help")) {
      btn.addEventListener("click", () => sendAiMessage(doc, text));
    }
  });

  const originalPrompt = [...container.querySelectorAll("button")].find((b) => b.textContent.includes("How can I help"));
  const form = doc.createElement("div");
  form.className = "mlp-ai-input";
  form.dataset.mlpAiForm = "true";
  form.innerHTML = `
    <input id="mlp-ai-text" autocomplete="off" placeholder="输入你想让晚晚帮忙的事…" />
    <button id="mlp-ai-send" class="mlp-primary" type="button">发送</button>
  `;
  if (originalPrompt) originalPrompt.replaceWith(form);
  else container.append(form);

  const input = doc.getElementById("mlp-ai-text");
  const sendBtn = doc.getElementById("mlp-ai-send");

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSend(); }
  });
  sendBtn.addEventListener("click", doSend);

  function doSend() {
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    sendAiMessage(doc, text);
  }
}

function appendAiUserMessage(doc, message) {
  const chatArea = doc.querySelector("main .max-w-md") || doc.querySelector("main");
  if (!chatArea) return;
  const wrap = doc.createElement("div");
  wrap.className = "flex flex-row-reverse items-start gap-sm";
  wrap.innerHTML = `<div class="w-8 h-8 rounded-full overflow-hidden shrink-0 ring-2 ring-tertiary/20 bg-surface-variant flex items-center justify-center"><span class="material-symbols-outlined text-[18px] text-on-surface">person</span></div><p class="mlp-ai-message chat-bubble-user px-md py-sm max-w-[85%] shadow-sm">${escapeHtml(message)}</p>`;
  chatArea.append(wrap);
  requestAnimationFrame(() => wrap.scrollIntoView({ block: "end", behavior: "smooth" }));
}

function appendAiBubble(doc) {
  const chatArea = doc.querySelector("main .max-w-md") || doc.querySelector("main");
  if (!chatArea) return null;
  const wrap = doc.createElement("div");
  wrap.className = "flex items-start gap-sm";
  wrap.innerHTML = `<div class="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(60,116,69,0.3)]"><span class="material-symbols-outlined text-[18px] text-white opacity-90">bubble_chart</span></div><div class="chat-bubble-ai px-md py-sm max-w-[85%] shadow-sm border border-outline-variant/20"><p class="font-body-md text-body-md text-on-surface mlp-ai-stream-text" style="white-space:pre-wrap"></p></div>`;
  chatArea.append(wrap);
  wrap.scrollIntoView({ block: "end", behavior: "smooth" });
  return wrap.querySelector(".mlp-ai-stream-text");
}

function appendTypingIndicator(doc) {
  const chatArea = doc.querySelector("main .max-w-md") || doc.querySelector("main");
  if (!chatArea) return null;
  if (!doc.getElementById("mlp-typing-anim")) {
    const s = doc.createElement("style"); s.id = "mlp-typing-anim";
    s.textContent = "@keyframes mlp-dot{0%,80%,100%{opacity:.2;transform:scale(.8)}40%{opacity:1;transform:scale(1.15)}}";
    doc.head.append(s);
  }
  const wrap = doc.createElement("div");
  wrap.id = "mlp-typing-indicator";
  wrap.className = "flex items-start gap-sm";
  wrap.innerHTML = `<div class="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0"><span class="material-symbols-outlined text-[18px] text-white opacity-90">bubble_chart</span></div><div class="chat-bubble-ai px-md py-sm shadow-sm border border-outline-variant/20" style="min-width:56px"><span style="display:inline-flex;gap:4px;align-items:center"><span style="width:6px;height:6px;border-radius:50%;background:var(--mlp-seed,#5B5147);animation:mlp-dot 1.2s infinite 0s"></span><span style="width:6px;height:6px;border-radius:50%;background:var(--mlp-seed,#5B5147);animation:mlp-dot 1.2s infinite .3s"></span><span style="width:6px;height:6px;border-radius:50%;background:var(--mlp-seed,#5B5147);animation:mlp-dot 1.2s infinite .6s"></span></span></div>`;
  chatArea.append(wrap);
  wrap.scrollIntoView({ block: "end", behavior: "smooth" });
  return wrap;
}

async function sendAiMessage(doc, userText) {
  appendAiUserMessage(doc, userText);
  aiChatHistory.push({ role: "user", content: userText });

  const input = doc.getElementById("mlp-ai-text");
  const sendBtn = doc.getElementById("mlp-ai-send");
  if (input) input.disabled = true;
  if (sendBtn) sendBtn.disabled = true;
  const typingEl = appendTypingIndicator(doc);

  try {
    const configuredProxy = await discoverServerBaseUrl();
    const isNativeShell = !!(window.Capacitor || location.protocol === "capacitor:" || location.protocol === "ionic:");
    const apiBase = configuredProxy || (!isNativeShell && window.location.origin ? window.location.origin : getDefaultServerBaseUrl());
    if (!apiBase) {
      throw new Error("未找到可用服务器，请确认 192.168.1.9 与手机在同一 Wi-Fi，并已启动 HTTPS/HTTP 服务。");
    }
    const chatPath = getServerConfig().chatPath || "/api/chat";
    const resp = await fetch(`${apiBase.replace(/\/$/, "")}${chatPath}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: aiChatHistory }),
    });

    typingEl?.remove();
    const streamTarget = appendAiBubble(doc);
    let fullText = "";

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: resp.statusText }));
      if (streamTarget) streamTarget.textContent = "⚠️ " + (err.error || "请求失败，请稍后重试");
    } else {
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop();
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") continue;
          try {
            const json = JSON.parse(raw);
            if (json.error) { if (streamTarget) streamTarget.textContent = "⚠️ " + json.error; break; }
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) {
              fullText += delta;
              if (streamTarget) {
                streamTarget.textContent = fullText;
                streamTarget.closest(".flex")?.scrollIntoView({ block: "end", behavior: "smooth" });
              }
            }
          } catch (_) {}
        }
      }
    }
    if (fullText) aiChatHistory.push({ role: "assistant", content: fullText });
  } catch (err) {
    typingEl?.remove();
    const st = appendAiBubble(doc);
    if (st) st.textContent = "⚠️ 网络错误：" + err.message;
  } finally {
    if (input) { input.disabled = false; input.focus(); }
    if (sendBtn) sendBtn.disabled = false;
  }
}
// 简单 HTML 转义，防止用户输入内容破坏页面结构。
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return map[char];
  });
}

// 地址栏 hash 改变时，重新加载对应 iframe 页面。
window.addEventListener("hashchange", () => routeTo(getRouteFromHash(), true));

// iframe 每次加载完成时，重新挂载当前页面需要的交互。
frame.addEventListener("load", wireFrameNavigation);

// app 首次启动：根据当前 hash 加载目标页面。
routeTo(getRouteFromHash(), true);
