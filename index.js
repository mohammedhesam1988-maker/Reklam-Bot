const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

// ═══════════════════════════════════════════
//   ڕێکخستنەکان
// ═══════════════════════════════════════════
const TOKEN = process.env.TOKEN;
const SERVER_INVITE = process.env.SERVER_INVITE;
const AD_CHANNEL_ID = process.env.AD_CHANNEL_ID;

const AD_INTERVAL_MS = 30 * 1000;
const TIMEOUT_MS = 24 * 60 * 60 * 1000;
const MAX_DAILY = 1;

const dailyLimits = new Map();
const postedLinks = new Map();
const userAttempts = new Map();

function getToday() {
  return new Date().toDateString();
}

function hasUsedToday(userId) {
  const record = dailyLimits.get(userId);
  return record && record.date === getToday() && record.count >= MAX_DAILY;
}

function markUsed(userId) {
  dailyLimits.set(userId, { count: 1, date: getToday() });
}

function isLinkPostedToday(link) {
  const record = postedLinks.get(link);
  return record === getToday();
}

function markLinkPosted(link) {
  postedLinks.set(link, getToday());
}

function incrementAttempts(userId) {
  const record = userAttempts.get(userId);
  if (!record || record.date !== getToday()) {
    userAttempts.set(userId, { count: 1, date: getToday() });
    return 1;
  }
  record.count += 1;
  return record.count;
}

function resetAttempts(userId) {
  userAttempts.delete(userId);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMembers
  ]
});

client.once('ready', () => {
  console.log(`✅ Reklam bot ئامادەیە: ${client.user.tag}`);
  console.log(`📢 چەناڵی ڕیکلام: ${AD_CHANNEL_ID}`);
  console.log(`⏱️  ماوەی نێوان ڕیکلامەکان: ${AD_INTERVAL_MS / 1000} چرکە`);
});

const adQueue = [];
let isProcessing = false;

async function processQueue() {
  if (isProcessing) return;
  isProcessing = true;

  while (adQueue.length > 0) {
    const item = adQueue.shift();
    const adChannel = client.channels.cache.get(AD_CHANNEL_ID);

    if (adChannel) {
      try {
        await adChannel.send(
          `${item.author} 🔗 ${item.link}\n\n` +
          `**هەمووتان join بکەن ❤🌹**`
        );
        markLinkPosted(item.link);

        try {
          await item.author.send(`✅ ڕیکلام داندرا`);
        } catch (err) {
          console.log('⚠️ نەتوانرا DM بنێردرێت بۆ:', item.author.tag);
        }

      } catch (err) {
        console.log('⚠️ هەڵە لە ناردنی ڕیکلام:', err.message);
      }
    }

    await new Promise(resolve => setTimeout(resolve, AD_INTERVAL_MS));
  }

  isProcessing = false;
}

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // ═══════════════════════════════════════════
  //   بەشی DM
  // ═══════════════════════════════════════════
  if (message.channel.type === 1) {

    const discordLinkRegex = /https?:\/\/discord\.gg\/[a-zA-Z0-9]+/g;
    const matches = message.content.match(discordLinkRegex);

    if (!matches) {
      return message.reply(
        `⚠️ تکایە تەنها لینکی سێرڤەرەکەت بنێرە (وەک: https://discord.gg/xxxxx)`
      );
    }

    if (matches.length > 1) {
      return message.reply(
        `⚠️ تکایە تەنها **یەک لینک** بنێرە!`
      );
    }

    const link = matches[0];

    if (hasUsedToday(message.author.id)) {
      return message.reply(
        `⚠️ ئەمڕۆ ڕیکلامت کردوە! لە ڕۆژێکا یەک جار بۆت هەیە ڕیکلام کەیت.`
      );
    }

    if (isLinkPostedToday(link)) {
      return message.reply(
        `⚠️ ئەمڕۆ ڕیکلام بۆ ئەم سێرڤەرە کراوە، بەیانی هەوڵبدە.`
      );
    }

    adQueue.push({ author: message.author, link: link });
    markUsed(message.author.id);
    resetAttempts(message.author.id);

    await message.reply(`⏳ ڕیکلامەکەت خرایە ڕیزبەندی، دوای کەمێک دادەنرێت.`);
    processQueue();
    return;
  }

  // ═══════════════════════════════════════════
  //   بەشی چەناڵی ڕیکلام
  // ═══════════════════════════════════════════
  if (message.channel.id !== AD_CHANNEL_ID) return;

  const content = message.content.toLowerCase();

  if (content.includes('ڕیکلام') || content.includes('reklam')) {

    if (hasUsedToday(message.author.id)) {

      try {
        await message.delete();
      } catch (err) {
        console.log('⚠️ نەتوانرا نامەکە بسڕدرێتەوە:', err.message);
      }

      const attemptCount = incrementAttempts(message.author.id);

      if (attemptCount === 1) {
        try {
          await message.author.send(
            `⚠️ **ئەمڕۆ ڕیکلامت کردوە!**\n\n` +
            `لە ڕۆژێکا یەک جار بۆت هەیە ڕیکلام کەیت.\n` +
            `**دووبارەی کەیتەوە timeout ئەکرێت.**`
          );
        } catch (err) {
          console.log('⚠️ نەتوانرا DM بنێردرێت:', err.message);
        }
        return;
      }

      try {
        if (message.member) {
          await message.member.timeout(TIMEOUT_MS, 'دووجار داوای ڕیکلام لە هەمان ڕۆژدا');
        }
      } catch (err) {
        console.log('⚠️ نەتوانرا تایم ئاوت بکرێت:', err.message);
      }

      try {
        await message.author.send(
          `🚫 **ئەمڕۆ تۆ دووجار داوای ڕیکلامت کردوە، یاساکانت شکان.**\n\n` +
          `بۆ جاری دووەم بۆیە timeout کرای بۆ **٢٤ کاتژمێر**.`
        );
      } catch (err) {
        console.log('⚠️ نەتوانرا DM بنێردرێت:', err.message);
      }
      return;
    }

    try {
      await message.author.send(
        `📢 **بانگهێشتنامەی سێرڤەر**\n\n` +
        `📩 **لینکی سێرڤەرم بۆ ناردوویت لە تایبەت، تۆش بینێرە با لە چەناڵی ڕیکلام دایبنێم.**\n\n` +
        `🔗 ${SERVER_INVITE}`
      );
    } catch (err) {
      console.log('⚠️ نەتوانرا DM بنێردرێت:', err.message);
      return message.channel.send(
        `${message.author} ⚠️ نەتوانرا لینکەکەت بۆ بنێرم، تکایە DM ەکەت بکەرەوە.`
      );
    }

    await message.reply(
      `✅ ${message.author} **لینکی سێرڤەرم بۆ ناردوویت لە تایبەت، تۆش بینێرە با لە چەناڵی ڕیکلام دایبنێم.**`
    );
  }
});

client.login(TOKEN);
