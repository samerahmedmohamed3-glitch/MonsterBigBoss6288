const fs = require('fs');
const path = require('path');

const commands = new Map();

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

  console.log(`[مستر] 📩 رسالة من ${senderID} في ${threadID}: "${body.substring(0, 50)}"`);

  const replyCmd = commands.get('رد');
  if (replyCmd && replyCmd.checkAutoReply) {
    await replyCmd.checkAutoReply(api, event).catch(e =>
      console.error('[مستر] خطأ في checkAutoReply:', e.message)
    );
  }

  if (body === 'قصف' || body === 'قصف ايقاف' || body === 'قصف إيقاف') {
    const cmd = commands.get('قصف');
    if (cmd) cmd.execute(api, event).catch(e =>
      console.error('[مستر] خطأ في قصف:', e.message)
    );
    return;
  }

  if (body.startsWith('كاتش ') || body.startsWith('مجموعة ')) {
    const cmd = commands.get('كاتش');
    if (cmd) cmd.execute(api, event).catch(e =>
      console.error('[مستر] خطأ في كاتش/مجموعة:', e.message)
    );
    return;
  }

  if (body.startsWith('رد ') || body === 'رد قائمة') {
    const cmd = commands.get('رد');
    if (cmd) cmd.execute(api, event).catch(e =>
      console.error('[مستر] خطأ في رد:', e.message)
    );
    return;
  }
}

function handleEvent(api, event) {
  if (!event || !event.type) return;

  const catchCmd = commands.get('كاتش');
  if (!catchCmd) return;

  const logType = event.logMessageType || event.type || '';

  if (
    logType === 'log:user-nickname' ||
    logType === 'nickname' ||
    event.type === 'event' && event.logMessageType === 'log:user-nickname'
  ) {
    catchCmd.handleNicknameEvent(api, event);
  }

  if (
    logType === 'log:thread-name' ||
    logType === 'thread_name' ||
    event.type === 'event' && event.logMessageType === 'log:thread-name'
  ) {
    catchCmd.handleGroupNameEvent(api, event);
  }
}

module.exports = { loadCommands, handleMessage, handleEvent, commands };
