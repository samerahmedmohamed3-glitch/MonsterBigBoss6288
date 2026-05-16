process.on('uncaughtException', (err) => {
  console.error('[مستر] 🔴 خطأ غير متوقع (uncaughtException):', err);
  console.log('[مستر] 🟢 البوت يتابع العمل رغم الخطأ...');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[مستر] 🔴 رفض وعد غير معالج (unhandledRejection):', reason);
  console.log('[مستر] 🟢 البوت يتابع العمل رغم الخطأ...');
});

const fs = require('fs');
const path = require('path');
const express = require('express');
const login = require('fca-unofficial');
const { loadCommands, handleMessage, handleEvent } = require('./main');

const PORT = process.env.PORT || 3000;
const app = express();

app.get('/', (req, res) => {
  res.json({
    status: '🟢 بوت مستر يعمل بكامل قوته!',
    bot: 'مستر',
    uptime: process.uptime() + ' ثانية',
    timestamp: new Date().toISOString()
  });
});

app.get('/ping', (req, res) => {
  res.send('pong - مستر حي ويعمل 💀');
});

app.listen(PORT, () => {
  console.log(`[مستر] 🌐 خادم Uptime يعمل على المنفذ ${PORT}`);
});

let botApi = null;
let msgEmitter = null;
let isRestarting = false;

function startBot() {
  if (isRestarting) return;

  const appstatePath = path.join(__dirname, 'appstate.json');

  if (!fs.existsSync(appstatePath)) {
    console.error('[مستر] ❌ ملف appstate.json غير موجود!');
    return;
  }

  let appstate;
  try {
    appstate = JSON.parse(fs.readFileSync(appstatePath, 'utf8'));
  } catch (e) {
    console.error('[مستر] ❌ خطأ في قراءة appstate.json:', e);
    return;
  }

  console.log('[مستر] 🚀 جاري تسجيل الدخول...');

  login({ appState: appstate }, (err, api) => {
    if (err) {
      console.error('[مستر] ❌ فشل تسجيل الدخول:', JSON.stringify(err));
      console.log('[مستر] ⏳ إعادة المحاولة بعد 15 ثانية...');
      isRestarting = false;
      setTimeout(startBot, 15000);
      return;
    }

    console.log('[مستر] ✅ تم تسجيل الدخول بنجاح!');
    console.log('[مستر] 🤖 البوت "مستر" يعمل الآن بكامل قوته...');
    isRestarting = false;
    botApi = api;

    api.setOptions({
      listenEvents: true,
      logLevel: 'silent',
      selfListen: false,
      updatePresence: false,
      forceLogin: false
    });

    try {
      const updatedAppstate = api.getAppState();
      fs.writeFileSync(appstatePath, JSON.stringify(updatedAppstate, null, 2));
      console.log('[مستر] 💾 تم تحديث appstate.json');
    } catch (e) {
      console.error('[مستر] تحذير: لم يتم حفظ appstate:', e.message);
    }

    loadCommands();

    startListening(api);

    setInterval(() => {
      try {
        const state = api.getAppState();
        if (state && state.length > 0) {
          fs.writeFileSync(appstatePath, JSON.stringify(state, null, 2));
        }
      } catch (e) {
        console.error('[مستر] خطأ في حفظ appstate:', e);
      }
    }, 30 * 60 * 1000);

    console.log('[مستر] 👂 البوت يستمع للرسائل...');
    console.log('[مستر] ─────────────────────────────────');
    console.log('[مستر] 📋 الأوامر المتاحة:');
    console.log('[مستر]   • قصف          — إرسال الجريدة بحلقة لا نهائية');
    console.log('[مستر]   • قصف ايقاف   — إيقاف الإرسال');
    console.log('[مستر]   • كاتش [اسم]  — تغيير كنيات جميع الأعضاء');
    console.log('[مستر]   • مجموعة [اسم] — تغيير اسم المجموعة مع الحماية');
    console.log('[مستر]   • رد [كلمة]» [رد] — إضافة رد تلقائي');
    console.log('[مستر] ─────────────────────────────────');
  });
}

function startListening(api) {
  try {
    msgEmitter = api.listenMqtt((err, event) => {
      if (err) {
        console.error('[مستر] ⚠️ خطأ في الاستماع:', JSON.stringify(err));

        if (err && err.error === 'Not logged in') {
          console.log('[مستر] 🔐 انتهت الجلسة — إعادة تسجيل الدخول بعد 10 ثوانٍ...');
          scheduleRestart(10000);
          return;
        }

        console.log('[مستر] 🔄 إعادة الاستماع بعد 5 ثوانٍ...');
        scheduleRestart(5000);
        return;
      }

      if (!event) return;

      try {
        if (event.type === 'message' || event.type === 'message_reply') {
          handleMessage(api, event);
        } else {
          handleEvent(api, event);
        }
      } catch (e) {
        console.error('[مستر] ⚠️ خطأ في معالجة الحدث:', e);
      }
    });

    if (msgEmitter && msgEmitter.on) {
      msgEmitter.on('error', (err) => {
        console.error('[مستر] ⚠️ حدث خطأ في MessageEmitter:', err);
        scheduleRestart(5000);
      });
    }

  } catch (e) {
    console.error('[مستر] ❌ استثناء في startListening:', e);
    scheduleRestart(10000);
  }
}

function scheduleRestart(delay) {
  if (isRestarting) return;
  isRestarting = true;

  try {
    if (msgEmitter && typeof msgEmitter.stopListening === 'function') {
      msgEmitter.stopListening(() => {});
    }
  } catch (e) {
    console.error('[مستر] تحذير في إيقاف الاستماع:', e.message);
  }

  msgEmitter = null;
  botApi = null;

  console.log(`[مستر] ⏳ إعادة الاتصال بعد ${delay / 1000} ثانية...`);
  setTimeout(() => {
    isRestarting = false;
    startBot();
  }, delay);
}

startBot();
