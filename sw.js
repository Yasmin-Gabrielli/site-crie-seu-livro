const CACHE_NAME = 'fanfic-app-v1';

// Recurso essenciais para pré-cache offline
const PRECACHE_ASSETS = [
    './',
    './index.html',
    './stories.html',
    './about.html',
    './contact.html',
    './privacy.html',
    './submit.html',
    './terms.html',
    './styles.css',
    './app.js',
    './pwa.js',
    './manifest.json',
    './icons/icon.svg',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/apple-touch-icon.png',
    // CDNs Essenciais
    'https://cdn.jsdelivr.net/npm/@tiptap/core@latest/dist/tiptap.core.js',
    'https://cdn.jsdelivr.net/npm/@tiptap/starter-kit@latest/dist/tiptap.starter-kit.js',
    'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
    'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
    'https://cdn.jsdelivr.net/npm/localforage@1.10.0/dist/localforage.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
    'https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Instalando Service Worker e fazendo pré-cache...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // Usando Promise.allSettled para garantir a instalação mesmo se uma CDN falhar temporariamente
            return Promise.allSettled(
                PRECACHE_ASSETS.map(url => 
                    fetch(url, { mode: 'cors' })
                        .then(response => {
                            if (response.ok) {
                                return cache.put(url, response);
                            }
                        })
                        .catch(err => console.warn(`[Service Worker] Falha ao pré-cachear ${url}:`, err))
                )
            );
        }).then(() => self.skipWaiting())
    );
});

// Ativação e limpeza de caches antigos
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Ativando novo Service Worker...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Removendo cache antigo:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Estratégia de requisições: Cache First com atualização em background (Stale-While-Revalidate)
self.addEventListener('fetch', (event) => {
    // Ignorar esquemas não HTTP/HTTPS (ex: chrome-extension)
    if (!event.request.url.startsWith('http')) return;

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                // Tentar atualizar em background se for da mesma origem
                fetch(event.request)
                    .then((networkResponse) => {
                        if (networkResponse && networkResponse.status === 200) {
                            caches.open(CACHE_NAME).then((cache) => {
                                cache.put(event.request, networkResponse.clone());
                            });
                        }
                    })
                    .catch(() => {/* Silencioso se estiver offline */});

                return cachedResponse;
            }

            // Não está no cache, buscar na rede e guardar no cache para uso offline futuro
            return fetch(event.request)
                .then((networkResponse) => {
                    if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' && networkResponse.type !== 'cors') {
                        return networkResponse;
                    }

                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });

                    return networkResponse;
                })
                .catch(() => {
                    // Se estiver offline e requisitar uma página HTML, redireciona para index.html do cache
                    if (event.request.mode === 'navigate' || (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'))) {
                        return caches.match('./index.html');
                    }
                });
        })
    );
});
