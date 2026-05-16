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

        let successCount = 0;
        for (const uid of participants) {
          try {
            await api.nickname(nickname, threadID, String(uid));
            successCount++;
            console.log(`[كاتش] ✅ تم تغيير كنية ${uid}`);
          } catch (e) {
            console.error(`[كاتش] خطأ في كنية ${uid}:`, e.message || e);
          }
          await sleep(3000);
        }

        try {
          await api.sendMessage(
            `✅ تم تغيير كنيات ${successCount}/${participants.length} عضو إلى: ${nickname}\n🛡️ الحماية مفعّلة — أي تغيير سيُعاد تلقائياً`,
            threadID
          );
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
        await api.sendMessage(
          `✅ تم تغيير اسم المجموعة إلى: ${groupName}\n🛡️ الحماية مفعّلة — أي تغيير سيُعاد تلقائياً`,
          threadID
        );
        console.log(`[مجموعة] ✅ تم تغيير الاسم إلى "${groupName}" في ${threadID}`);
      } catch (e) {
        console.error('[مجموعة] خطأ:', e.message || e);
        try { await api.sendMessage('❌ حدث خطأ في تغيير الاسم.', threadID); } catch (_) {}
      }
      return;
    }
  },

  // حدث تغيير الكنية: type=event, logMessageType=log:user-nickname
  // logMessageData = untypedData من AdminTextMessage: { participant_id, nickname }
  handleNicknameEvent(api, event) {
    const threadID = String(event.threadID);
    const protectedName = protectedNicknames.get(threadID);
    if (!protectedName) return;

    const data = event.logMessageData || {};
    const changedUID = String(data.participant_id || data.participantID || event.userID || '');
    const newNickname = data.nickname || data.newNickname || '';

    if (!changedUID) return;
    if (newNickname === protectedName) return;

    console.log(`[حماية كنيات] رصد تغيير "${newNickname}" للعضو ${changedUID} — إعادة إلى "${protectedName}"...`);

    setTimeout(async () => {
      try {
        await api.nickname(protectedName, threadID, changedUID);
        console.log(`[حماية كنيات] ✅ أُعيدت كنية ${changedUID} إلى "${protectedName}"`);
      } catch (e) {
        console.error('[حماية كنيات] خطأ:', e.message || e);
      }
    }, 300);
  },

  // حدث تغيير اسم المجموعة: type=event, logMessageType=log:thread-name
  // logMessageData = { name: ... }
  handleGroupNameEvent(api, event) {
    const threadID = String(event.threadID);
    const protectedName = protectedGroupNames.get(threadID);
    if (!protectedName) return;

    const data = event.logMessageData || {};
    const newName = data.name || data.threadName || event.name || '';

    if (!newName || newName === protectedName) return;

    console.log(`[حماية مجموعة] رصد تغيير الاسم إلى "${newName}" — إعادة إلى "${protectedName}"...`);

    setTimeout(async () => {
      try {
        await api.gcname(protectedName, threadID);
        console.log(`[حماية مجموعة] ✅ أُعيد الاسم إلى "${protectedName}"`);
      } catch (e) {
        console.error('[حماية مجموعة] خطأ:', e.message || e);
      }
    }, 300);
  }
};
