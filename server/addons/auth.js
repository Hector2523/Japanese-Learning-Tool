const fs = require('fs/promises');
const path = require('path');
const WaniKaniFetcher = require('./wanikani');

async function verifyUser(apiKey) {
    try {
        await fs.access(path.join(__dirname, '..', 'usersData', `${apiKey}.json`));
        return true;
    } catch (err) {
        return false;
    }
}

async function registerUser(encryptedKey, rawKey, ID) {
    try {
        const directoryPath = path.join(__dirname, '..', 'usersData');
        await fs.mkdir(directoryPath, { recursive: true });
        let WKData;
        const fetcher = new WaniKaniFetcher(rawKey, [
                    'summary',
                    'subjects',
                    'assignments',
                    'level_progressions',
                    'review_statistics',
                    'study_materials',
                    'voice_actors',
                ], 'GET');
        await fetcher.init().then(results => {
            WKData = results;
        });

        await fs.writeFile(path.join(directoryPath, `${encryptedKey}.json`), JSON.stringify({
            Public: {
                ID: ID, WaniKaniData: WKData
            },
            Private: { apiKeys: { WaniKani: rawKey } }
        }, null, 2), 'utf-8');

        return true;
    } catch (err) {
        console.error('Error writing user file:', err);
        return false;
    }
}

async function loggingUser(apiKey, username) {
    try {
        const raw = await fs.readFile(path.join(__dirname, '..', 'usersData', `${apiKey}.json`), 'utf-8');
        const userData = JSON.parse(raw);
        if (!userData) {
            return false;
        } else if (userData.Public.ID !== username) {
            console.warn(`Username mismatch: expected ${userData.ID}, got ${username}`);
            return "Invalid Username";
        }
        console.log('User data found:', userData);
        return userData.Public;
    } catch (err) {
        console.error('Error reading user file:', err);
        return false;
    }
}

async function validateWaniKaniKey(rawKey, timeoutMs = 5000) {
    const controller = new AbortController();
    const start = Date.now();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const resp = await fetch('https://api.wanikani.com/v2/user', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${rawKey}` },
            signal: controller.signal
        });
        const dur = Date.now() - start;
        console.log(`WaniKani validation took ${dur}ms, status: ${resp.status}`);
        if (!resp.ok) {
            return { ok: false, status: resp.status, message: 'Invalid API Key' };
        }
        const data = await resp.json();
        return { ok: true, status: resp.status, data };
    } catch (err) {
        const dur = Date.now() - start;
        if (err.name === 'AbortError') {
            console.error(`WaniKani validation timed out after ${dur}ms`);
            return { ok: false, timeout: true, message: 'Timeout' };
        }
        console.error('Network error validating API key:', err, `after ${dur}ms`);
        return { ok: false, networkError: true, message: 'Network error' };
    } finally {
        clearTimeout(timeoutId);
    }
}

module.exports = {
    verifyUser,
    registerUser,
    loggingUser,
    validateWaniKaniKey
};
