// bot/bot.js
const TelegramBot = require('node-telegram-bot-api');
const { Pool } = require('pg');

const token = process.env.TELEGRAM_BOT_TOKEN;
const HR_ID = process.env.HR_ID;

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
});

console.log('Telegram bot is running with Admin Approval flow...');