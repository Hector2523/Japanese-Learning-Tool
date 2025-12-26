const swMessageP = document.querySelector('.sw .message');
if ('serviceWorker' in navigator) {
    console.log('Service Worker is supported');
    navigator.serviceWorker.register('/SW/auth.js', { scope: '/' })
        .then(reg => {
            console.log('Service Worker registered with scope:', reg.scope);
            swMessageP.textContent = 'Service Worker registered';
        })
        .catch(err => {
            console.error('Service Worker registration failed:', err);
            swMessageP.textContent = 'Service Worker registration failed: ' + (err && err.message ? err.message : err);
            document.body.classList.add('no-sw');
        });
    if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
            type: 'SYNC_USER_DATA',
        });
    }

    navigator.serviceWorker.addEventListener('message', event => {
        console.log('Service Worker message received:', event.data);
        if (event.data && event.data.type === 'USER_LOGGED') {
            sessionStorage.setItem('logged', 'true');
        } else if (event.data && event.data.type === 'LOGOUT') {
            cleanStorage();
        }
    });
} else {
    swMessageP.textContent = 'Service Worker not supported by this browser';
    document.body.classList.add('no-sw');
}

function cleanStorage() {
    sessionStorage.clear();
    
    localStorage.clear();

    caches.keys().then(cacheNames => {
        cacheNames.forEach(cacheName => {
            caches.delete(cacheName);
        });
    });
}
