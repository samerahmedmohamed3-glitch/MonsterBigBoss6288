const protectedNicknames = new Map();
const protectedGroupNames = new Map();

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  name: 'كاتش',

  getProtectedNicknames() { return protectedNicknames; },
  getProtectedGroupNames() { return protectedGroupNames; },

  async execute(api, event) {
    const threadID = String(event.threadID);
    const body = (event.body || '').trim();

    if (body.startsWith('كاتش ')) {
      const nickname = body.slice('كاتش '.length).trim();
      if (!nickname) {
        try { await api.sendMessage('⚠️ مثال: كاتش مستر', threadID); } catch (e) {}
        return;
      }

      try { await api.sendMessage(`⏳ جاري تغيير الكنيات إلى: ${nickname}`, threadID); } catch (e) {}

      try {
        const info = await api.getThreadInfo(threadID);
        const participants = info.participantIDs || [];
        console.log(`[كاتش] ${participants.length} عضو في المجموعة`);

        protectedNicknames.set(threadID, nickname);

        for (const uid of participants) {
          try {
            await api.setNickname(nickname, threadID, String(uid));
          } catch (e) {
            console.error(`[كاتش] خطأ في كنية ${uid}:`, e.message || e);
          }
          await sleep(3000);
        }

        try {
          await api.sendMessage(`✅ تم تغيير كنيات الجميع إلى: ${nickname}\n🛡️ الحماية مفعّلة`, threadID);
        } catch (e) {}

      } catch (e) {
        console.error('[كاتش] خطأ:', e.message || e);
        try { await api.sendMessage('❌ حدث خطأ أثناء تغيير الكنيات.', threadID); } catch (_) {}
      }
      return;
    }

    if (body.startsWith('مجموعة ')) {
      const groupName = body.slice('مجموعة '.length).trim();
      if (!groupName) {
        try { await api.sendMessage('⚠️ مثال: مجموعة مستر', threadID); } catch (e) {}
        return;
      }

      protectedGroupNames.set(threadID, groupName);

      try {
        await api.gcname(groupName, threadID);
        await api.sendMessage(`✅ تم تغيير اسم المجموعة إلى: ${groupName}\n🛡️ الحماية مفعّلة`, threadID);
      } catch (e) {
        console.error('[مجموعة] خطأ:', e.message || e);
        try { await api.sendMessage('❌ حدث خطأ في تغيير الاسم.', threadID); } catch (_) {}
      }
      return;
    }
  },

  handleNicknameEvent(api, event) {
    const threadID = String(event.threadID);
    const protectedName = protectedNicknames.get(threadID);
    if (!protectedName) return;

    const changedUID = String(event.userID || event.participantID || '');
    const newNickname = event.nickname;

    if (changedUID && newNickname !== protectedName) {
      console.log(`[حماية كنيات] رصد تغيير ${changedUID} — إعادة...`);
      setTimeout(async () => {
        try {
          await api.setNickname(protectedName, threadID, changedUID);
          console.log(`[حماية كنيات] أُعيدت كنية ${changedUID} إلى "${protectedName}"`);
        } catch (e) {
          console.error('[حماية كنيات] خطأ:', e.message || e);
        }
      }, 500);
    }
  },

  handleGroupNameEvent(api, event) {
    const threadID = String(event.threadID);
    const protectedName = protectedGroupNames.get(threadID);
    if (!protectedName) return;

    const newName = event.name || event.threadName;
    if (newName && newName !== protectedName) {
      console.log(`[حماية مجموعة] رصد تغيير اسم — إعادة إلى "${protectedName}"...`);
      setTimeout(async () => {
        try {
          await api.gcname(protectedName, threadID);
          console.log(`[حماية مجموعة] أُعيد الاسم إلى "${protectedName}"`);
        } catch (e) {
          console.error('[حماية مجموعة] خطأ:', e.message || e);
        }
      }, 500);
    }
  }
};
