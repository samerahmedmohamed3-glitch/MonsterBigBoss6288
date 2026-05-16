const replyRules = new Map();

module.exports = {
  name: 'رد',

  execute(api, event, args) {
    const threadID = event.threadID;
    const body = event.body ? event.body.trim() : '';

    if (body.startsWith('رد ') && body.includes('»')) {
      const parts = body.replace('رد ', '').split('»');
      if (parts.length >= 2) {
        const trigger = parts[0].trim();
        const response = parts[1].trim();

        if (!trigger || !response) {
          return api.sendMessage('⚠️ الصيغة الصحيحة: رد [الكلمة]» [الرد]', threadID);
        }

        if (!replyRules.has(threadID)) {
          replyRules.set(threadID, new Map());
        }
        replyRules.get(threadID).set(trigger.toLowerCase(), response);

        console.log(`[رد] تمت إضافة قاعدة: "${trigger}" → "${response}" في المجموعة ${threadID}`);
        api.sendMessage(`✅ تم تسجيل الرد:\nعند: ${trigger}\nأرد: ${response}`, threadID, (err) => {
          if (err) console.error('[رد] خطأ:', err);
        });
      }
      return;
    }

    if (body.startsWith('رد حذف ')) {
      const trigger = body.replace('رد حذف ', '').trim().toLowerCase();
      const threadRules = replyRules.get(threadID);
      if (threadRules && threadRules.has(trigger)) {
        threadRules.delete(trigger);
        api.sendMessage(`✅ تم حذف الرد لكلمة: ${trigger}`, threadID, (err) => {
          if (err) console.error('[رد] خطأ:', err);
        });
      } else {
        api.sendMessage(`⚠️ لا يوجد رد مسجل لكلمة: ${trigger}`, threadID, (err) => {
          if (err) console.error('[رد] خطأ:', err);
        });
      }
      return;
    }

    if (body === 'رد قائمة') {
      const threadRules = replyRules.get(threadID);
      if (!threadRules || threadRules.size === 0) {
        return api.sendMessage('📋 لا توجد ردود مسجلة في هذه المجموعة.', threadID);
      }
      let list = '📋 قائمة الردود المسجلة:\n\n';
      threadRules.forEach((response, trigger) => {
        list += `• ${trigger} » ${response}\n`;
      });
      api.sendMessage(list, threadID, (err) => {
        if (err) console.error('[رد] خطأ:', err);
      });
      return;
    }
  },

  checkAutoReply(api, event) {
    const threadID = event.threadID;
    const body = event.body ? event.body.trim().toLowerCase() : '';
    if (!body) return;

    const threadRules = replyRules.get(threadID);
    if (!threadRules || threadRules.size === 0) return;

    if (threadRules.has(body)) {
      const response = threadRules.get(body);
      api.sendMessage(response, threadID, (err) => {
        if (err) console.error('[رد تلقائي] خطأ في الإرسال:', err);
      });
    }
  }
};
