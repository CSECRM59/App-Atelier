// Nom du cache avec une version pour forcer la mise à jour si besoin
const CACHE_NAME = 'cse-atelier-cache-v1'; // <<== CHANGEZ la version si MAJ majeure

// Fichiers essentiels à mettre en cache
const FILES_TO_CACHE = [
    './', // La racine (index.html)
    './index.html',
    './styles.css',
    './script.js',
    './manifest.json',
    './icons/favicon.ico',
    './icons/icon-192x192.png',
    './icons/icon-512x512.png',
    // Ajouter d'autres assets essentiels si nécessaire (logo.png ?)
    // './logo.png'
    // Les polices Google Fonts sont généralement mieux gérées par le cache navigateur/SW via fetch
];

// Installation : Mise en cache des fichiers essentiels
self.addEventListener('install', (event) => {
    console.log('[SW] Installation...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Mise en cache des fichiers essentiels');
            return cache.addAll(FILES_TO_CACHE);
        }).then(() => {
            // Forcer l'activation immédiate du nouveau Service Worker
            console.log('[SW] skipWaiting() appelé.');
            return self.skipWaiting();
        })
    );
});

// Activation : Nettoyer les anciens caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activation...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] Suppression de l\'ancien cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            // Prendre le contrôle des clients immédiatement
            console.log('[SW] clients.claim() appelé.');
            return self.clients.claim();
        })
    );
});

// Fetch : Stratégie Cache-First, puis Network avec mise en cache
self.addEventListener('fetch', (event) => {
    // Ne pas intercepter les requêtes non-GET ou vers Firebase/Google Fonts (pour éviter soucis)
    if (event.request.method !== 'GET' ||
        event.request.url.includes('firestore.googleapis.com') ||
        event.request.url.includes('google.com/recaptcha') || // si tu utilises recaptcha un jour
        event.request.url.includes('fonts.gstatic.com')) {
      // Laisser passer la requête normalement
      return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                //console.log('[SW] Ressource trouvée en cache:', event.request.url);
                return cachedResponse;
            }

            //console.log('[SW] Ressource non trouvée en cache, fetch réseau:', event.request.url);
            return fetch(event.request).then((networkResponse) => {
                // Vérifier si la réponse est valide avant de la mettre en cache
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    return networkResponse;
                }

                // Cloner la réponse car elle ne peut être consommée qu'une fois
                const responseToCache = networkResponse.clone();

                caches.open(CACHE_NAME).then((cache) => {
                    //console.log('[SW] Mise en cache de la nouvelle ressource:', event.request.url);
                    cache.put(event.request, responseToCache);
                });

                return networkResponse;
            }).catch(error => {
                console.warn('[SW] Erreur Fetch (Réseau indisponible?) :', error);
                // Optionnel: Renvoyer une page offline générique si en cache
                // return caches.match('/offline.html');
            });
        })
    );
});

// Écouter le message SKIP_WAITING envoyé depuis le client (bouton Mettre à jour)
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        console.log('[SW] Message SKIP_WAITING reçu, activation forcée.');
        self.skipWaiting();
    }
});