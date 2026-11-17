/*
 * 最小离线壳：只做三件事。
 * 1. 导航请求网络优先，失败时回退到缓存过的 index.html；
 * 2. 数据 JSON 网络优先，失败时用上一次成功缓存（离线仍能完成演示问诊）；
 * 3. 带 hash 的静态资源缓存优先，避免反复下载。
 *
 * 不拦截 /api/*：中转失败就按原有逻辑降级到本地路由，绝不缓存接口响应。
 */
const VERSION = 'medrule-20261117085903'
// 构建时由 vite.config.js 替换成这次构建产出的 hash 资源清单。
const PRECACHE = ["/assets/CaseMapView-C-ic7QhS.js","/assets/CaseMapView-CAiB3JRw.css","/assets/HistoryCardView-DLmRHHht.css","/assets/HistoryCardView-DwDWhpIU.js","/assets/RecordResultView-BPD3nq1M.css","/assets/RecordResultView-C8ZCVzm0.js","/assets/RecordSourceView-BJYDMB5I.css","/assets/RecordSourceView-EJ0TTRVP.js","/assets/RecordWriteView-BirSQtCm.css","/assets/RecordWriteView-DbZmoJCg.js","/assets/ScoreCardView-BQbcQB0B.css","/assets/ScoreCardView-H_I8CcQJ.js","/assets/index-BCZy0S3L.css","/assets/index-PZaPn7Lt.js","/data/cases.json","/data/catalog.json","/data/diagnosis/abdominal_pain_01.json","/data/diagnosis/abdominal_pain_02.json","/data/diagnosis/chest_pain_01.json","/data/diagnosis/chest_pain_02.json","/data/diagnosis/cough_01.json","/data/diagnosis/flank_pain_01.json","/data/diagnosis/weakness_01.json","/data/record_reviews/abdominal_pain_01.json","/data/rules/abdominal_pain_01.json","/data/rules/abdominal_pain_02.json","/data/rules/chest_pain_01.json","/data/rules/chest_pain_02.json","/data/rules/cough_01.json","/data/rules/flank_pain_01.json","/data/rules/weakness_01.json","/data/scripts/abdominal_pain_01.json","/data/scripts/abdominal_pain_02.json","/data/scripts/chest_pain_01.json","/data/scripts/chest_pain_02.json","/data/scripts/cough_01.json","/data/scripts/flank_pain_01.json","/data/scripts/weakness_01.json","/index.html","/og-cover.svg"]
const SHELL_CACHE = `${VERSION}-shell`
const DATA_CACHE = `${VERSION}-data`
const ASSET_CACHE = `${VERSION}-assets`
const SHELL_URL = new URL('./index.html', self.location.href).href

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then(async (cache) => {
        // 单个文件失败不阻断整个安装；离线时缺哪个哪个降级。
        await Promise.all(
          [SHELL_URL, ...PRECACHE].map((url) =>
            cache.add(new Request(new URL(url, self.location.href), { cache: 'reload' })).catch(() => {}),
          ),
        )
      })
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  )
})

async function networkFirst(request, cacheName, fallbackUrl = null) {
  const cache = await caches.open(cacheName)
  try {
    const response = await fetch(request)
    if (response && response.ok) cache.put(request, response.clone())
    return response
  } catch {
    const cached = (await cache.match(request.url)) ?? (await caches.match(request.url))
    if (cached) return cached
    if (fallbackUrl) {
      const shell = await caches.match(fallbackUrl)
      if (shell) return shell
    }
    return new Response('离线且没有缓存页面，请联网后重新打开。', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = (await cache.match(request.url)) ?? (await caches.match(request.url))
  if (cached) return cached
  const response = await fetch(request)
  if (response && response.ok) cache.put(request, response.clone())
  return response
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.includes('/api/')) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, SHELL_CACHE, SHELL_URL))
    return
  }
  if (url.pathname.includes('/data/') || url.pathname.endsWith('.json')) {
    event.respondWith(networkFirst(request, DATA_CACHE))
    return
  }
  if (/\.(?:js|css|svg|png|jpe?g|webp|woff2?)(?:$|\?)/i.test(url.pathname)) {
    event.respondWith(cacheFirst(request, ASSET_CACHE))
  }
})
