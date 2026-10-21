const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { Pool } = require('pg');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;


const TelegramBot = require('node-telegram-bot-api');
const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
const botOptions = { polling: false }; 
if (process.env.TELEGRAM_PROXY_URL) {
    botOptions.baseApiUrl = process.env.TELEGRAM_PROXY_URL;
}
const bot = telegramToken ? new TelegramBot(telegramToken, botOptions) : null;

const app = express();
app.use(express.json());

app.set('trust proxy', 1);

const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 100,
    message: { error: 'ترافیک شما بیش از حد مجاز است. لطفاً ۱۵ دقیقه دیگر تلاش کنید.' }
});
app.use('/api/', generalLimiter);

const strictLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 5,
    message: { error: 'تلاش‌های بیش از حد. برای جلوگیری از تقلب، دسترسی شما ۵ دقیقه مسدود شد.' }
});
app.use('/api/login', strictLimiter);
app.use('/api/vote', strictLimiter);

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


const authenticateAdmin = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'عدم دسترسی. توکن ارسال نشده است.' });
    }
    
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.admin = decoded;
        next();
    } catch (err) {
        res.status(400).json({ error: 'توکن نامعتبر یا منقضی شده است.' });
    }
};


const requireRole = (requiredRole) => {
    return (req, res, next) => {
        if (!req.admin || !req.admin.roles.includes(requiredRole)) {
            return res.status(403).json({ error: 'دسترسی غیرمجاز. شما به این بخش دسترسی ندارید.' });
        }
        next();
    };
};

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

    let isManager = false;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            if (decoded && decoded.roles && decoded.roles.includes('Manager')) {
                isManager = true;
            }
        } catch (err) {
        }
    }

    const client = await pool.connect();

    try {
        const electionCheck = await client.query('SELECT status FROM elections WHERE id = $1', [election_id]);
        if (electionCheck.rows.length === 0) {
            return res.status(404).json({ error: 'انتخابات یافت نشد.' });
        }
        
        const electionStatus = electionCheck.rows[0].status;

        if (electionStatus !== 'Ended' && !isManager) {
            return res.status(403).json({
                success: false,
                error: 'رای‌گیری هنوز به پایان نرسیده است. نتایج تنها پس از پایان انتخابات به صورت عمومی منتشر خواهد شد.'
            });
        }

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
        const { rows } = await pool.query('SELECT id, title, status FROM elections');
        res.json({ success: true, elections: rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'خطا در دریافت لیست انتخابات‌ها' });
    } finally {
        client.release();
    }
});

// app.post('/api/admin/setup', async (req, res) => {
//     const { username, password, roles } = req.body; // roles e.g. ['Manager', 'HR']
//     const client = await pool.connect();
//     try {
//         await client.query('BEGIN');
//         const hashedPassword = await bcrypt.hash(password, 10);
        
//         // Insert admin
//         const adminRes = await client.query(
//             'INSERT INTO admins (username, password) VALUES ($1, $2) RETURNING id',
//             [username, hashedPassword]
//         );
//         const adminId = adminRes.rows[0].id;

//         // Assign roles
//         for (const roleName of roles) {
//             const roleRes = await client.query('SELECT id FROM roles WHERE name = $1', [roleName]);
//             if (roleRes.rows.length > 0) {
//                 await client.query(
//                     'INSERT INTO admin_roles (admin_id, role_id) VALUES ($1, $2)',
//                     [adminId, roleRes.rows[0].id]
//                 );
//             }
//         }
//         await client.query('COMMIT');
//         res.json({ success: true, message: 'Admin created successfully' });
//     } catch (err) {
//         await client.query('ROLLBACK');
//         res.status(500).json({ error: err.message });
//     } finally {
//         client.release();
//     }
// });

app.post('/api/admin/login', strictLimiter, async (req, res) => {
    const { username, password } = req.body;
    try {
        const adminRes = await pool.query('SELECT * FROM admins WHERE username = $1', [username]);
        if (adminRes.rows.length === 0) {
            return res.status(401).json({ error: 'نام کاربری نادرست است.' });
        }
        const admin = adminRes.rows[0];

        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'رمز عبور نادرست است.' });
        }

        const rolesRes = await pool.query(`
            SELECT r.name, r.panel_url 
            FROM roles r
            JOIN admin_roles ar ON r.id = ar.role_id
            WHERE ar.admin_id = $1 AND r.panel_url IS NOT NULL
        `, [admin.id]);

        const panels = rolesRes.rows; 
        const roles = panels.map(p => p.name);

        const token = jwt.sign({ id: admin.id, username: admin.username, roles }, JWT_SECRET, { expiresIn: '8h' });
        res.json({ success: true, token, roles, panels });
    } catch (err) {
        res.status(500).json({ error: 'خطای داخلی سرور' });
    }
});


app.get('/api/admin/elections/:id/voters', authenticateAdmin, requireRole('HR'), async (req, res) => {
    const electionId = req.params.id;
    try {
        const { rows } = await pool.query(
            'SELECT id, telegram_id, name, allowed, created_at FROM voters WHERE election_id = $1 ORDER BY created_at DESC', 
            [electionId]
        );
        res.json({ success: true, voters: rows });
    } catch (err) {
        res.status(500).json({ error: 'خطا در دریافت کاربران' });
    }
});

app.post('/api/admin/voters/:id/approve', authenticateAdmin, requireRole('HR'), async (req, res) => {
    const voterId = req.params.id;
    try {
        const elecCheck = await pool.query(
            'SELECT e.status FROM elections e JOIN voters v ON e.id = v.election_id WHERE v.id = $1', 
            [voterId]
        );
        if (elecCheck.rows.length > 0 && elecCheck.rows[0].status !== 'Waiting') {
            return res.status(403).json({ error: 'رای‌گیری شروع شده یا پایان یافته است. امکان تایید کاربر جدید وجود ندارد.' });
        }

        await pool.query('UPDATE voters SET allowed = TRUE, rejected = FALSE WHERE id = $1', [voterId]);
        res.json({ success: true, message: 'کاربر تایید شد.' });
    } catch (err) {
        res.status(500).json({ error: 'خطا در تایید کاربر' });
    }
});

app.post('/api/admin/voters/:id/reject', authenticateAdmin, requireRole('HR'), async (req, res) => {
    const voterId = req.params.id;
    try {
        const elecCheck = await pool.query(
            'SELECT e.status FROM elections e JOIN voters v ON e.id = v.election_id WHERE v.id = $1', 
            [voterId]
        );
        if (elecCheck.rows.length > 0 && elecCheck.rows[0].status !== 'Waiting') {
            return res.status(403).json({ error: 'رای‌گیری شروع شده یا پایان یافته است. امکان تغییر وضعیت وجود ندارد.' });
        }

        await pool.query('UPDATE voters SET allowed = FALSE, rejected = TRUE WHERE id = $1', [voterId]);
        res.json({ success: true, message: 'وضعیت کاربر به رد شده تغییر یافت.' });
    } catch (err) {
        res.status(500).json({ error: 'خطا در رد صلاحیت کاربر' });
    }
});

app.post('/api/admin/elections/:id/voters/import', authenticateAdmin, requireRole('HR'), async (req, res) => {
    const electionId = req.params.id;
    const { voters } = req.body;

    if (!voters || !Array.isArray(voters) || voters.length === 0) {
        return res.status(400).json({ error: 'لیست ارسالی خالی یا نامعتبر است.' });
    }

    const client = await pool.connect();
    try {

        const elecCheck = await pool.query('SELECT status FROM elections WHERE id = $1', [electionId]);
        if (elecCheck.rows.length > 0 && elecCheck.rows[0].status !== 'Waiting') {
            return res.status(403).json({ error: 'زمان ثبت‌نام به پایان رسیده و رای‌گیری آغاز شده است. امکان افزودن گروهی وجود ندارد.' });
        }

        await client.query('BEGIN');  
      
        
        for (const voter of voters) {
            await client.query(`
                INSERT INTO voters (telegram_id, name, election_id, allowed) 
                VALUES ($1, $2, $3, TRUE)
                ON CONFLICT (telegram_id, election_id) 
                DO UPDATE SET allowed = TRUE, name = EXCLUDED.name
            `, [voter.telegram_id, voter.name, electionId]);
        }

        await client.query('COMMIT');
        res.json({ success: true, message: `${voters.length} کاربر با موفقیت وارد سیستم و تایید شدند.` });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: 'خطا در ذخیره لیست کاربران دیتابیس' });
    } finally {
        client.release();
    }
});

app.get('/api/admin/manager/elections/:id/check-status', authenticateAdmin, requireRole('Manager'), async (req, res) => {
    const electionId = req.params.id;
    if (!bot) return res.status(500).json({ error: 'توکن تلگرام در بک‌ند تنظیم نشده است.' });

    try {
        const { rows: voters } = await pool.query('SELECT telegram_id, name FROM voters WHERE election_id = $1 AND allowed = TRUE', [electionId]);
        if (voters.length === 0) return res.json({ success: true, message: 'هیچ کاربر تایید شده‌ای وجود ندارد.' });

        let reachable = 0;
        let blocked = [];

        for (const voter of voters) {
            try {
                await bot.sendChatAction(voter.telegram_id, 'typing');
                reachable++;
            } catch (err) {
                blocked.push(voter.name);
            }
        }

        const msg = blocked.length > 0 
            ? `از ${voters.length} کاربر، ${reachable} نفر در دسترس هستند. \n\nافرادی که ربات را متوقف (بلاک) کرده‌اند: ${blocked.join('، ')}`
            : `عالی! تمام ${voters.length} کاربر تایید شده در دسترس هستند و ربات را مسدود نکرده‌اند.`;

        res.json({ success: true, message: msg });
    } catch (err) {
        res.status(500).json({ error: 'خطا در بررسی وضعیت کاربران' });
    }
});

app.post('/api/admin/manager/elections/:id/start', authenticateAdmin, requireRole('Manager'), async (req, res) => {
    const electionId = req.params.id;
    if (!bot) return res.status(500).json({ error: 'توکن تلگرام در بک‌ند تنظیم نشده است.' });

    const client = await pool.connect();
    const sentMessages = []; 
    
    try {
        const votersRes = await client.query('SELECT telegram_id, name FROM voters WHERE election_id = $1 AND allowed = TRUE', [electionId]);
        let voters = votersRes.rows;

        if (voters.length === 0) {
            return res.status(400).json({ error: 'هیچ کاربر تایید شده‌ای یافت نشد.' });
        }

        for (let i = voters.length - 1; i > 0; i--) {
            const j = crypto.randomInt(0, i + 1);
            [voters[i], voters[j]] = [voters[j], voters[i]];
        }

        await client.query('BEGIN');
        
        const { rowCount } = await client.query("UPDATE elections SET status = 'Started' WHERE id = $1 AND status = 'Waiting'", [electionId]);
        if (rowCount === 0) throw new Error('این انتخابات قبلا شروع شده یا وجود ندارد.');

        await client.query('DELETE FROM voter_hashes WHERE election_id = $1', [electionId]);
        let successCount = 0;

        for (const voter of voters) {
            const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
                namedCurve: 'prime256v1',
                publicKeyEncoding: { type: 'spki', format: 'der' },
                privateKeyEncoding: { type: 'pkcs8', format: 'der' }
            });

            const pubKeyHex = publicKey.toString('hex');
            const privKeyHex = privateKey.toString('hex');

            let inserted = false;
            while (!inserted) {
                try {
                    await client.query('INSERT INTO voter_hashes (hashcode, election_id) VALUES ($1, $2)', [pubKeyHex, electionId]);
                    inserted = true;
                } catch (err) {
                    if (err.code !== '23505') throw err;
                }
            }

            const msgToVoter = `✅ سلام ${voter.name} عزیز!\n\nزمان رای‌گیری فرا رسیده است. برای شرکت در انتخابات از اطلاعات زیر استفاده کنید:\n\n🔑 **کد ورود و ثبت رای (کلید خصوصی):**\n\`${privKeyHex}\`\n\n👁️ **کد رهگیری شما (کلید عمومی):**\n\`${pubKeyHex}\``;
                                
            try {
                const sentMsg = await bot.sendMessage(voter.telegram_id, msgToVoter, { parse_mode: 'Markdown' });
                sentMessages.push({ chatId: voter.telegram_id, messageId: sentMsg.message_id });
                successCount++;
            } catch (e) {
                console.error(`Failed to send to ${voter.telegram_id}`);
            }
        }

        await client.query('COMMIT');
        res.json({ success: true, message: `انتخابات با موفقیت شروع شد!\nکدها برای ${successCount} نفر از طریق تلگرام پیامک شد.` });

    } catch (err) {
        await client.query('ROLLBACK');
        
        for (const msg of sentMessages) {
            bot.deleteMessage(msg.chatId, msg.messageId).catch(() => {});
        }
        
        const errorMsg = err.code === '23505' 
            ? 'عملیات لغو شد (کد تکراری). پیام‌های تلگرام پس گرفته شدند. لطفا دوباره تلاش کنید.'
            : err.message || 'خطایی رخ داد و دیتابیس Rollback شد.';
        
        res.status(500).json({ error: errorMsg });
    } finally {
        client.release();
    }
});


app.post('/api/admin/manager/elections', authenticateAdmin, requireRole('Manager'), async (req, res) => {
    const { title, max_votes } = req.body;
    try {
        const { rows } = await pool.query(
            'INSERT INTO elections (title, max_votes) VALUES ($1, $2) RETURNING *',
            [title, max_votes || 5]
        );
        res.json({ success: true, election: rows[0], message: 'انتخابات جدید ساخته شد.' });
    } catch (err) {
        res.status(500).json({ error: 'خطا در ساخت انتخابات' });
    }
});

app.put('/api/admin/manager/elections/:id', authenticateAdmin, requireRole('Manager'), async (req, res) => {
    const { title, max_votes } = req.body;
    const electionId = req.params.id;
    try {
        const check = await pool.query('SELECT status FROM elections WHERE id = $1', [electionId]);
        if (check.rows.length === 0) return res.status(404).json({ error: 'انتخابات یافت نشد' });
        if (check.rows[0].status === 'Ended') {
            return res.status(403).json({ error: 'انتخابات پایان‌یافته به هیچ وجه قابل ویرایش نیست.' });
        }

        await pool.query(
            'UPDATE elections SET title = $1, max_votes = $2 WHERE id = $3',
            [title, max_votes, electionId]
        );
        res.json({ success: true, message: 'انتخابات با موفقیت بروزرسانی شد.' });
    } catch (err) {
        res.status(500).json({ error: 'خطا در ویرایش انتخابات' });
    }
});


app.get('/api/admin/manager/elections/:id/candidates', authenticateAdmin, requireRole('Manager'), async (req, res) => {
    const electionId = req.params.id;
    try {
        const { rows } = await pool.query('SELECT * FROM candidates WHERE election_id = $1 ORDER BY name ASC', [electionId]);
        res.json({ success: true, candidates: rows });
    } catch (err) {
        res.status(500).json({ error: 'خطا در دریافت لیست کاندیداها' });
    }
});

app.post('/api/admin/manager/elections/:id/candidates', authenticateAdmin, requireRole('Manager'), async (req, res) => {
    const electionId = req.params.id;
    const { name } = req.body;
    try {
        const { rows } = await pool.query(
            'INSERT INTO candidates (election_id, name) VALUES ($1, $2) RETURNING *', 
            [electionId, name]
        );
        res.json({ success: true, candidate: rows[0], message: 'کاندیدا اضافه شد.' });
    } catch (err) {
        res.status(500).json({ error: 'خطا در ثبت کاندیدا' });
    }
});

app.delete('/api/admin/manager/candidates/:id', authenticateAdmin, requireRole('Manager'), async (req, res) => {
    const candidateId = req.params.id;
    try {
        await pool.query('DELETE FROM candidates WHERE id = $1', [candidateId]);
        res.json({ success: true, message: 'کاندیدا حذف شد.' });
    } catch (err) {
        res.status(500).json({ error: 'خطا در حذف کاندیدا' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});