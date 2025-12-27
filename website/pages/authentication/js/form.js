document.addEventListener('DOMContentLoaded', () => {
    let alreadyLoggedIn = false;

    if(sessionStorage.getItem('logged') === 'true') {
        alreadyLoggedIn = true;
    }

    const form = document.querySelector('aside.container form');
    if (!form) return;

    let reqType = 'login';
    const ID = document.getElementById('ID');
    const password = document.getElementById('password');
    const submitBtn = document.getElementById('submit-btn');
    const submitErrorP = document.querySelector('.submit .error-message');
    const signUpCont = document.querySelector('p.signup');
    const loginCont = document.querySelector('p.login');
    const title = document.title = 'JP Learn';
    const urlQuery = new URLSearchParams(window.location.search);

    if (urlQuery.has('page') && urlQuery.get('page') === 'register') {
        document.title = title + ' - Register';
        submitBtn.textContent = 'Register';
        signUpCont.remove();
        reqType = 'register';
    } else {
        document.title = title + ' - Login';
        submitBtn.textContent = 'Login';
        loginCont.remove();
        reqType = 'login';
    }

    console.log(urlQuery)

    const getContainer = (el) => el && el.closest('.container');
    const getErrorP = (container) => container && container.querySelector('.error-message');
    const getMessageSpan = (container) => container && container.querySelector('.message');

    const setError = (container, message) => {
        const p = getErrorP(container);
        const msg = getMessageSpan(container);
        const input = container && container.querySelector('input');
        if (!p || !msg) return;

        msg.textContent = message || '';
        if (message) {
            p.classList.remove('hidden');
            msg.setAttribute('title', message);
            if (input) input.setAttribute('aria-invalid', 'true');
        } else {
            p.classList.add('hidden');
            msg.removeAttribute('title');
            if (input) input.removeAttribute('aria-invalid');
        }
    };

    const validateID = () => {
        const container = getContainer(ID);
        const val = (ID.value || '').trim();
        if (val.length < 3) {
            setError(container, 'ID must be at least 3 character');
            return false;
        }
        setError(container, '');
        return true;
    };

    const validatePassword = () => {
        const container = getContainer(password);
        const val = (password.value || '').trim();
        if (val.length < 5) {
            setError(container, 'API Key must be at least 5 characters');
            return false;
        }
        setError(container, '');
        return true;
    };

    const attachClearOnInput = (input, validateFn) => {
        if (!input) return;
        const handler = () => {
            if (validateFn()) {
                input.removeEventListener('input', handler);
                if (submitErrorP) {
                    const submitMsg = submitErrorP.querySelector('.message');
                    const IDInvalid = ID && ID.getAttribute('aria-invalid') === 'true';
                    const passInvalid = password && password.getAttribute('aria-invalid') === 'true';
                    if (!IDInvalid && !passInvalid) {
                        submitMsg.textContent = '';
                        submitErrorP.classList.add('hidden');
                    }
                }
            }
        };
        input.addEventListener('input', handler);
    };

    form.addEventListener('submit', async (ev) => {
        const init = performance.now();
        ev.preventDefault();
        const okID = validateID();
        const okPass = validatePassword();
        if (!okID || !okPass) {
            console.log(submitErrorP)
            if (submitErrorP) {
                return;
            }

            if (!okID) attachClearOnInput(ID, validateID);
            if (!okPass) attachClearOnInput(password, validatePassword);

            const firstInvalid = form.querySelector('input[aria-invalid="true"]');
            if (firstInvalid) firstInvalid.focus();
        } else {
            if (submitErrorP) {
                const submitMsg = submitErrorP.querySelector('.message');
                submitMsg.textContent = '';
                submitErrorP.classList.add('hidden');
            }
        }


        const idVal = (ID.value || '').trim();
        const apiKeyRaw = (password.value || '').trim();


        const networkStart = performance.now();
        try {
            const data = await validateAndSubmit(idVal, apiKeyRaw, reqType);
            const networkEnd = performance.now();
            console.log(`Network roundtrip: ${networkEnd - networkStart} ms`);

            console.warn(data);
            if (data && data.code === 200) {
                try {
                    localStorage.setItem('encryptedKey', data.encryptedKey);
                    localStorage.setItem('userData', JSON.stringify(data.userData));
                } catch (e) {
                    console.warn('Could not write to localStorage', e);
                }

                if (navigator.serviceWorker) {
                    try {
                        if (navigator.serviceWorker.controller) {
                            navigator.serviceWorker.controller.postMessage({ type: 'SET_TOKEN', token: data.encryptedKey });
                        } else if (navigator.serviceWorker.getRegistration) {
                            navigator.serviceWorker.getRegistration().then(reg => {
                                if (reg && reg.active) reg.active.postMessage({ type: 'SET_TOKEN', token: data.encryptedKey });
                            }).catch(() => { });
                        }
                    } catch (e) {
                        console.warn('Could not postMessage to Service Worker', e);
                    }
                }

                (async () => {
                    try {
                        await persistUser(data.encryptedKey, data.userData);
                        window.location.href = '/';
                        console.log('Background persist completed');
                    } catch (err) {
                        console.warn('Background persist failed:', err);
                    }
                })();

                await sessionStorage.setItem('logged', 'true');

                return;
            } else {
                if (submitErrorP) {
                    const submitMsg = submitErrorP.querySelector('.message');
                    submitMsg.textContent = (data && (data.errType)) || 'An error occurred';
                    console.error(data && data.message);
                    submitErrorP.classList.remove('hidden');
                }
            }
        } catch (err) {
            if (submitErrorP) {
                console.error(err);
                const submitMsg = submitErrorP.querySelector('.message');
                submitMsg.textContent = err && err.message === 'Invalid API Key' ? 'Invalid API Key' : 'Network error';
                submitErrorP.classList.remove('hidden');
            }
        }

        const end = performance.now();
        console.log(`Form total time (incl. UI work): ${Math.round(end - init)} ms`);
    });

    async function validateAndSubmit(idVal, apiKey, reqType) {
        const submitResp = await fetch(`/api/auth/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: reqType.toLocaleUpperCase(),
                ID: idVal,
                apiKey: apiKey
            })
        });

        if (!submitResp.ok) {
            const text = await submitResp.text();
            let data = null;
            try { data = JSON.parse(text); } catch (e) { data = { message: text }; }
            return data || { code: submitResp.status, message: text };
        }

        return await submitResp.json();
    }

    function persistUser(encryptedKey, userData) {
        return new Promise(async (resolve, reject) => {
            try {
                const prev = localStorage.getItem('encryptedKey');
                if (prev !== encryptedKey) {
                    localStorage.setItem('encryptedKey', encryptedKey);
                } else {
                    console.debug('encryptedKey unchanged; not updating localStorage');
                }
            } catch (e) {
                console.warn('Could not write encryptedKey to localStorage', e);
            }

            const payload = { encryptedKey, userData };
            const json = JSON.stringify(payload, null, 2);
            const resp = new Response(json, { headers: { 'Content-Type': 'application/json' } });

            if (typeof caches !== 'undefined' && caches.open) {
                try {
                    const cache = await caches.open('user-data');
                    const existingResp = await cache.match('/user-info.json');

                    if (existingResp) {
                        try {
                            const existingText = await existingResp.text();
                            if (existingText === json) {
                                console.log('persistUser: cached data identical; skipping write');
                                return resolve();
                            } else {
                                await cache.delete('/user-info.json');
                            }
                        } catch (err) {
                            console.warn('persistUser: error reading existing cached response:', err);
                        }
                    }

                    await cache.put('/user-info.json', resp);
                    console.log('persistUser: cached user data successfully');

                    try {
                        localStorage.removeItem('userData');
                        console.log('persistUser: removed userData from localStorage (using cache instead)');
                    } catch (e) {
                        console.warn('Could not remove userData from localStorage', e);
                    }

                    return resolve();

                } catch (err) {
                    console.warn('persistUser: cache write failed, falling back to localStorage', err);

                    try {
                        localStorage.setItem('userData', JSON.stringify(userData));
                        console.log('persistUser: saved userData to localStorage as fallback');
                        return resolve();
                    } catch (e) {
                        console.error('persistUser: localStorage fallback failed', e);
                        return reject(e);
                    }
                }
            } else {
                console.warn('persistUser: Cache API not available, using localStorage');
                try {
                    localStorage.setItem('userData', JSON.stringify(userData));
                    return resolve();
                } catch (e) {
                    console.error('persistUser: localStorage write failed', e);
                    return reject(e);
                }
            }
        });
    }

    document.querySelectorAll('.error-message').forEach(p => {
        p.setAttribute('aria-live', 'polite');
        const msg = p.querySelector('.message');
        if (!msg || !msg.textContent.trim()) p.classList.add('hidden');
    });

    if (alreadyLoggedIn) return location.href = '/';
});