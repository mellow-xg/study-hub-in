const CACHE_VERSION = "studyhub-cache-v1";
const APP_CACHE = CACHE_VERSION + "-app";
const FILE_CACHE = CACHE_VERSION + "-files";
const MAX_FILE_ENTRIES = 30;

const APP_SHELL = ["/", "/offline"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_CACHE)
      .then(async (cache) => {
        for (const path of APP_SHELL) {
          try { await cache.add(path); } catch {}
        }
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== APP_CACHE && key !== FILE_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isDocumentProxy(url) {
  return url.origin === self.location.origin && url.pathname === "/api/document";
}

function isStaticAsset(url) {
  return (
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/_next/static/") ||
      url.pathname.startsWith("/icons/") ||
      /\.(?:css|js|png|jpg|jpeg|webp|svg|ico|woff2?)$/i.test(url.pathname))
  );
}

async function trimFileCache() {
  const cache = await caches.open(FILE_CACHE);
  const keys = await cache.keys();
  if (keys.length <= MAX_FILE_ENTRIES) return;
  for (const request of keys.slice(0, keys.length - MAX_FILE_ENTRIES)) {
    await cache.delete(request);
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (isDocumentProxy(url)) {
    event.respondWith(
      caches.open(FILE_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        try {
          const network = await fetch(request);
          const type = network.headers.get("content-type") || "";
          if (network.ok && /application\/pdf|image\//i.test(type)) {
            await cache.put(request, network.clone());
            await trimFileCache();
          }
          return network;
        } catch {
          return cached || new Response("This file is not available offline.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" }
          });
        }
      })
    );
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(APP_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const network = await fetch(request);
        if (network.ok) await cache.put(request, network.clone());
        return network;
      })
    );
    return;
  }

  if (request.mode === "navigate" && url.origin === self.location.origin) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(APP_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match("/offline");
        })
    );
  }
});

