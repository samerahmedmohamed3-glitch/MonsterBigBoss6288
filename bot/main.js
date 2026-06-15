const fs = require('fs');
const path = require('path');

const ADMINS = new Set(['61585746602239', '61590778917938']);
const commands = new Map();

function isAdmin(senderID) {
  return ADMINS.has(String(senderID));
}

function loadCommands() {
  const commandsPath = path.join(__dirname, 'Commands');
  const files = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
  commands.clear();
  for (const file of files) {
    try {
      delete require.cache[require.resolve(path.join(commandsPath, file))];
      const cmd = require(path.join(commandsPath, file));
      commands.set(cmd.name, cmd);
      console.log(`[مستر] ✅ تم تحميل: ${cmd.name}`);
    } catch (e) {
      console.error(`[مستر] ❌ خطأ في تحميل ${file}:`, e.message);
    }
  }
  console.log(`[مستر] تم تحميل ${commands.size} أمر.`);
}

async function handleMessage(api, event) {
  if (!event || !event.body) return;

  const body = (event.body || '').trim();
  const threadID = String(event.threadID);
  const senderID = String(event.senderID || '');

  console.log(`[مستر] 📩 رسالة من ${senderID} في ${threadID}: "${body.substring(0, 60)}"`);

  // الرد التلقائي — يعمل دائماً قبل فحص الأوامر (ليس بالإدمن فقط)
  const replyCmd = commands.get('رد');
  if (replyCmd && replyCmd.checkAutoReply) {
    await replyCmd.checkAutoReply(api, event).catch(e =>
      console.error('[مستر] خطأ في checkAutoReply:', e.message)
    );
  }

  // أوامر محمية: يستخدمها الإدمن فقط
  if (body === 'قصف' || body === 'قصف ايقاف' || body === 'قصف إيقاف') {
    if (!isAdmin(senderID)) return;
    const cmd = commands.get('قصف');
    if (cmd) cmd.execute(api, event).catch(e =>
      console.error('[مستر] خطأ في قصف:', e.message)
    );
    return;
  }

  if (body.startsWith('كاتش ') || body.startsWith('مجموعة ') || body.startsWith('جروب ')) {
    if (!isAdmin(senderID)) return;
    const cmd = commands.get('كاتش');
    if (cmd) cmd.execute(api, event).catch(e =>
      console.error('[مستر] خطأ في كاتش/مجموعة:', e.message)
    );
    return;
  }

  if (body.startsWith('رد ') || body === 'رد قائمة') {
    if (!isAdmin(senderID)) return;
    const cmd = commands.get('رد');
    if (cmd) cmd.execute(api, event).catch(e =>
      console.error('[مستر] خطأ في رد:', e.message)
    );
    return;
  }
}

function handleEvent(api, event) {
  if (!event) return;

  // طباعة الحدث للتشخيص
  const logType = event.logMessageType || event.type || '';
  if (logType !== 'read_receipt') {
    console.log(`[مستر] 📌 حدث: type=${event.type} | logType=${logType}`);
  }

  const catchCmd = commands.get('كاتش');
  if (!catchCmd) return;

  // حماية الكنيات — حدث تغيير الكنية
  if (logType === 'log:user-nickname') {
    catchCmd.handleNicknameEvent(api, event);
  }

  // حماية اسم المجموعة — حدث تغيير الاسم
  if (logType === 'log:thread-name') {
    catchCmd.handleGroupNameEvent(api, event);
  }
}

module.exports = { loadCommands, handleMessage, handleEvent, commands };
