const express = require('express');
const cors = require('cors');
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
    const { hashcode } = req.body;
    if (!hashcode) return res.status(400).json({ error: 'کد خود را وارد کنید.' });

    try {
        const electionQuery = `
            SELECT e.id as election_id, e.title, e.max_votes 
            FROM voter_hashes vh
            JOIN elections e ON vh.election_id = e.id
            WHERE vh.hashcode = $1
        `;
        const electionResult = await pool.query(electionQuery, [hashcode]);
        
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
    const { hashcode, candidate_ids } = req.body;
    
    if (!hashcode || !Array.isArray(candidate_ids)) {
        return res.status(400).json({ error: 'ورودی نامعتبر است.' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const limitCheck = await client.query(`
            SELECT e.max_votes 
            FROM voter_hashes vh
            JOIN elections e ON vh.election_id = e.id
            WHERE vh.hashcode = $1
        `, [hashcode]);

        if (limitCheck.rows.length === 0) {
            throw new Error('Invalid hashcode');
        }

        const maxVotes = limitCheck.rows[0].max_votes;
        if (candidate_ids.length > maxVotes) {
            return res.status(400).json({ error: `باید حداکثر به ${maxVotes} کاندید رای داد` });
        }

        await client.query('DELETE FROM votes WHERE hashcode = $1', [hashcode]);

        if (candidate_ids.length > 0) {
            const insertQuery = 'INSERT INTO votes (hashcode, candidate_id) VALUES ($1, $2)';
            for (const candidate_id of candidate_ids) {
                await client.query(insertQuery, [hashcode, candidate_id]);
            }
        }

        await client.query('COMMIT');
        res.json({ success: true, message: 'رای شما ثبت شد. رستایی باشید.' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        
        if (err.message === 'Invalid hashcode') {
            res.status(401).json({ error: err.message });
        } else {
            res.status(500).json({ error: 'Failed to record vote' });
        }
    } finally {
        client.release();
    }
});

// GET /api/admin/voters
app.get('/api/admin/voters', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT v.id, v.telegram_id, v.name, v.allowed, e.title as election_title
            FROM voters v
            JOIN elections e ON v.election_id = e.id
            WHERE v.allowed = FALSE
            ORDER BY v.created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'خطا در دریافت لیست' });
    }
});

// POST /api/admin/approve
app.post('/api/admin/approve', async (req, res) => {
    const { voter_id } = req.body;
    if (!voter_id) return res.status(400).json({ error: 'آیدی کاربر الزامی است' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const updateRes = await client.query(`
            UPDATE voters SET allowed = TRUE 
            WHERE id = $1 AND allowed = FALSE 
            RETURNING telegram_id, name, election_id
        `, [voter_id]);

        if (updateRes.rows.length === 0) {
            throw new Error('کاربر یافت نشد یا قبلاً تایید شده است.');
        }
        const voter = updateRes.rows[0];

        const hashcode = Math.random().toString(36).substring(2, 8).toUpperCase();
        await client.query(`
            INSERT INTO voter_hashes (hashcode, election_id) 
            VALUES ($1, $2)
        `, [hashcode, voter.election_id]);

        await client.query('COMMIT');

        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const proxyUrl = process.env.TELEGRAM_PROXY_URL;
        const message = `✅ سلام ${voter.name} عزیز!\n\nثبت‌نام شما در انتخابات تایید شد.\n\nکد رای‌گیری اختصاصی شما:\n\`${hashcode}\`\n\nلطفاً با این کد وارد سایت شوید و رای خود را ثبت کنید.`;

        try {
            await fetch(`${proxyUrl}/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: voter.telegram_id,
                    text: message,
                    parse_mode: 'Markdown'
                })
            });
        } catch (teleErr) {
            console.error('خطا در ارسال پیام تلگرام:', teleErr);
        }

        res.json({ success: true, message: 'کاربر تایید و کد رای‌گیری برای او ارسال شد.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});