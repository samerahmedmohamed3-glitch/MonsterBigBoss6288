const NEWSPAPER_TEXT = `┌─── ⋆⋅☠︎⋅⋆ ───┐
⛓️  𝕿𝖍𝖊 𝕲𝖔𝖉 𝕸𝖔𝖓𝖘𝖙𝖊𝖗  ⛓️
└─── ⋆⋅☠︎⋅⋆ ───┘
⌯ 𖤐 𝐌𝐎𝐍𝐒𝐓𝐄𝐑 | 𝐃𝐀𝐑𝐊 𝐒𝐘𝐒𝐓𝐄𝐌 𖤐 ⌯
𓄿 𝕿𝖍𝖊 𝕷𝖊𝖆𝖉𝖊𝖗 𓄿
🕸️┇الـ٭ٰﹻـقـ٭ٰﹻـائـ٭ٰﹻـد𒁃مـ٭ٰﹻـونـــ٭ٰﹻـسـ٭ٰﹻـتـ٭ٰﹻـر - 𝐍𝐈𝐊𝐎𝐌𝐊 - 💀┇ ⚡┇𝕯𝖆𝖗𝖐𝖓𝖊𝖘𝖘 𝕱𝖆𝖈𝖊𝖇𝖔𝖔𝐤
[𝑆𝑀𝐾] 𒀵 [𝑁𝐼𝐾] 𒀲[𝐻𝑃𝐴] 𒀵 [𝑆𝑀𝐾] 𒀴 [𝐾𝑆] 𒀲  [𝑆𝑀𝐾] 𒀵 [𝑁𝐼𝐾] 𒀲[𝐻𝑃𝐴] 𒀵 [𝑆𝑀𝐾] 𒀴 [𝐾𝑆] 𒀲  [𝑆𝑀𝐾] 𒀵 [𝑁𝐼𝐾] 𒀲[𝐻𝑃𝐴] 𒀵 [𝑆𝑀𝐾] 𒀴 [𝐾𝑆] 𒀲  [𝑆𝑀𝐾] 𒀵 [𝑁𝐼𝐾] 𒀲[𝐻𝑃𝐴] 𒀵 [𝑆𝑀𝐾] 𒀴 [𝐾𝑆] 𒀲  [𝑆𝑀𝐾] 𒀵 [𝑁𝐼𝐾] 𒀲[𝐻𝑃𝐴] 𒀵 [𝑆𝑀𝐾] 𒀴 [𝐾𝑆] 𒀲  [𝑆𝑀𝐾] 𒀵 [𝑁𝐼𝐾] 𒀲[𝐻𝑃𝐴] 𒀵 [𝑆𝑀𝐾] 𒀴 [𝐾𝑆] 𒀲  [𝑆𝑀𝐾] 𒀵 [𝑁𝐼𝐾] 𒀲[𝐻𝑃𝐴] 𒀵 [𝑆𝑀𝐾] 𒀴 [𝐾𝑆] 𒀲 [𝑆𝑀𝐾] 𒀵 [𝑁𝐼𝐾]
🖤 𝐃𝐚𝐫𝐤𝐧𝐞𝐬𝐬 🖤 𝑀 🖤 𝐅𝐚𝐜𝐞𝐛𝐨𝐨𝐤 🖤
⭒ ➠ ┇ 𝐍 . 𝐈 . 𝐊 . 𝐎 . 𝐌 . 𝐊  𝐒𝐘𝐒𝐓𝐄𝐌`;

const DELAYS = [15000, 20000, 25000, 30000, 35000];
const activeLoops = new Map();

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function spamLoop(api, threadID) {
  let delayIndex = 0;
  while (activeLoops.get(threadID)) {
    try {
      await api.sendMessage(NEWSPAPER_TEXT, threadID);
    } catch (e) {
      console.error(`[قصف] خطأ في الإرسال:`, e.message || e);
    }
    const delay = DELAYS[delayIndex % DELAYS.length];
    console.log(`[قصف] انتظار ${delay / 1000}ث...`);
    await sleep(delay);
    delayIndex++;
  }
  console.log(`[قصف] توقف الحلقة في ${threadID}`);
}

module.exports = {
  name: 'قصف',

  async execute(api, event) {
    const threadID = String(event.threadID);
    const body = (event.body || '').trim();

    if (body === 'قصف ايقاف' || body === 'قصف إيقاف') {
      if (activeLoops.get(threadID)) {
        activeLoops.set(threadID, false);
        try { await api.sendMessage('تــم 🖤 إيـقاف 🖤 الـجـرائـد 🖤', threadID); } catch (e) {}
      } else {
        try { await api.sendMessage('⚠️ لا يوجد إرسال جاري حالياً.', threadID); } catch (e) {}
      }
      return;
    }

    if (body === 'قصف') {
      if (activeLoops.get(threadID)) {
        try { await api.sendMessage('⚠️ الجرائد تعمل بالفعل!', threadID); } catch (e) {}
        return;
      }
      try { await api.sendMessage('🖤 جــاري 🖤 ارســال 🖤 الـجرائـد 🖤 ايـهـا الـزعيـم', threadID); } catch (e) {}
      activeLoops.set(threadID, true);
      spamLoop(api, threadID);
    }
  },

  isActive(threadID) {
    return activeLoops.get(String(threadID)) || false;
  }
};
