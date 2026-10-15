// bot/bot.js
const TelegramBot = require('node-telegram-bot-api');
const { Pool } = require('pg');

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { 
    polling: true,
    baseApiUrl: "https://aged-shape-a9f5.roham8406.workers.dev"
});
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Hello! 👋\n\nبرای ثبت‌نام در سامانه رای‌گیری، لطفاً دستور زیر را ارسال کنید:\n/register [نام شما] [آیدی انتخابات]');
});

bot.onText(/\/register/, async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text.trim();
    const args = text.split(/\s+/);

    if (args.length < 3) {
        return bot.sendMessage(chatId, 'فرمت اشتباه است. لطفاً به این شکل وارد کنید:\n/register [نام و نام‌خانوادگی] [آیدی انتخابات]');
    }

    const electionId = args.pop(); 
    const name = args.slice(1).join(' '); 
    const telegramId = msg.from.id;

    try {
        const electionCheck = await pool.query('SELECT title FROM elections WHERE id = $1', [electionId]);
        
        if (electionCheck.rows.length === 0) {
            return bot.sendMessage(chatId, 'انتخاباتی با این آیدی یافت نشد.');
        }
        
        const electionTitle = electionCheck.rows[0].title;

        await pool.query(
            'INSERT INTO voters (telegram_id, name, election_id) VALUES ($1, $2, $3)',
            [telegramId, name, electionId]
        );

        bot.sendMessage(chatId, `✅ ثبت‌نام شما با نام "${name}" در انتخابات "${electionTitle}" با موفقیت انجام شد.`);

    } catch (err) {
        if (err.code === '23505') {
            bot.sendMessage(chatId, '⚠️ شما قبلاً در این انتخابات ثبت‌نام کرده‌اید.');
        } else if (err.code === '22P02') {
            bot.sendMessage(chatId, 'آیدی انتخابات نامعتبر است (باید فرمت UUID باشد).');
        } else {
            console.error(err);
            bot.sendMessage(chatId, 'خطایی در ارتباط با سرور رخ داد.');
        }
    }
});

console.log('Telegram bot is running...');