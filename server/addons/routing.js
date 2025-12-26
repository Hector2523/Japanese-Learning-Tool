const fs = require('fs/promises');
const path = require('path');
const express = require('express');
const cryptoJS = require('crypto-js');

module.exports = async function registerRoutes(app) {
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use('/styles', express.static(path.join(__dirname, '..', '..', 'website', 'styles')));
    app.use('/js', express.static(path.join(__dirname, '..', '..', 'website', 'js')));
    app.use('/login', express.static(path.join(__dirname, '..', '..', 'website', 'pages', 'authentication')));
    app.use('/SW', express.static(path.join(__dirname, '..', '..', 'website', 'SW'), {
        setHeaders: (res, filePath) => {
            if (filePath.endsWith('.js')) {
                res.setHeader('Service-Worker-Allowed', '/');
            }
        }
    }));

    app.get('/register', (req, res) => res.redirect('/login?page=register'));

    const { verifyUser, registerUser, loggingUser, validateWaniKaniKey } = require('./auth');

    app.use((req, res, next) => {
        const host = req.get('Host');
        const origin = req.get('Origin');

        if (origin && origin !== `http://${host}` && origin !== `https://${host}`) {
            return res.status(403).send('Forbidden: Invalid Origin');
        }

        console.log('Request received', req.originalUrl);
        next();
    });

    app.post('/api/auth', async (req, res) => {
        try {
            console.log('Serving authentication page');
            console.log({ type: req.body && req.body.type, ID: req.body && req.body.ID });
            if (!req.body || !req.body.type || !req.body.ID || !req.body.apiKey) {
                return res.status(400).send({ code: 500, errType: 'Bad Request', message: 'Bad Request: Missing type, ID or apiKey' });
            }

            const rawKey = req.body.apiKey;
            const wanResult = await validateWaniKaniKey(rawKey);
            if (!wanResult.ok) {
                if (wanResult.timeout) {
                    return res.status(504).send({ code: 504, errType: 'Timeout', message: 'WaniKani validation timed out' });
                }
                if (wanResult.networkError) {
                    return res.status(502).send({ code: 502, errType: 'Network error', message: 'Failed to validate API Key' });
                }
                return res.status(401).send({ code: 401, errType: 'Invalid API Key', message: 'Invalid API Key' });
            }

            const hashedKey = cryptoJS.SHA256(rawKey).toString(cryptoJS.enc.Hex);

            if (req.body.type == 'LOGIN') {
                const tVerifyStart = Date.now();
                const exists = await verifyUser(hashedKey);
                console.log(`verifyUser took ${Date.now() - tVerifyStart}ms`);

                if (exists) {
                    const tLogStart = Date.now();
                    const loggingResult = await loggingUser(hashedKey, req.body.ID);
                    console.log(`loggingUser (existing) took ${Date.now() - tLogStart}ms`);

                    if (!loggingResult) {
                        return res.status(500).send({ code: 500, errType: 'Server error', message: 'Could not read user data' });
                    } else if (loggingResult === "Invalid Username") {
                        return res.status(409).send({ code: 409, errType: 'Username mismatch', message: 'API Key already registered with a different username' });
                    }
                    return res.status(200).send({ code: 200, message: 'Authentication successful', userData: loggingResult, encryptedKey: hashedKey });
                }

                const tRegisterStart = Date.now();
                const registered = await registerUser(hashedKey, rawKey, req.body.ID);
                console.log(`registerUser took ${Date.now() - tRegisterStart}ms`);
                if (!registered) {
                    return res.status(500).send({ code: 500, errType: 'Registration failed', message: 'Registration failed during login' });
                }
                console.log('User registered during login:', req.body.ID);
                const tLogStart2 = Date.now();
                const loggingResult = await loggingUser(hashedKey, req.body.ID);
                console.log(`loggingUser (after register) took ${Date.now() - tLogStart2}ms`);
                if (!loggingResult) {
                    return res.status(500).send({ code: 500, errType: 'Server error', message: 'Could not read user data' });
                } else if (loggingResult === "Invalid Username") {
                    return res.status(409).send({ code: 409, errType: 'Username mismatch', message: 'API Key already registered with a different username' });
                }
                return res.status(200).send({ code: 200, message: 'Authentication successful', userData: loggingResult, encryptedKey: hashedKey });

            } else if (req.body.type == 'REGISTER') {
                const tVerifyStart = Date.now();
                let userExists = await verifyUser(hashedKey);
                console.log(`verifyUser (register path) took ${Date.now() - tVerifyStart}ms`);

                if (userExists) {
                    console.log('Register attempt with existing API key', hashedKey);
                    const tExistingLog = Date.now();
                    const existingData = await loggingUser(hashedKey, req.body.ID);
                    console.log(`loggingUser (register existing) took ${Date.now() - tExistingLog}ms`);
                    if (!existingData) {
                        return res.status(500).send({ code: 500, errType: 'Server error', message: 'Could not read existing user data' });
                    } else if (existingData === "Invalid Username") {
                        return res.status(409).send({ code: 409, errType: 'Username mismatch', message: 'API Key already registered with a different username' });
                    }
                    return res.status(200).send({ code: 200, message: 'User already registered', userData: existingData, encryptedKey: hashedKey });
                }

                const tRegisterStart = Date.now();
                const registered = await registerUser(hashedKey, rawKey, req.body.ID);
                console.log(`registerUser (register path) took ${Date.now() - tRegisterStart}ms`);
                if (!registered) return res.status(500).send({ code: 500, errType: 'Registration failed', message: 'Registration failed due to server error' });

                const tLogStart = Date.now();
                const loggingResult = await loggingUser(hashedKey, req.body.ID);
                console.log(`loggingUser (after register) took ${Date.now() - tLogStart}ms`);
                if (!loggingResult) {
                    return res.status(500).send({ code: 500, errType: 'Server error', message: 'Could not read user data after registration' });
                }

                console.log('User registered:', req.body.ID);
                return res.status(200).send({ code: 200, message: 'Registration successful', userData: loggingResult, encryptedKey: hashedKey });
            } else {
                return res.status(400).send({ code: 500, errType: 'Bad Request', message: 'Bad Request: invalid type' });
            }

        } catch (err) {
            console.log(err);
            res.status(500).send(err.message);
        }
    });

    app.post('/api/user/data', async (req, res) => {
        try {
            console.log('Serving user data request');
            const authHeader = req.get('Authorization');
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).send({ code: 401, errType: 'Unauthorized', message: 'Missing or invalid Authorization header' });
            }
            const token = authHeader.slice(7).trim();
            const tLogStart = Date.now();
            console.log(req.body);
            const loggingResult = await loggingUser(token, req.body.ID);
            console.log(`loggingUser (user data) took ${Date.now() - tLogStart}ms`);

            if (!loggingResult) {
                return res.status(401).send({ code: 401, errType: 'Unauthorized', message: 'Invalid token' });
            }

            return res.status(200).send({ code: 200, message: 'User data retrieved successfully', userData: loggingResult });

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