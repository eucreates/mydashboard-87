const CACHE = 'equilibrium-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@300;400;500;600&display=swap',
  'https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/9.22.2/firebase-database-compat.js'
];

// Install — cache core assets
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      // Cache local assets reliably; external CDN assets best-effort
      return cache.addAll(['/', '/manifest.json', '/icon-192.png', '/icon-512.png'])
        .catch(function() {});
    })
  );
  self.skipWaiting();
});

// Activate — clean up old caches
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) { return key !== CACHE; })
            .map(function(key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

// Fetch — network first for Firebase/API, cache first for everything else
self.addEventListener('fetch', function(e) {
  var url = e.request.url;

  // Always go to network for Firebase, Anthropic API, and font requests
  if (url.includes('firebaseio.com') ||
      url.includes('googleapis.com/identitytoolkit') ||
      url.includes('api.anthropic.com') ||
      url.includes('fonts.googleapis.com') ||
      url.includes('fonts.gstatic.com')) {
    e.respondWith(
      fetch(e.request).catch(function() {
        return new Response('', { status: 503 });
      })
    );
    return;
  }

  // Cache first for everything else (app shell, icons, Firebase SDK)
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      if (cached) return cached;
      return fetch(e.request).then(function(response) {
        // Cache successful GET responses
        if (e.request.method === 'GET' && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE).then(function(cache) {
            cache.put(e.request, clone);
          });
        }
        return response;
      }).catch(function() {
        // Offline fallback — return cached index for navigation requests
        if (e.request.mode === 'navigate') {
          return caches.match('/') || caches.match('/index.html');
        }
        return new Response('', { status: 503 });
      });
    })
  );
});
