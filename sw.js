const CACHE_NAME = 'daily-app-v7';
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/config.js',
  './js/util.js',
  './js/icons.js',
  './js/api.js',
  './js/confetti.js',
  './js/router.js',
  './js/lock.js',
  './js/main.js',
  './js/screens/home.js',
  './js/screens/morning.js',
  './js/screens/affirmations_admin.js',
  './js/screens/exercise.js',
  './js/screens/exercise_records.js',
  './js/screens/diary.js',
  './js/screens/diary_list.js',
  './js/screens/diary_calendar.js',
  './js/screens/notes.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Supabase API 호출은 항상 네트워크로 직접 보냄 (캐시하지 않음)
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // 네트워크 우선: 온라인이면 항상 최신 파일을 받아오고, 오프라인일 때만
  // 캐시로 대체한다 (설치된 앱이 배포 후에도 계속 예전 버전을 보여주던 문제 수정).
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
