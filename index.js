const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

// ═══════════════════════════════════════════
//   ڕێکخستنەکان
// ═══════════════════════════════════════════
const TOKEN = process.env.TOKEN;
const SERVER_INVITE = process.env.SERVER_INVITE;
const AD_CHANNEL_ID = process.env.AD_CHANNEL_ID;

// ═══════════════════════════════════════════
//   سیستەمی سنووردانان
// ═══════════════════════════════════════════
const dailyLimits = new Map();
const attempts = new Map();

const MAX_DAILY = 1;

function hasUsedToday(userId) {
  const today = new Date().toDateString();
  const record = dailyLimits.get(userId);
  return record && record.date === today && record.count >= MAX_DAILY;
}

function markUsed(userId) {
  const today = new Date().toDateString();
  dailyLimits.set(userId, { count: 1, date: today });
}

function incrementAttempts(userId) {
  const today = new Date().toDateString();
  const record = attempts.get(userId);

  if (!record || record.date !== today) {
    attempts.set(userId, { count: 1, date: today });
    return 1;
  }

  record.count += 1;
  return record.count;
}

function resetAttempts(userId) {
  attempts.delete(userId);
}

// ═══════════════════════════════════════════
//   دروستکردنی بۆت
// ═══════════════════════════════════════════
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
});

// ═══════════════════════════════════════════
//   وەڵامدانەوەی نامەکان
// ═══════════════════════════════════════════
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // ═══════════════════════════════════════════
  //   بەشی یەکەم: نامە لە DM
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
        `⚠️ تکایە تەنها **یەک لینک** بنێرە! تۆ ${matches.length} لینکت ناردووە.`
      );
    }

    const link = matches[0];

    if (hasUsedToday(message.author.id)) {
      return message.reply(
        `⚠️ تۆ ئەمڕۆ ڕیکلامت کردووە! تەنها **${MAX_DAILY} جار** لە ڕۆژێکدا ڕێگەپێدراوە.\n` +
        `⏳ سبەینێ دووبارە هەوڵ بدەرەوە.`
      );
    }

    const adChannel = client.channels.cache.get(AD_CHANNEL_ID);

    if (adChannel) {
      await adChannel.send(
        `${message.author} 🔗 ${link}\n\n` +
        `**هەمووتان join بکەن ❤🌹**`
      );

      markUsed(message.author.id);
      resetAttempts(message.author.id);

      await message.reply(
        `✅ بە ڕێز ڕیکلامەکەت داندرا ❤️`
      );
    } else {
      await message.reply(
        `⚠️ چەناڵی reklam نەدۆزرایەوە، تکایە پەیوەندی بە ئەدمین بکە.`
      );
    }
    return;
  }

  // ═══════════════════════════════════════════
  //   بەشی دووەم: نامە لە هەموو چەناڵەکان
  // ═══════════════════════════════════════════
  const content = message.content.toLowerCase();

  if (content.includes('ڕیکلام') || content.includes('reklam')) {

    if (hasUsedToday(message.author.id)) {

      // ① نامەکەی دیلیت بکە
      try {
        await message.delete();
      } catch (err) {
        console.log('⚠️ نەتوانرا نامەکە بسڕدرێتەوە:', err.message);
      }

      // ② ژماردنی هەوڵەکان
      const attemptCount = incrementAttempts(message.author.id);

      // ③ دیاریکردنی ماوەی تایم ئاوت
      let timeoutMs;
      if (attemptCount === 1) {
        timeoutMs = 5 * 60 * 1000; // دووەم جار → 5 خولەک
      } else {
        timeoutMs = 24 * 60 * 60 * 1000; // سێیەم جار و زیاتر → 1 ڕۆژ
      }

      // ④ تایم ئاوت بکە
      try {
        if (message.member) {
          await message.member.timeout(
            timeoutMs,
            'دووبارە داواکاری ڕیکلام لە هەمان ڕۆژدا'
          );
        }
      } catch (err) {
        console.log('⚠️ نەتوانرا تایم ئاوت بکرێت:', err.message);
      }

      // ⑤ ئاگاداری بکەرەوە بە DM (هەردوو دەقە یەکسانن)
      try {
        await message.author.send(
          `🚫 لەبەر ئەوەی دیسان داوات کرد، ١ ڕۆژ تایم ئاوتیت کرد. تایم ئاوت کرای\n\n` +
          `تەنها 1 جار لە ڕۆژێکدا ڕێگەپێدراوە.\n` +
          `⏳ بۆ ماوەی ١ ڕۆژ تایم ئاوت کرایت.\n` +
          `سبەینێ دووبارە هەوڵ بدەرەوە.`
        );
      } catch (err) {
        console.log('⚠️ نەتوانرا DM بنێردرێت بۆ:', message.author.tag);
      }

      return;
    }

    // ⬇️ ئەگەر یەکەم جارە
    try {
      await message.author.send(
        `📢 **بانگهێشتنامەی سێرڤەر**\n\n` +
        `سوپاس بۆ ڕیکلامەکەت!\n\n` +
        `📩 **لینکی سێرڤەرەکەم بۆ ناردیت.**\n\n` +
        `🔗 ${SERVER_INVITE}\n\n` +
        `**هەمووتان join بکەن ❤🌹**\n\n` +
        `**تۆش لینکی سێرڤەرەکەت بنێرە با لە چەناڵی reklam دایبنێم.**\n\n` +
        `⚠️ **تێبینی:** تەنها **${MAX_DAILY} جار** لە ڕۆژێکدا ڕێگەپێدراویت.`
      );

    } catch (err) {
      console.log('⚠️ نەتوانرا DM بنێردرێت بۆ:', message.author.tag);
      await message.channel.send(
        `${message.author} ⚠️ نەتوانرا لینکەکەت بۆ بنێرم، تکایە DM ەکەت بکەرەوە.`
      );
      return;
    }

    await message.reply(
      `✅ سوپاس بۆ ڕیکلامەکەت ${message.author}!\n\n` +
      `📩 **لینکی سێرڤەرەکەم بۆ ناردیت.**\n` +
      `**تۆش لینکی سێرڤەرەکەت بنێرە با لە چەناڵی reklam دایبنێم.**`
    );
  }
});

client.login(TOKEN);
