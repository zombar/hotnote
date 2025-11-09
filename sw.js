// Service Worker for hotnote
// Provides offline functionality by caching app assets

const CACHE_NAME = 'hotnote-v4';

// Install event - skip pre-caching, rely on runtime caching instead
// (Production files have hashed names that change with each build)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(() => {
      console.log('Service Worker installed, cache created');
      return self.skipWaiting(); // Activate immediately
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim()) // Take control immediately
  );
});

// Fetch event - network first, fallback to cache (for fresh content)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    // Try network first
    fetch(event.request)
      .then((response) => {
        // Check if valid response
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // Clone the response to cache it
        const responseToCache = response.clone();

        // Update cache with fresh content
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      })
      .catch(() => {
        // Network failed - try to serve from cache
        return caches.match(event.request).then((response) => {
          if (response) {
            return response;
          }
          // If both cache and network fail, show offline message
          return new Response('Offline - please check your connection', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
              'Content-Type': 'text/plain',
            }),
          });
        });
      })
  );
});
