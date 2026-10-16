const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const allowedOrigins = (process.env.ALLOWED_ORIGINS).split(',');
app.use(cors({
    origin: function(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    }
}));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

// POST /api/login
app.post('/api/login', async (req, res) => {
    const { hashcode: privKeyHex } = req.body;

    if (!privKeyHex || !/^[a-fA-F0-9]{250,300}$/.test(privKeyHex)) {
        return res.status(400).json({ error: 'کد رای‌گیری نامعتبر است (لطفاً از اضافه کردن حروف یا فاصله خودداری کنید).' });
    }
    
    if (!privKeyHex) return res.status(400).json({ error: 'کد خود را وارد کنید.' });

    let pubKeyHex;
    try {
        const privateKey = crypto.createPrivateKey({
            key: Buffer.from(privKeyHex, 'hex'),
            format: 'der',
            type: 'pkcs8'
        });
        
        const publicKey = crypto.createPublicKey(privateKey);
        pubKeyHex = publicKey.export({ type: 'spki', format: 'der' }).toString('hex');
    } catch (err) {
        return res.status(401).json({ error: 'فرمت کد نامعتبر است.' });
    }

    try {
        const electionQuery = `
            SELECT e.id as election_id, e.title, e.max_votes 
            FROM voter_hashes vh
            JOIN elections e ON vh.election_id = e.id
            WHERE vh.hashcode = $1
        `;
        const electionResult = await pool.query(electionQuery, [pubKeyHex]);
        
        if (electionResult.rows.length === 0) {
            return res.status(401).json({ error: 'برای کد مورد نظر هیچ انتخاباتی وجود ندارد.' });
        }
        
        const election = electionResult.rows[0];

        const candidatesQuery = `SELECT id, name FROM candidates WHERE election_id = $1`;
        const candidatesResult = await pool.query(candidatesQuery, [election.election_id]);

        res.json({
            election: {
                id: election.election_id,
                title: election.title,
                max_votes: election.max_votes
            },
            candidates: candidatesResult.rows,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'خطای داخلی سرور' });
    }
});

// POST /api/vote
app.post('/api/vote', async (req, res) => {
    const { hashcode: privKeyHex, candidate_ids } = req.body;
    
    if (!privKeyHex || !/^[a-fA-F0-9]{250,300}$/.test(privKeyHex)) {
        return res.status(400).json({ error: 'کد رای‌گیری نامعتبر است (لطفاً از اضافه کردن حروف یا فاصله خودداری کنید).' });
    }

    if (!privKeyHex || !Array.isArray(candidate_ids)) {
        return res.status(400).json({ error: 'ورودی نامعتبر است.' });
    }

    let privateKey, publicKey, pubKeyHex;
    try {
        privateKey = crypto.createPrivateKey({
            key: Buffer.from(privKeyHex, 'hex'),
            format: 'der',
            type: 'pkcs8'
        });
        
        publicKey = crypto.createPublicKey(privateKey);
        pubKeyHex = publicKey.export({ type: 'spki', format: 'der' }).toString('hex');
    } catch (err) {
        return res.status(401).json({ error: 'کد رای‌گیری نامعتبر یا دستکاری شده است.' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const limitCheck = await client.query(`
            SELECT e.max_votes 
            FROM voter_hashes vh
            JOIN elections e ON vh.election_id = e.id
            WHERE vh.hashcode = $1
        `, [pubKeyHex]);

        if (limitCheck.rows.length === 0) {
            throw new Error('Invalid hashcode');
        }

        const maxVotes = limitCheck.rows[0].max_votes;
        if (candidate_ids.length > maxVotes) {
            return res.status(400).json({ error: `باید حداکثر به ${maxVotes} کاندید رای داد` });
        }

        const payloadToSign = candidate_ids.length > 0 ? candidate_ids.slice().sort().join(',') : ''; 
        const sign = crypto.createSign('SHA256');
        sign.update(payloadToSign);
        sign.end();
        const voteSignature = sign.sign(privateKey, 'hex');

        await client.query('DELETE FROM votes WHERE hashcode = $1', [pubKeyHex]);

        if (candidate_ids.length > 0) {
            const insertQuery = 'INSERT INTO votes (hashcode, candidate_id, signature) VALUES ($1, $2, $3)';
            for (const candidate_id of candidate_ids) {
                await client.query(insertQuery, [pubKeyHex, candidate_id, voteSignature]);
            }
        } else {
            await client.query('INSERT INTO votes (hashcode, candidate_id, signature) VALUES ($1, NULL, $2)', [pubKeyHex, voteSignature]);
        }

        await client.query('COMMIT');
        res.json({ success: true, message: 'رای شما با امنیت کامل (امضای دیجیتال) ثبت شد.' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        
        if (err.message === 'Invalid hashcode') {
            res.status(401).json({ error: 'کد وارد شده معتبر نیست.' });
        } else {
            res.status(500).json({ error: 'خطا در ثبت رای.' });
        }
    } finally {
        client.release();
    }
});
// GET /api/results/:election_id
app.get('/api/results/:election_id', async (req, res) => {
    const { election_id } = req.params;
    const client = await pool.connect();

    try {
        const votesQuery = `
            SELECT v.hashcode as public_key_hex, v.candidate_id, v.signature, c.name as candidate_name
            FROM votes v
            JOIN voter_hashes vh ON v.hashcode = vh.hashcode
            LEFT JOIN candidates c ON v.candidate_id = c.id
            WHERE vh.election_id = $1
        `;
        const votesResult = await client.query(votesQuery, [election_id]);

        const groupedVotes = {};
        for (const row of votesResult.rows) {
            if (!groupedVotes[row.public_key_hex]) {
                groupedVotes[row.public_key_hex] = { 
                    signature: row.signature, 
                    candidate_ids: [],
                    candidate_names: []
                };
            }
            
            if (row.candidate_id !== null) {
                groupedVotes[row.public_key_hex].candidate_ids.push(String(row.candidate_id));
                groupedVotes[row.public_key_hex].candidate_names.push(row.candidate_name);
            }
        }

        const validCounts = {};
        let blankVotesCount = 0;
        let tamperedCount = 0;
        const verifiedPublicKeys = [];

        for (const pubKeyHex in groupedVotes) {
            const group = groupedVotes[pubKeyHex];
            const payloadToVerify = group.candidate_ids.length > 0 
                ? group.candidate_ids.sort().join(',') 
                : '';
            
            try {
                const publicKey = crypto.createPublicKey({
                    key: Buffer.from(pubKeyHex, 'hex'),
                    format: 'der',
                    type: 'spki'
                });

                const verify = crypto.createVerify('SHA256');
                verify.update(payloadToVerify);
                verify.end();
                
                const isValid = verify.verify(publicKey, group.signature, 'hex');

                if (isValid) {
                    verifiedPublicKeys.push(pubKeyHex);
                    
                    if (group.candidate_ids.length === 0) {
                        blankVotesCount++;
                    } else {
                        for (const name of group.candidate_names) {
                            if (name) validCounts[name] = (validCounts[name] || 0) + 1;
                        }
                    }
                } else {
                    tamperedCount++;
                }
            } catch (err) {
                tamperedCount++;
            }
        }

        if (tamperedCount > 0) {
            return res.status(403).json({ 
                success: false,
                error: '🚨 خطر امنیتی: دستکاری در دیتابیس تشخیص داده شد!',
                details: `${tamperedCount} رای دارای امضای دیجیتال نامعتبر هستند. شمارش آرا متوقف شد.`
            });
        }

        const allCandidates = await client.query('SELECT name FROM candidates WHERE election_id = $1', [election_id]);
        const finalResults = allCandidates.rows.map(c => ({
            name: c.name,
            votes: validCounts[c.name] || 0
        })).sort((a, b) => b.votes - a.votes);

        res.json({
            success: true,
            message: '✅ سلامت تمام آرا توسط امضای دیجیتال تایید شد.',
            total_verified_voters: Object.keys(groupedVotes).length,
            blank_votes: blankVotesCount,
            results: finalResults,
            voters_list: verifiedPublicKeys
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'خطا در محاسبه نتایج' });
    } finally {
        client.release();
    }
});

// GET /api/elections
app.get('/api/elections', async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT id, title FROM elections');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'خطا در دریافت لیست انتخابات‌ها' });
    } finally {
        client.release();
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});