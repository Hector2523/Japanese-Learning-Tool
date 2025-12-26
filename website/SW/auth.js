const SW_VERSION = 1;
const USER_DATA_CACHE = 'user-data';

let inMemoryToken = null;

self.addEventListener('install', event => {
    console.log(`Service Worker v${SW_VERSION} installing...`);
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    console.log(`Service Worker v${SW_VERSION} activating...`);
    event.waitUntil((async () => {
        await self.clients.claim();

        try {
            const cache = await caches.open(USER_DATA_CACHE);
            const cached = await cache.match('/user-info.json');

            if (cached) {
                try {
                    const payload = await cached.json();
                    if (payload && payload.encryptedKey) {
                        inMemoryToken = payload.encryptedKey;
                        console.log('SW: cached payload:', payload);

                        syncUserData(payload.encryptedKey, payload.userData?.ID);
                        console.log('SW: rehydrated token from cache during activate');
                    } else {
                        console.log('SW: user-info.json found but no encryptedKey present');
                    }
                } catch (e) {
                    console.warn('SW: failed to parse cached user-info.json on activate', e);
                }
            } else {
                console.log('SW: no user-info.json in cache during activate');
            }
        } catch (e) {
            console.warn('SW: error reading cache during activate', e);
        }
    })());
});

self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    if (url.pathname === '/api/auth' || url.pathname === '/api/auth/') {
        return;
    }

    const isApiRequest = url.pathname.startsWith('/api/') && url.origin === self.location.origin;

    if (!isApiRequest) {
        return;
    }

    event.respondWith((async () => {
        const clonedRequest = request.clone();

        try {
            if (!inMemoryToken) {
                try {
                    const cache = await caches.open(USER_DATA_CACHE);
                    const cached = await cache.match('/user-info.json');

                    if (cached) {
                        const payload = await cached.json();
                        if (payload && payload.encryptedKey) {
                            inMemoryToken = payload.encryptedKey;
                            console.log('SW: rehydrated token from cache during fetch');
                        }
                    }
                } catch (e) {
                    console.warn('SW: failed to rehydrate token during fetch', e);
                }
            }

            return await makeAuthenticatedRequest(request, inMemoryToken);

        } catch (error) {
            console.warn('SW: error during fetch interception, falling back to normal request', error);

            try {
                return await fetch(clonedRequest);
            } catch (fetchError) {
                console.error('SW: fallback fetch also failed', fetchError);
                return new Response(
                    JSON.stringify({
                        error: 'Network error',
                        message: fetchError.message
                    }),
                    {
                        status: 503,
                        headers: { 'Content-Type': 'application/json' }
                    }
                );
            }
        }
    })());
});

async function makeAuthenticatedRequest(request, token) {
    try {
        const headers = new Headers(request.headers);

        if (token) {
            headers.set('Authorization', `Bearer ${token}`);
            console.log('SW: injected Authorization header');
        } else {
            console.log('SW: no token available, proceeding without auth');
        }

        const requestInit = {
            method: request.method,
            headers: headers,
            mode: request.mode,
            credentials: request.credentials,
            cache: request.cache,
            redirect: request.redirect,
            referrer: request.referrer,
            integrity: request.integrity
        };

        if (request.method !== 'GET' && request.method !== 'HEAD') {
            requestInit.body = request.body;
            requestInit.duplex = 'half';
        }

        const modifiedRequest = new Request(request.url, requestInit);

        const response = await fetch(modifiedRequest);
        console.log(`SW: API request completed with status ${response.status}`);
        return response;

    } catch (error) {
        console.error('SW: makeAuthenticatedRequest failed', error);
        throw error;
    }
}

self.addEventListener('message', event => {
    console.log(`Service Worker v${SW_VERSION} received message:`, event.data);

    try {
        const { type, token } = event.data || {};

        if (type === 'SET_TOKEN' && token) {
            inMemoryToken = token;
            console.log('SW: token updated via postMessage');
        }

        if (type === 'CLEAR_TOKEN') {
            inMemoryToken = null;
            console.log('SW: token cleared');
        }

        if (type === 'SYNC_USER_DATA') {
            console.log('SW: manual sync requested');
            caches.open(USER_DATA_CACHE).then(async cache => {
                const cached = await cache.match('/user-info.json');
                const file = cached ? await cached.json() : null;
                const oldData = file ? file.userData : null;
                const key = file ? file.encryptedKey : null;
                if (key && oldData) {
                    syncUserData(key, oldData.ID);
                }
            });
        }
    } catch (e) {
        console.warn('SW message handler error', e);
    }
});

async function syncUserData(encryptedKey, username) {

    if (!username) {
        console.warn('SW: cannot sync without username');
        return;
    }

    console.log('SW: synchronizing user data from server for user:', username);
    const allClients = await self.clients.matchAll();

    try {
        const response = await fetch('/api/user/data', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${encryptedKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ID: username })
        });

        if (!response.ok) {
            console.warn(`SW: sync failed with status ${response.status}`);
            inMemoryToken = null;
            allClients.forEach(client => {
                client.postMessage({ type: 'LOGOUT' });
            });
            return;
        }

        const data = await response.json();

        if (data && data.userData) {
            console.log('SW: synchronized user data from server');

            const cache = await caches.open(USER_DATA_CACHE);
            const payload = { encryptedKey, userData: data.userData };
            const json = JSON.stringify(payload, null, 2);
            const resp = new Response(json, {
                headers: { 'Content-Type': 'application/json' }
            });

            if (payload.userData === 'Invalid Username') {
                console.warn('SW: username invalid during sync, clearing token');
                inMemoryToken = null;
                allClients.forEach(client => {
                    client.postMessage({ type: 'LOGOUT' });
                });
                return;
            }

            await cache.put('/user-info.json', resp);

            allClients.forEach(client => {
                client.postMessage({ type: 'USER_LOGGED', userData: data.userData });
            });

            inMemoryToken = encryptedKey;
            console.log('SW: updated cache with fresh user data');
        } else {
            console.warn('SW: sync response missing userData');
        }

        return true;

    } catch (err) {
        console.warn('SW: failed to synchronize user data', err);
        return false;
    }
}