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
  const isLoggedIn = !!botApi;
  res.json({
    status: isLoggedIn ? '🟢 بوت مستر مسجّل دخول ويعمل' : '🔴 بوت مستر مفصول الدخول (الكوكيز منتهية)',
    bot: 'مستر',
    loggedIn: isLoggedIn,
    uptime: Math.floor(process.uptime()) + ' ثانية',
    timestamp: new Date().toISOString()
  });
});

app.get('/ping', (req, res) => res.send('pong - مستر حي ويعمل 💀'));

app.get('/testsend', async (req, res) => {
  const threadID = req.query.thread;
  if (!threadID || !botApi) {
    return res.status(400).json({ error: 'missing thread param or bot not ready' });
  }
  try {
    await botApi.sendMessage('💀 تجريبة إرسال من البوت', threadID);
    res.json({ success: true, threadID });
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

app.post('/updatecookies', express.json(), (req, res) => {
  const appstatePath = path.join(__dirname, 'appstate.json');
  try {
    const cookies = req.body;
    if (!Array.isArray(cookies) || cookies.length === 0) {
      return res.status(400).json({ error: 'Invalid cookies format. Must be an array.' });
    }
    fs.writeFileSync(appstatePath, JSON.stringify(cookies, null, 2));
    console.log('[مستر] ✅ تم تحديث الكوكيز عبر HTTP');
    res.json({ success: true, message: 'Cookies updated. Bot will reconnect on next attempt.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`[مستر] 🌐 خادم Uptime يعمل على المنفذ ${PORT}`);
});

let botApi = null;
let msgEmitter = null;
let isRestarting = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_BACKOFF = 30000; // 30 seconds max

// Heartbeat to keep MQTT alive
let heartbeatInterval = null;
function startHeartbeat(api) {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  heartbeatInterval = setInterval(() => {
    try {
      if (api && api.getCurrentUserID) {
        api.getCurrentUserID();
        console.log('[مستر] 💓 Heartbeat ping sent');
      }
    } catch (e) {
      console.error('[مستر] ⚠️ Heartbeat failed:', e.message);
    }
  }, 30000); // 30 seconds
}

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
        const errStr = JSON.stringify(err);
        console.error('[مستر] ❌ فشل تسجيل الدخول:', errStr);
        const errMsg = String(err && (err.message || err.error || errStr));

        if (errMsg.includes('retrieving userID') || errMsg.includes('blocked') || errMsg.includes('unknown location')) {
          console.log('[مستر] 🔴 فيسبوك حظر الجلسة أو الكوكيز منتهية.');
          console.log('[مستر] ⏳ إعادة المحاولة بعد 3 دقائق للتخفيف عن الحظر...');
          isRestarting = false;
          setTimeout(startBot, 3 * 60 * 1000);
          return;
        }

        console.log('[مستر] ⏳ إعادة المحاولة بعد 15 ثانية...');
        isRestarting = false;
        setTimeout(startBot, 15000);
        return;
      }

      console.log('[مستر] ✅ تم تسجيل الدخول بنجاح!');
      isRestarting = false;
      reconnectAttempts = 0; // reset on successful login
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
      startHeartbeat(api);

      // Resume spam loops on reconnect
      try {
        const { commands } = require('./main');
        const qasf = commands.get('قصف');
        if (qasf && qasf.resumeAll) {
          qasf.resumeAll(api);
        }
      } catch (e) {
        console.error('[مستر] خطأ في استئناف حلقات القصف:', e.message);
      }

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
      console.log('[مستر]   • قصف                    — إرسال الجريدة بحلقة لا نهائية');
      console.log('[مستر]   • قصف ايقاف              — إيقاف الإرسال');
      console.log('[مستر]   • كاتش [اسم]             — تغيير كنيات جميع الأعضاء');
      console.log('[مستر]   • مجموعة [اسم]           — تغيير اسم المجموعة مع الحماية');
      console.log('[مستر]   • مجموعة 2 »MIN|MAX [اسم] — تغيير الاسم مع حماية مؤجلة');
      console.log('[مستر]   • رد [كلمة]» [رد]        — إضافة رد تلقائي');
      console.log('[مستر] ─────────────────────────────────');
    }
  );
}

async function startListening(api) {
  try {
    const callback = (err, event) => {
      if (err) {
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
        return;
      }

      if (!event) return;
      try {
        const type = event.type || 'unknown';
        const threadID = String(event.threadID || '');
        const senderID = String(event.senderID || '');
        const body = (event.body || '').substring(0, 50);
        console.log(`[مستر] 📩 EVENT type=${type} thread=${threadID} sender=${senderID} body="${body}"`);
        if (event.type === 'message' || event.type === 'message_reply') {
          handleMessage(api, event);
        } else {
          handleEvent(api, event);
        }
      } catch (e) {
        console.error('[مستر] ⚠️ خطأ في معالجة الحدث:', e.message);
      }
    };

    msgEmitter = await api.listenMqtt(callback);

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
      if (api && api._msgQueue && Array.isArray(api._msgQueue)) {
        api._msgQueue = [];
      }
      if (api && api._messageCache && typeof api._messageCache === 'object') {
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

function scheduleRestart(baseDelay) {
  if (isRestarting) return;
  isRestarting = true;

  try {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  } catch (e) {}

  try {
    if (msgEmitter && typeof msgEmitter.stop === 'function') {
      msgEmitter.stop();
    }
  } catch (e) {
    console.error('[مستر] تحذير في إيقاف الاستماع:', e.message);
  }

  msgEmitter = null;
  botApi = null;

  // Exponential backoff: 5s → 15s → 30s
  reconnectAttempts++;
  const delay = Math.min(baseDelay * reconnectAttempts, MAX_RECONNECT_BACKOFF);

  console.log(`[مستر] ⏳ إعادة الاتصال بعد ${delay / 1000} ثانية (محاولة ${reconnectAttempts})...`);
  setTimeout(() => {
    isRestarting = false;
    startBot();
  }, delay);
}

startBot();
