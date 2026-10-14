const CACHE = "zw-v1";
const ASSETS = ["./", "./index.html", "./manifest.json", "./icon-180.png", "./icon-512.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return Promise.all(ASSETS.map(function (u) {
        return c.add(new Request(u, { cache: "reload" })).catch(function () { });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (ks) {
      return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  const req = e.request;
  if (req.method !== "GET") return;
  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;

  // 打开页面：先走网络（保证每次都是最新版），断网了才用缓存
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(new Request(req.url, { cache: "reload" })).then(function (resp) {
        const copy = resp.clone();
        caches.open(CACHE).then(function (c) { c.put("./index.html", copy); }).catch(function () { });
        return resp;
      }).catch(function () {
        return caches.match("./index.html").then(function (h) { return h || caches.match("./"); });
      })
    );
    return;
  }

  // 图标、清单这些：先用缓存（秒开），同时后台悄悄更新
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function (hit) {
      const net = fetch(req).then(function (resp) {
        if (resp && resp.status === 200) {
          const copy = resp.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); }).catch(function () { });
        }
        return resp;
      }).catch(function () { return hit; });
      return hit || net;
    })
  );
});
