const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');

console.log('🔥 NEW VERSION 🔥');
console.log('🔥 MESSAGE UPDATED 🔥');

const app = express();
app.use(express.json());

const CLIENT_ID = process.env.LW_CLIENT_ID;
const CLIENT_SECRET = process.env.LW_CLIENT_SECRET;
const SERVICE_ACCOUNT = process.env.LW_SERVICE_ACCOUNT;
const PRIVATE_KEY = process.env.LW_PRIVATE_KEY;
const BOT_ID = process.env.LW_BOT_ID;

// アクセストークン取得
async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);

  console.log('CLIENT_ID exists:', !!CLIENT_ID);
  console.log('CLIENT_SECRET exists:', !!CLIENT_SECRET);
  console.log('SERVICE_ACCOUNT exists:', !!SERVICE_ACCOUNT);
  console.log('BOT_ID exists:', !!BOT_ID);

  const privateKey = (PRIVATE_KEY || '')
    .replace(/^"(.*)"$/s, '$1')
    .replace(/\\n/g, '\n')
    .trim();

  console.log('PRIVATE_KEY header ok:', privateKey.includes('BEGIN PRIVATE KEY'));
  console.log('PRIVATE_KEY footer ok:', privateKey.includes('END PRIVATE KEY'));

  const payload = {
    iss: CLIENT_ID,
    sub: SERVICE_ACCOUNT,
    iat: now,
    exp: now + 300
  };

  const assertion = jwt.sign(payload, privateKey, {
    algorithm: 'RS256'
  });

  const params = new URLSearchParams();
  params.append('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer');
  params.append('client_id', CLIENT_ID);
  params.append('client_secret', CLIENT_SECRET);
  params.append('assertion', assertion);
  params.append('scope', 'bot.message');

  try {
    const response = await axios.post(
      'https://auth.worksmobile.com/oauth2/v2.0/token',
      params,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    console.log('✅ token取得成功');
    return response.data.access_token;
  } catch (e) {
    console.error('❌ token取得失敗:', e.response?.data || e.message);
    throw e;
  }
}

// メッセージ送信
async function sendMessage(userId, token, text) {
  try {
    await axios.post(
      `https://www.worksapis.com/v1.0/bots/${BOT_ID}/users/${userId}/messages`,
      {
        content: {
          type: 'text',
          text
        }
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ メッセージ送信成功');
  } catch (e) {
    console.error('❌ メッセージ送信失敗:', e.response?.data || e.message);
    throw e;
  }
}

// Webhook受信
app.post('/', async (req, res) => {
  console.log('受信:', JSON.stringify(req.body, null, 2));
  res.sendStatus(200);

  try {
    if (req.body.type !== 'message') return;
    if (!req.body.source?.userId) return;

    const userId = req.body.source.userId;
    const token = await getAccessToken();

// ここから    
await sendMessage(
  userId,
  token,
  `毎月10日・15日・20日・25日はクリーンデーです🧹

次回クリーンデーの日時と場所を確認しています。
予定通りでよろしいでしょうか？

天気予報はこちら👇
https://weathernews.jp/onebox/tenki/okinawa/47311/`
);
// ここまで
    
  } catch (e) {
    console.error('❌ 全体エラー:', e.response?.data || e.message);
  }
});

// 動作確認
app.get('/', (req, res) => {
  res.send('Hello World Server');
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server started on ${PORT}`);
});

// Cron実行用
if (process.env.CRON === 'true') {
  (async () => {
    try {
      console.log('⏰ Cron実行');

      const token = await getAccessToken();
      const userId = process.env.LW_TARGET_USER_ID;

      await sendMessage(userId, token, 'Hello World');

      console.log('✅ Cron送信成功');
      process.exit(0);
    } catch (e) {
      console.error('❌ Cronエラー:', e.response?.data || e.message);
      process.exit(1);
    }
  })();
}
