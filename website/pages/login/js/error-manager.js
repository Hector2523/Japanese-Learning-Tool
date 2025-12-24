document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('aside.container form');
    if (!form) return;

    const username = document.getElementById('username');
    const password = document.getElementById('password');
    const submitErrorP = document.querySelector('.submit .error-message');
    const title = document.title;
    const urlQuery = new URLSearchParams(window.location.search);

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

    const validateUsername = () => {
        const container = getContainer(username);
        const val = (username.value || '').trim();
        if (val.length < 3) {
            setError(container, 'Username must be at least 3 character');
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
                    const userInvalid = username && username.getAttribute('aria-invalid') === 'true';
                    const passInvalid = password && password.getAttribute('aria-invalid') === 'true';
                    if (!userInvalid && !passInvalid) {
                        submitMsg.textContent = '';
                        submitErrorP.classList.add('hidden');
                    }
                }
            }
        };
        input.addEventListener('input', handler);
    };

    form.addEventListener('submit', (ev) => {
        const okUser = validateUsername();
        const okPass = validatePassword();
        if (!okUser || !okPass) {
            ev.preventDefault();
            if (submitErrorP) {
                return;
            }

            if (!okUser) attachClearOnInput(username, validateUsername);
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
        console.warn('Validation passed, submitting form');
    });

    document.querySelectorAll('.error-message').forEach(p => {
        p.setAttribute('aria-live', 'polite');
        const msg = p.querySelector('.message');
        if (!msg || !msg.textContent.trim()) p.classList.add('hidden');
    });
});