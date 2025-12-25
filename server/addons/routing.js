const fs = require('fs/promises');
const path = require('path');
const express = require('express');

module.exports = async function registerRoutes(app) {
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use('/styles', express.static(path.join(__dirname, '..', '..', 'website', 'styles')));
    app.use('/js', express.static(path.join(__dirname, '..', '..', 'website', 'js')));
    app.use('/login', express.static(path.join(__dirname, '..', '..', 'website', 'pages', 'authentication')));

    app.get('/register', (req, res) => res.redirect('/login?page=register'));

    async function verifyUser(apiKey) {
        try {
            await fs.access(path.join(__dirname, '..', 'usersData', `${apiKey}.json`));
            return true;
        } catch (err) {
            return false;
        }
    }

    async function registerUser(apiKey, ID) {
        try {
            await fs.writeFile(path.join(__dirname, '..', 'usersData', `${apiKey}.json`), JSON.stringify({
                ID: ID,
                apiKey: apiKey
            }, null, 2), 'utf-8');
            return true;
        } catch (err) {
            console.error('Error writing user file:', err);
            return false;
        }
    }

    async function loggingUser(apiKey) {
        try {
            const raw = await fs.readFile(path.join(__dirname, '..', 'usersData', `${apiKey}.json`), 'utf-8');
            const userData = JSON.parse(raw);
            if (!userData) {
                return false;
            }
            console.log('User data found:', userData);
            return userData;
        } catch (err) {
            console.error('Error reading user file:', err);
            return false;
        }
    }

    app.use((req, res, next) => {
        const host = req.get('Host');
        const origin = req.get('Origin');

        if (origin && origin !== `http://${host}` && origin !== `https://${host}`) {
            return res.status(403).send('Forbidden: Requisição de origem não permitida');
        }

        console.log('Request received', req.originalUrl);
        next();
    });

    app.post('/api/auth', async (req, res) => {
        try {
            console.log('Serving authentication page');
            console.log(req.body);
            if (!req.body || !req.body.type || !req.body.ID || !req.body.apiKey) {
                return res.status(400).send({ code: 500, errType: 'Bad Request', message: 'Bad Request: Missing type, ID or apiKey' });
            }

            if (req.body.type == 'LOGIN') {
                const exists = await verifyUser(req.body.apiKey);
                if (exists) {
                    const loggingResult = await loggingUser(req.body.apiKey);

                    if (!loggingResult) {
                        return res.status(500).send({ code: 500, errType: 'Server error', message: 'Could not read user data' });
                    }
                    return res.status(200).send({ code: 200, message: 'Authentication successful', userData: loggingResult });
                }

                const registered = await registerUser(req.body.apiKey, req.body.ID);
                if (!registered) {
                    return res.status(500).send({ code: 500, errType: 'Registration failed', message: 'Registration failed during login' });
                }
                console.log('User registered during login:', req.body.ID);
                const loggingResult = await loggingUser(req.body.apiKey);
                if (!loggingResult) {
                    return res.status(500).send({ code: 500, errType: 'Server error', message: 'Could not read user data' });
                }
                return res.status(200).send({ code: 200, message: 'Authentication successful', userData: loggingResult });

            } else if (req.body.type == 'REGISTER') {
                let userExists = await verifyUser(req.body.apiKey);
                if (userExists) {
                    console.log('Login attempt with existing API key:', req.body.apiKey);
                    const loggingResult = await loggingUser(req.body.apiKey);
                    if (!loggingResult) {
                        return res.status(500).send({ code: 500, errType: 'Server error', message: 'Could not read user data' });
                    }
                }
                const registered = await registerUser(req.body.apiKey, req.body.ID);
                if (!registered) return res.status(500).send({ code: 500, errType: 'Registration failed', message: 'Registration failed due to server error' });
                return res.status(200).send({ code: 200, message: 'Registration successful' });
            } else {
                return res.status(400).send({ code: 500, errType: 'Bad Request', message: 'Bad Request: invalid type' });
            }

        } catch (err) {
            console.log(err);
            res.status(500).send(err.message);
        }
    });

    app.get('/login', async (req, res) => {
        try {
            const filePath = path.join(__dirname, '..', '..', 'website', 'pages', 'login', 'index.html');
            const data = await fs.readFile(filePath, 'utf-8');
            res.status(200).send(data);
        } catch (err) {
            console.log(err);
            res.status(500).send(err.message);
        }
    });

    app.get('/', async (req, res) => {
        try {
            const filePath = path.join(__dirname, '..', '..', 'website', 'index.html');
            const data = await fs.readFile(filePath, 'utf-8');
            res.status(200).send(data);
        } catch (err) {
            console.log(err);
            res.status(500).send(err.message);
        }
    });

    app.use((req, res) => {
        res.redirect('/');
    });
};