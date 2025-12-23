const registerBtn = document.querySelector('header button.register');
const loginBtn = document.querySelector('header button.login');

loginBtn.addEventListener('click', () => {
    location.href = '/login';
})