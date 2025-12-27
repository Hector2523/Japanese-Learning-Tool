document.addEventListener('DOMContentLoaded', () => {
    let loggedIn = false;
    try {
        const isLogged = sessionStorage.getItem('logged');
        if (isLogged === 'true') {
            loggedIn = true;
        }
    } catch (e) {
        console.warn('Error checking login status', e);
    }

    if (loggedIn) {
        const unloggedElements = document.querySelectorAll('.unlogged');
        unloggedElements.forEach(el => el.style.display = 'none');
        return;
    }

    const loggedElements = document.querySelectorAll('.logged');
    loggedElements.forEach(el => el.style.display = 'none');

    const registerBtn = document.querySelector('header button.register');
    const loginBtn = document.querySelector('header button.login');

    if (loginBtn) loginBtn.addEventListener('click', () => { location.href = '/login'; });
    if (registerBtn) registerBtn.addEventListener('click', () => { location.href = '/register'; });

    (async () => {
        try {
            const encryptedKey = localStorage.getItem('encryptedKey');
            const userDataRaw = localStorage.getItem('userData');
            if (!encryptedKey || !userDataRaw) return;

            if (navigator.serviceWorker) {
                try {
                    if (navigator.serviceWorker.controller) {
                        navigator.serviceWorker.controller.postMessage({ type: 'SET_TOKEN', token: encryptedKey });
                    } else if (navigator.serviceWorker.getRegistration) {
                        navigator.serviceWorker.getRegistration().then(reg => {
                            if (reg && reg.active) reg.active.postMessage({ type: 'SET_TOKEN', token: encryptedKey });
                        }).catch(() => {});
                    }
                } catch (e) {
                    console.warn('Could not postMessage to Service Worker for rehydrate', e);
                }
            }

            try {
                if (typeof caches !== 'undefined' && caches.open) {
                    const payload = { encryptedKey, userData: JSON.parse(userDataRaw) };
                    const json = JSON.stringify(payload, null, 2);
                    const resp = new Response(json, { headers: { 'Content-Type': 'application/json' } });
                    const cache = await caches.open('user-data');
                    const existing = await cache.match('/user-info.json');
                    if (existing) {
                        const existingText = await existing.text().catch(() => null);
                        if (existingText === json) {
                            return;
                        }
                        await cache.delete('/user-info.json');
                    }
                    await cache.put('/user-info.json', resp);
                    console.log('Rehydration: wrote /user-info.json to cache');
                }
            } catch (e) {
                console.warn('Rehydration: failed to write cache', e);
            }
        } catch (e) {
            console.warn('Rehydration: error', e);
        }
    })();

});