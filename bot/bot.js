// bot/bot.js
const TelegramBot = require('node-telegram-bot-api');
const { Pool } = require('pg');

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { 
    polling: true,
    baseApiUrl: process.env.TELEGRAM_BOT_TOKEN
});
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

const userSteps = {};

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, 'سلام! 👋\nبرای ثبت‌نام در سامانه رای‌گیری، دستور /register را ارسال کنید.');
});

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

bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    if (data.startsWith('elec_')) {
        const electionId = data.replace('elec_', '');
        
        userSteps[chatId] = {
            step: 'AWAITING_NAME',
            electionId: electionId
        };

        bot.sendMessage(chatId, '✍️ لطفاً نام و نام‌خانوادگی خود را وارد کنید:');
        
        bot.answerCallbackQuery(query.id); 
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

console.log('Telegram bot is running...');