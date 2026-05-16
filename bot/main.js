const fs = require('fs');
const path = require('path');

const BOT_ADMIN = '61590007074814';

const commands = new Map();

function loadCommands() {
  const commandsPath = path.join(__dirname, 'Commands');
  const files = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
  for (const file of files) {
    try {
      const cmd = require(path.join(commandsPath, file));
      commands.set(cmd.name, cmd);
      console.log(`[مستر] ✅ تم تحميل الأمر: ${cmd.name}`);
    } catch (e) {
      console.error(`[مستر] ❌ خطأ في تحميل الأمر ${file}:`, e);
    }
  }
  console.log(`[مستر] تم تحميل ${commands.size} أمر بنجاح.`);
}

function handleMessage(api, event) {
  if (!event || !event.body) return;

  const body = event.body.trim();
  const threadID = event.threadID;
  const senderID = event.senderID;

  const autoReplyCmd = commands.get('رد');
  if (autoReplyCmd && autoReplyCmd.checkAutoReply) {
    autoReplyCmd.checkAutoReply(api, event);
  }

  if (body === 'قصف' || body === 'قصف ايقاف' || body === 'قصف إيقاف') {
    const qasafCmd = commands.get('قصف');
    if (qasafCmd) {
      qasafCmd.execute(api, event, []).catch(e => {
        console.error('[مستر] خطأ في أمر قصف:', e);
      });
    }
    return;
  }

  if (body.startsWith('كاتش ') || body.startsWith('مجموعة ')) {
    const catchCmd = commands.get('كاتش');
    if (catchCmd) {
      catchCmd.execute(api, event, []).catch(e => {
        console.error('[مستر] خطأ في أمر كاتش/مجموعة:', e);
      });
    }
    return;
  }

  if (body.startsWith('رد ') || body === 'رد قائمة') {
    const replyCmd = commands.get('رد');
    if (replyCmd) {
      replyCmd.execute(api, event, []);
    }
    return;
  }
}

function handleEvent(api, event) {
  if (!event) return;

  const catchCmd = commands.get('كاتش');
  if (!catchCmd) return;

  if (event.logMessageType === 'log:user-nickname') {
    catchCmd.handleNicknameEvent(api, event);
  }

  if (event.logMessageType === 'log:thread-name') {
    catchCmd.handleGroupNameEvent(api, event);
  }
}

module.exports = {
  loadCommands,
  handleMessage,
  handleEvent,
  commands
};
