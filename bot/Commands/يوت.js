const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const YTDL_PATH = '/home/runner/workspace/.pythonlibs/bin/yt-dlp';

function ytDlp(args, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const cmd = `"${YTDL_PATH}" ${args}`;
    const child = exec(cmd, { timeout: timeoutMs }, (err, stdout, stderr) => {
      if (err) {
        reject(err);
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

async function downloadAudio(query, outFile) {
  const args = `"ytsearch:${query.replace(/"/g, '\\"')}" -x --audio-format mp3 --audio-quality 0 --max-downloads 1 -o "${outFile}"`;
  return ytDlp(args, 120000);
}

function cleanup(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (e) {
    // ignore
  }
}

module.exports = {
  name: 'يوت',

  async execute(api, event) {
    const threadID = String(event.threadID);
    const body = (event.body || '').trim();

    if (!body.startsWith('يوت ')) return;
    const query = body.slice('يوت '.length).trim();
    if (!query) {
      try { await api.sendMessage('⚠️ مثال: يوت Imagine Dragons', threadID); } catch (e) {}
      return;
    }

    try { await api.sendMessage(`⏳ جاري البحث والتحميل: "${query}"...`, threadID); } catch (e) {}

    const outFile = path.join(__dirname, '..', 'tmp', 'yot-' + Date.now() + '.mp3');
    try {
      fs.mkdirSync(path.dirname(outFile), { recursive: true });
    } catch (e) {}

    try {
      await downloadAudio(query, outFile);

      if (!fs.existsSync(outFile)) {
        throw new Error('لم يتم إنشاء ملف الصوت');
      }

      const stats = fs.statSync(outFile);
      if (stats.size === 0) {
        throw new Error('ملف الصوت فارغ');
      }

      const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      console.log(`[يوت] جاري إرسال ملف الصوت: ${outFile} (${fileSizeMB} MB)`);

      try { await api.sendMessage({ attachment: fs.createReadStream(outFile) }, threadID); } catch (e) {
        console.error(`[يوت] خطأ في إرسال الملف:`, e.message || e);
        try { await api.sendMessage('❌ فشل في إرسال ملف الصوت.', threadID); } catch (e) {}
      }
    } catch (err) {
      console.error(`[يوت] خطأ:`, err.message || err);
      try {
        await api.sendMessage('❌ لم يتم العثور على المقطع أو فشل في التحميل.', threadID);
      } catch (e) {}
    } finally {
      cleanup(outFile);
    }
  }
};
