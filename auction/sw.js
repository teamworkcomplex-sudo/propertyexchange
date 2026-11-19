/* Property Exchange service worker.
   Scope is /propertyexchange/auction/ so a later Play Store TWA can use the same start URL.
   Same-origin HTML is network-first. Same-origin static files are cache-first.
   Firebase, Firestore, and Google auth requests are not intercepted or cached. */
const CACHE = "twc-auction-v1";
const SCOPE_PATH = "/propertyexchange/auction/";
const OFFLINE_URL = SCOPE_PATH + "offline.html";

const PRECACHE = [
  SCOPE_PATH,
  SCOPE_PATH + "index.html",
  OFFLINE_URL,
  SCOPE_PATH + "manifest.webmanifest",
  SCOPE_PATH + "favicon.png",
  SCOPE_PATH + "icon-192.png",
  SCOPE_PATH + "icon-512.png",
  SCOPE_PATH + "icon-maskable-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function isBlockedApi(url) {
  const host = url.hostname;
  return (
    host === "firestore.googleapis.com" ||
    host === "firebase.googleapis.com" ||
    host === "identitytoolkit.googleapis.com" ||
    host === "securetoken.googleapis.com" ||
    host === "accounts.google.com" ||
    host === "www.googleapis.com" ||
    host.endsWith(".googleapis.com") ||
    host.endsWith(".firebaseio.com") ||
    host.endsWith(".firebaseapp.com") ||
    host.endsWith(".web.app") ||
    host === "www.gstatic.com" ||
    host.endsWith(".gstatic.com") ||
    host.endsWith(".google.com")
  );
}

function isHtml(request, url) {
  if (request.mode === "navigate") return true;
  const accept = request.headers.get("accept") || "";
  if (accept.includes("text/html")) return true;
  return url.pathname.endsWith(".html") || url.pathname.endsWith("/");
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch (err) {
    return (await cache.match(request)) || (await cache.match(OFFLINE_URL)) || new Response("Offline", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const fresh = await fetch(request);
  if (fresh && fresh.ok) cache.put(request, fresh.clone());
  return fresh;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  let url;
  try { url = new URL(request.url); } catch (err) { return; }
  if (isBlockedApi(url)) return;
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(SCOPE_PATH)) return;
  if (url.pathname.endsWith("/sw.js")) return;

  if (isHtml(request, url)) {
    event.respondWith(networkFirst(request));
    return;
  }
  event.respondWith(cacheFirst(request));
});
