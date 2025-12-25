document.addEventListener('DOMContentLoaded', () => {
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

    form.addEventListener('submit', (ev) => {
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
        const encryptedKey = encryptKey((password.value || '').trim());

        fetch(`/api/auth/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                type: reqType.toLocaleUpperCase(),
                ID: idVal,
                apiKey: encryptedKey
            })
        })
        .then(response => response.json())
        .then(data => {
            console.warn(data)
            if (data.code === 200) {
                // window.location.href = '/authsuccess';
            } else {
                if (submitErrorP) {
                    const submitMsg = submitErrorP.querySelector('.message');
                    submitMsg.textContent = data.errType || 'An error occurred';
                    console.error(data.message);
                    submitErrorP.classList.remove('hidden');
                }
            }
        })
        .catch(err => {
            if (submitErrorP) {
                console.error(err);
                const submitMsg = submitErrorP.querySelector('.message');
                submitMsg.textContent = 'Network error';
                submitErrorP.classList.remove('hidden');
            }
        });

        console.warn('Validation passed, submitting form');
    });

    document.querySelectorAll('.error-message').forEach(p => {
        p.setAttribute('aria-live', 'polite');
        const msg = p.querySelector('.message');
        if (!msg || !msg.textContent.trim()) p.classList.add('hidden');
    });

    function encryptKey(str) {
        let hash = 0;
        if (str.length === 0) return hash;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 32 bits
        }
        return hash;
    }
});