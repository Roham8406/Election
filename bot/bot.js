// bot/bot.js
const TelegramBot = require('node-telegram-bot-api');
const { Pool } = require('pg');

const token = process.env.TELEGRAM_BOT_TOKEN;
const HR_ID = process.env.HR_ID;
const MANAGER_ID = process.env.MANAGER_ID;
const crypto = require('crypto');

const bot = new TelegramBot(token, { 
    polling: true,
    baseApiUrl: process.env.TELEGRAM_PROXY_URL
});
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const userSteps = {};

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, 'سلام! 👋\nبرای ثبت‌نام در سامانه رای‌گیری، دستور /register را ارسال کنید.');
});

// ==========================================
// User Register
// ==========================================
bot.onText(/\/register/, async (msg) => {
    const chatId = msg.chat.id;

    try {
        const result = await pool.query('SELECT id, title FROM elections');
        
        if (result.rows.length === 0) {
            return bot.sendMessage(chatId, '❌ در حال حاضر هیچ انتخاباتی فعال نیست.');
        }

        const keyboard = result.rows.map(election => {
            return [{ text: election.title, callback_data: `elec_${election.id}` }];
        });

        bot.sendMessage(chatId, '🗳 لطفاً انتخابات مورد نظر خود را انتخاب کنید:', {
            reply_markup: {
                inline_keyboard: keyboard
            }
        });
    } catch (err) {
        console.error(err);
        bot.sendMessage(chatId, '❌ خطا در دریافت لیست انتخابات.');
    }
});


bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text || text.startsWith('/')) return;
    const state = userSteps[chatId];
    
    if (state && state.step === 'AWAITING_NAME') {
        const name = text.trim();
        const electionId = state.electionId;
        const telegramId = msg.from.id;

        try {
            const electionCheck = await pool.query('SELECT title FROM elections WHERE id = $1', [electionId]);
            const electionTitle = electionCheck.rows[0].title;

            await pool.query(
                'INSERT INTO voters (telegram_id, name, election_id) VALUES ($1, $2, $3)',
                [telegramId, name, electionId]
            );

            bot.sendMessage(chatId, `✅ ثبت‌نام شما با نام "${name}" در انتخابات "${electionTitle}" با موفقیت انجام شد.`);
            
            delete userSteps[chatId];

        } catch (err) {
            if (err.code === '23505') {
                bot.sendMessage(chatId, '⚠️ شما قبلاً در این انتخابات ثبت‌نام کرده‌اید.');
            } else {
                console.error(err);
                bot.sendMessage(chatId, '❌ خطایی در ثبت‌نام رخ داد.');
            }
            delete userSteps[chatId];
        }
    }
});

// ==========================================
// HR
// ==========================================
bot.onText(/\/approval/, async (msg) => {
    const chatId = msg.chat.id;
    if (msg.from.id.toString() !== HR_ID) return;

    try {
        const result = await pool.query('SELECT id, title FROM elections');
        if (result.rows.length === 0) return bot.sendMessage(chatId, 'هیچ انتخاباتی وجود ندارد.');

        const keyboard = result.rows.map(e => ([{ text: `👥 بررسی: ${e.title}`, callback_data: `appr_elec_${e.id}` }]));
        bot.sendMessage(chatId, '👨‍💼 **پنل مدیریت:**\nانتخابات مورد نظر را انتخاب کنید:', {
            reply_markup: { inline_keyboard: keyboard },
            parse_mode: 'Markdown'
        });
    } catch (err) {
        bot.sendMessage(chatId, 'خطا در دریافت لیست.');
    }
});

async function showVotersList(chatId, messageId, electionId) {
    const result = await pool.query(`
        SELECT id, name, allowed FROM voters 
        WHERE election_id = $1 ORDER BY created_at ASC
    `, [electionId]);

    const keyboard = result.rows.map(voter => {
        const statusIcon = voter.allowed ? '✅' : '❌';
        return [{ 
            text: `${statusIcon} ${voter.name}`, 
            callback_data: `appr_voter_${voter.id}` 
        }];
    });

    keyboard.push([{ text: '🔙 بازگشت', callback_data: 'back_to_elections' }]);

    bot.editMessageText('لیست ثبت‌نام‌کنندگان:\n*(برای تغییر وضعیت هر کاربر روی نام او کلیک کنید)*', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: keyboard },
        parse_mode: 'Markdown'
    });
}

bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const data = query.data;

    if (data.startsWith('elec_')) {
        const electionId = data.replace('elec_', '');
        userSteps[chatId] = { step: 'AWAITING_NAME', electionId: electionId };
        bot.sendMessage(chatId, '✍️ لطفاً نام و نام‌خانوادگی خود را وارد کنید:');
        bot.answerCallbackQuery(query.id);
    }

    else if (data.startsWith('appr_elec_')) {
        const electionId = data.replace('appr_elec_', '');
        await showVotersList(chatId, messageId, electionId);
        bot.answerCallbackQuery(query.id);
    }

    else if (data.startsWith('appr_voter_')) {
        const voterId = data.replace('appr_voter_', '');
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            const voterRes = await client.query('SELECT telegram_id, name, election_id, allowed FROM voters WHERE id = $1', [voterId]);
            const voter = voterRes.rows[0];

            if (!voter.allowed) {
                await client.query('UPDATE voters SET allowed = TRUE WHERE id = $1', [voterId]);
                 
                const msgToVoter = `✅ سلام ${voter.name} عزیز!\n\nثبت‌نام شما تایید شد.`;
                await bot.sendMessage(voter.telegram_id, msgToVoter, { parse_mode: 'Markdown' });

                bot.answerCallbackQuery(query.id, { text: `تایید شد و کد ارسال شد.`, show_alert: false });
            } else {
                await client.query('UPDATE voters SET allowed = FALSE WHERE id = $1', [voterId]);
                
                const msgToVoter = `❌ سلام ${voter.name}.\n\nمتاسفانه تایید ثبت‌نام شما در انتخابات لغو شد.`;
                await bot.sendMessage(voter.telegram_id, msgToVoter);

                bot.answerCallbackQuery(query.id, { text: `تایید ${voter.name} لغو شد.`, show_alert: false });
            }
            
            await client.query('COMMIT');
            await showVotersList(chatId, messageId, voter.election_id);

        } catch (err) {
            await client.query('ROLLBACK');
            console.error(err);
            bot.answerCallbackQuery(query.id, { text: 'خطا در تغییر وضعیت کاربر', show_alert: true });
        } finally {
            client.release();
        }
    }

    else if (data.startsWith('manage_elec_')) {
        const electionId = data.replace('manage_elec_', '');
        const keyboard = [
            [{ text: '🚀 Start Hashing (صدور و ارسال کدهای یکبارمصرف)', callback_data: `start_hash_${electionId}` }]
        ];
        
        bot.editMessageText('⚠️ **اخطار:** با کلیک روی دکمه زیر، برای تمام کاربرانی که توسط HR تایید شده‌اند کد رای‌گیری تولید شده و پیامک می‌شود.', {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: { inline_keyboard: keyboard },
            parse_mode: 'Markdown'
        });
    }

    else if (data.startsWith('start_hash_')) {
        const electionId = data.replace('start_hash_', '');
        bot.answerCallbackQuery(query.id, { text: '⏳ در حال تولید و ارسال کدها... لطفاً صبر کنید.', show_alert: true });

        const client = await pool.connect();
        try {
            const votersRes = await client.query('SELECT telegram_id, name FROM voters WHERE election_id = $1 AND allowed = TRUE', [electionId]);
            let voters = votersRes.rows;

            if (voters.length === 0) {
                return bot.sendMessage(chatId, '❌ هیچ کاربر تایید شده‌ای برای این انتخابات یافت نشد.');
            }

            for (let i = voters.length - 1; i > 0; i--) {
                const j = crypto.randomInt(0, i + 1);
                [voters[i], voters[j]] = [voters[j], voters[i]];
            }

            await client.query('BEGIN');
            await client.query('DELETE FROM voter_hashes WHERE election_id = $1', [electionId]);
            let successCount = 0;

            for (const voter of voters) {
                const hashcode = crypto.randomBytes(50).toString('hex').substring(0, 98);
                await client.query('INSERT INTO voter_hashes (hashcode, election_id) VALUES ($1, $2)', [hashcode, electionId]);
                const msgToVoter = `✅ سلام ${voter.name} عزیز!\n\nزمان رای‌گیری فرا رسیده است.\nکد رای‌گیری اختصاصی شما: \`${hashcode}\`\n\nلطفاً با این کد وارد سایت شوید و رای خود را ثبت کنید.`;
                
                try {
                    await bot.sendMessage(voter.telegram_id, msgToVoter, { parse_mode: 'Markdown' });
                    successCount++;
                } catch (e) {
                    console.log(`Failed to send to ${voter.telegram_id}`);
                }
            }

            await client.query('COMMIT');
            bot.sendMessage(chatId, `✅ عملیات با موفقیت انجام شد.\nکدهای قبلی پاکسازی شدند و کدهای جدید برای ${successCount} نفر از ${voters.length} کاربر تایید شده ارسال گردید.`);

        } catch (err) {
            await client.query('ROLLBACK');
            console.error(err);
            bot.sendMessage(chatId, '❌ خطایی در تولید یا ارسال کدها رخ داد.');
        } finally {
            client.release();
        }
    }
});

// ==========================================
// Manager
// ==========================================
bot.onText(/\/manage/, async (msg) => {
    const chatId = msg.chat.id;
    if (msg.from.id.toString() !== MANAGER_ID) return;

    try {
        const result = await pool.query('SELECT id, title FROM elections');
        if (result.rows.length === 0) return bot.sendMessage(chatId, 'هیچ انتخاباتی وجود ندارد.');

        const keyboard = result.rows.map(e => ([{ text: `⚙️ مدیریت: ${e.title}`, callback_data: `manage_elec_${e.id}` }]));
        bot.sendMessage(chatId, '👨‍💻 **پنل مدیر ارشد (Manager):**\nبرای صدور کدهای رای‌گیری، انتخابات را انتخاب کنید:', {
            reply_markup: { inline_keyboard: keyboard },
            parse_mode: 'Markdown'
        });
    } catch (err) {
        bot.sendMessage(chatId, 'خطا در دریافت لیست.');
    }
});

console.log('Telegram bot is running...');