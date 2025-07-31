/*
 * Service Worker para permitir funcionamento offline básico e melhoria de
 * performance através de cache. Utiliza a estratégia cache-first para
 * recursos estáticos (HTML, CSS, JS) e network-first para outras requisições.
 */

const CACHE_NAME = 'controle-financeiro-cache-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/chart.min.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Apenas intercepta requisições GET
  if (request.method !== 'GET') {
    return;
  }
  // Estrutura cache-first para assets definidos
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(request)
        .then((response) => {
          // Armazena no cache cópias de recursos dinâmicos para futuras visitas
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => {
          // Em caso de falha de rede retorna a página principal do cache
          return caches.match('/index.html');
        });
    })
  );
});