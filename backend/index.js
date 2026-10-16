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
        // ۲. حالا دیتابیس را بر اساس "کلید عمومی" جستجو می‌کنیم (نه کد کاربر!)
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
    
    if (!privKeyHex || !Array.isArray(candidate_ids) || candidate_ids.length === 0) {
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

        const payloadToSign = candidate_ids.slice().sort().join(','); 
        const sign = crypto.createSign('SHA256');
        sign.update(payloadToSign);
        sign.end();
        const voteSignature = sign.sign(privateKey, 'hex');

        await client.query('DELETE FROM votes WHERE hashcode = $1', [pubKeyHex]);

        const insertQuery = 'INSERT INTO votes (hashcode, candidate_id, signature) VALUES ($1, $2, $3)';
        for (const candidate_id of candidate_ids) {
            await client.query(insertQuery, [pubKeyHex, candidate_id, voteSignature]);
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});