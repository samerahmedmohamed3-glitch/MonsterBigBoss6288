process.on('uncaughtException', (err) => {
  console.error('[مستر] 🔴 خطأ غير متوقع (uncaughtException):', err);
  console.log('[مستر] 🟢 البوت يتابع العمل رغم الخطأ...');
});

process.on('unhandledRejection', (reason) => {
  console.error('[مستر] 🔴 رفض وعد غير معالج (unhandledRejection):', reason);
  console.log('[مستر] 🟢 البوت يتابع العمل رغم الخطأ...');
});

const fs = require('fs');
const path = require('path');
const express = require('express');
const { login } = require('ws3-fca');
const { loadCommands, handleMessage, handleEvent } = require('./main');

const PORT = process.env.PORT || 3000;
const app = express();

app.get('/', (req, res) => {
  res.json({
    status: '🟢 بوت مستر يعمل بكامل قوته!',
    bot: 'مستر',
    uptime: Math.floor(process.uptime()) + ' ثانية',
    timestamp: new Date().toISOString()
  });
});

app.get('/ping', (req, res) => res.send('pong - مستر حي ويعمل 💀'));

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
    console.error('[مستر] ❌ خطأ في قراءة appstate.json:', e.message);
    return;
  }

  console.log('[مستر] 🚀 جاري تسجيل الدخول...');

  login(
    { appState: appstate },
    {
      listenEvents: true,
      selfListen: false,
      autoMarkDelivery: false,
      autoMarkRead: false,
      forceLogin: false,
      autoReconnect: true,
      online: true
    },
    (err, api) => {
      if (err) {
        console.error('[مستر] ❌ فشل تسجيل الدخول:', JSON.stringify(err));
        console.log('[مستر] ⏳ إعادة المحاولة بعد 15 ثانية...');
        isRestarting = false;
        setTimeout(startBot, 15000);
        return;
      }

      console.log('[مستر] ✅ تم تسجيل الدخول بنجاح!');
      isRestarting = false;
      botApi = api;

      try {
        const state = api.getAppState();
        if (state && state.length > 0) {
          fs.writeFileSync(appstatePath, JSON.stringify(state, null, 2));
          console.log('[مستر] 💾 تم تحديث appstate.json');
        }
      } catch (e) {
        console.error('[مستر] تحذير: لم يتم حفظ appstate:', e.message);
      }

      const ctx = api.ctx;
      if (ctx) {
        if (ctx.lastSeqId) {
          ctx.firstListen = true;
          console.log(`[مستر] 🔑 تم الحصول على Sequence ID من صفحة تسجيل الدخول: ${ctx.lastSeqId}`);
        } else {
          console.log('[مستر] ⚠️ لم يُعثر على irisSeqID في الصفحة، جاري محاولة GraphQL...');
        }
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
          console.error('[مستر] خطأ في حفظ appstate:', e.message);
        }
      }, 30 * 60 * 1000);

      startMemorySweeper(api);

      console.log('[مستر] 🤖 البوت "مستر" يعمل الآن بكامل قوته...');
      console.log('[مستر] ─────────────────────────────────');
      console.log('[مستر] 📋 الأوامر المتاحة:');
      console.log('[مستر]   • قصف           — إرسال الجريدة بحلقة لا نهائية');
      console.log('[مستر]   • قصف ايقاف    — إيقاف الإرسال');
      console.log('[مستر]   • كاتش [اسم]   — تغيير كنيات جميع الأعضاء');
      console.log('[مستر]   • مجموعة [اسم] — تغيير اسم المجموعة مع الحماية');
      console.log('[مستر]   • رد [كلمة]» [رد] — إضافة رد تلقائي');
      console.log('[مستر] ─────────────────────────────────');
    }
  );
}

async function startListening(api) {
  try {
    msgEmitter = await api.listenMqtt();

    if (!msgEmitter || typeof msgEmitter.on !== 'function') {
      console.error('[مستر] ❌ listenMqtt لم تُرجع EventEmitter صالحاً');
      scheduleRestart(10000);
      return;
    }

    msgEmitter.on('error', (err) => {
      console.error('[مستر] ⚠️ خطأ في الاستماع:', JSON.stringify(err));
      const errMsg = String(err && (err.message || err.error || err));
      if (
        errMsg.includes('Not logged in') ||
        errMsg.includes('sequence ID') ||
        errMsg.includes('appstate') ||
        errMsg.includes('Failed to get')
      ) {
        console.log('[مستر] 🔄 إعادة تسجيل الدخول بعد 15 ثانية...');
        scheduleRestart(15000);
      } else {
        console.log('[مستر] 🔄 إعادة الاتصال بعد 5 ثوانٍ...');
        scheduleRestart(5000);
      }
    });

    msgEmitter.on('message', (event) => {
      if (!event) return;
      try {
        if (event.type === 'message' || event.type === 'message_reply') {
          handleMessage(api, event);
        } else {
          handleEvent(api, event);
        }
      } catch (e) {
        console.error('[مستر] ⚠️ خطأ في معالجة الحدث:', e.message);
      }
    });

    console.log('[مستر] 👂 البوت يستمع للرسائل...');

  } catch (e) {
    console.error('[مستر] ❌ استثناء في startListening:', e.message);
    scheduleRestart(10000);
  }
}

function startMemorySweeper(api) {
  const SWEEP_INTERVAL = 10 * 60 * 1000;

  setInterval(() => {
    try {
      if (api && api._msgQueue) {
        api._msgQueue = [];
      }
      if (api && api._events) {
        const safeEvents = ['message', 'error', 'close', 'reconnect'];
        for (const key of Object.keys(api._events)) {
          if (!safeEvents.includes(key)) {
            delete api._events[key];
          }
        }
      }
      if (api && api._messageCache && typeof api._messageCache.clear === 'function') {
        api._messageCache.clear();
      } else if (api && api._messageCache && typeof api._messageCache === 'object') {
        const keys = Object.keys(api._messageCache);
        if (keys.length > 50) {
          keys.slice(0, keys.length - 50).forEach(k => delete api._messageCache[k]);
        }
      }
      if (api && api._threadCache && typeof api._threadCache === 'object') {
        const keys = Object.keys(api._threadCache);
        if (keys.length > 20) {
          keys.slice(0, keys.length - 20).forEach(k => delete api._threadCache[k]);
        }
      }
      if (typeof global.gc === 'function') {
        global.gc();
      }
      console.log('[SYSTEM] 🟢 Memory & Cache cleared successfully to maintain optimal performance.');
    } catch (e) {
      // صامت — لا نوقف البوت
    }
  }, SWEEP_INTERVAL);
}

function scheduleRestart(delay) {
  if (isRestarting) return;
  isRestarting = true;

  try {
    if (msgEmitter && typeof msgEmitter.stop === 'function') {
      msgEmitter.stop();
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
