const protectedNicknames = new Map();
const protectedGroupNames = new Map();

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  name: 'كاتش',

  getProtectedNicknames() {
    return protectedNicknames;
  },

  getProtectedGroupNames() {
    return protectedGroupNames;
  },

  async execute(api, event, args) {
    const threadID = event.threadID;
    const body = event.body ? event.body.trim() : '';

    if (body.startsWith('كاتش ')) {
      const nickname = body.replace('كاتش ', '').trim();
      if (!nickname) {
        return api.sendMessage('⚠️ يرجى تحديد الاسم. مثال: كاتش مستر', threadID);
      }

      api.sendMessage(`⏳ جاري تغيير كنيات الأعضاء إلى: ${nickname}`, threadID, (err) => {
        if (err) console.error('[كاتش] خطأ:', err);
      });

      try {
        const threadInfo = await new Promise((resolve, reject) => {
          api.getThreadInfo(threadID, (err, info) => {
            if (err) reject(err);
            else resolve(info);
          });
        });

        const participantIDs = threadInfo.participantIDs || [];
        console.log(`[كاتش] عدد الأعضاء: ${participantIDs.length}`);

        protectedNicknames.set(threadID, nickname);

        for (const uid of participantIDs) {
          try {
            await new Promise((resolve, reject) => {
              api.changeNickname(nickname, threadID, uid, (err) => {
                if (err) {
                  console.error(`[كاتش] خطأ في تغيير كنية ${uid}:`, err);
                }
                resolve();
              });
            });
            await sleep(3000);
          } catch (e) {
            console.error(`[كاتش] استثناء عند تغيير كنية ${uid}:`, e);
          }
        }

        api.sendMessage(`✅ تم تغيير كنيات جميع الأعضاء إلى: ${nickname}\n🛡️ الحماية مفعّلة — أي تغيير سيُعاد تلقائياً`, threadID, (err) => {
          if (err) console.error('[كاتش] خطأ:', err);
        });

      } catch (e) {
        console.error('[كاتش] خطأ في جلب معلومات المجموعة:', e);
        api.sendMessage('❌ حدث خطأ أثناء تغيير الكنيات.', threadID, (err) => {
          if (err) console.error('[كاتش] خطأ:', err);
        });
      }
      return;
    }

    if (body.startsWith('مجموعة ')) {
      const groupName = body.replace('مجموعة ', '').trim();
      if (!groupName) {
        return api.sendMessage('⚠️ يرجى تحديد الاسم. مثال: مجموعة مستر', threadID);
      }

      protectedGroupNames.set(threadID, groupName);

      api.setTitle(groupName, threadID, (err) => {
        if (err) {
          console.error('[مجموعة] خطأ في تغيير اسم المجموعة:', err);
          api.sendMessage('❌ حدث خطأ في تغيير اسم المجموعة.', threadID);
        } else {
          api.sendMessage(`✅ تم تغيير اسم المجموعة إلى: ${groupName}\n🛡️ الحماية مفعّلة — أي تغيير سيُعاد تلقائياً`, threadID, (err2) => {
            if (err2) console.error('[مجموعة] خطأ:', err2);
          });
        }
      });
      return;
    }
  },

  handleNicknameEvent(api, event) {
    const threadID = event.threadID;
    const protectedName = protectedNicknames.get(threadID);
    if (!protectedName) return;

    const changedUID = event.userID;
    const newNickname = event.nickname;

    if (newNickname !== protectedName) {
      console.log(`[حماية الكنيات] تم رصد تغيير كنية ${changedUID} في ${threadID} — جاري الإعادة...`);
      setTimeout(() => {
        api.changeNickname(protectedName, threadID, changedUID, (err) => {
          if (err) {
            console.error('[حماية الكنيات] خطأ في إعادة الكنية:', err);
          } else {
            console.log(`[حماية الكنيات] تمت إعادة كنية ${changedUID} إلى "${protectedName}"`);
          }
        });
      }, 500);
    }
  },

  handleGroupNameEvent(api, event) {
    const threadID = event.threadID;
    const protectedName = protectedGroupNames.get(threadID);
    if (!protectedName) return;

    const newName = event.name;
    if (newName !== protectedName) {
      console.log(`[حماية المجموعة] تم رصد تغيير اسم المجموعة في ${threadID} — جاري الإعادة...`);
      setTimeout(() => {
        api.setTitle(protectedName, threadID, (err) => {
          if (err) {
            console.error('[حماية المجموعة] خطأ في إعادة الاسم:', err);
          } else {
            console.log(`[حماية المجموعة] تمت إعادة اسم المجموعة إلى "${protectedName}"`);
          }
        });
      }, 500);
    }
  }
};
