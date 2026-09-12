/* まめまる — オフライン用 Service Worker
 *
 * ■ 大事なこと（更新のとき）
 *   ゲーム本体（index.html）は「まずネットから、つながらなければキャッシュから」で動きます。
 *   なので index.html を差し替えるだけで、次にオンラインで開いた人には新しい版が届きます。
 *   ★ VERSION を上げる必要はありません。上げ忘れても事故りません。
 *   （VERSION が効くのは、めったに変えないアイコンと manifest だけです）
 */
const VERSION = "v27";   // v27: manifest の 説明文から「ひよこ」を 消した
const CACHE = "mamemaru-" + VERSION;

/* オフラインでも遊べるように、最初に取っておくファイル */
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-1024.png",
  "./icons/icon-maskable-512.png",
  "./icons/icon-180.png",
  "./icons/icon-152.png",
  "./icons/icon-120.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      // 1枚ずつ入れる。アイコンを1つ消したりリネームしても、install 全体が
      // 失敗してオフライン機能が丸ごと死ぬ、ということが起きない
      .then(c => Promise.all(ASSETS.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* ゲーム本体かどうか（アドレスを開く動作か、index.html そのものか） */
function isPage(req){
  if (req.mode === "navigate") return true;
  const u = new URL(req.url);
  return u.pathname.endsWith("/") || u.pathname.endsWith("/index.html");
}

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;   // よそのサイトには 手を出さない

  if (isPage(e.request)){
    /* ゲーム本体 … まずネット。だめならキャッシュ（＝オフラインでも遊べる） */
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res && res.status === 200){
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put("./index.html", copy));
          }
          return res;
        })
        .catch(() => caches.match("./index.html", { ignoreSearch: true })
                       .then(hit => hit || caches.match("./", { ignoreSearch: true })))
    );
    return;
  }

  /* アイコンや manifest … キャッシュ優先（ほとんど変わらないので） */
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => {
      if (hit) return hit;
      return fetch(e.request)
        .then(res => {
          if (res && res.status === 200 && res.type === "basic"){
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => hit);
    })
  );
});
