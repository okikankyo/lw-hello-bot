const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
console.log('🔥 NEW VERSION 🔥');
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

  const payload = {
    iss: CLIENT_ID,
    sub: SERVICE_ACCOUNT,
    iat: now,
    exp: now + 300
  };

  const privateKey = PRIVATE_KEY
    .replace(/^"(.*)"$/s, '$1')
    .replace(/\\n/g, '\n')
    .trim();

  const assertion = jwt.sign(payload, privateKey, {
    algorithm: 'RS256'
  });

  const params = new URLSearchParams();
  params.append(
    'grant_type',
    'urn:ietf:params:oauth:grant-type:jwt-bearer'
  );
  params.append('client_id', CLIENT_ID);
  params.append('client_secret', CLIENT_SECRET);
  params.append('assertion', assertion);

  const response = await axios.post(
    'https://auth.worksmobile.com/oauth2/v2.0/token',
    params,
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  );

  return response.data.access_token;
}

// メッセージ送信
async function sendMessage(userId, token, text) {
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
}

// 受信 → Hello World返信
app.post('/', async (req, res) => {
  console.log('受信:', JSON.stringify(req.body, null, 2));
  res.sendStatus(200);

  try {
    if (req.body.type !== 'message') return;
    if (!req.body.source?.userId) return;

    const userId = req.body.source.userId;

    const token = await getAccessToken();
    await sendMessage(userId, token, 'Hello World');

    console.log('✅ 送信成功');
  } catch (e) {
    console.error('❌ エラー:', e.response?.data || e.message);
  }
});

// 動作確認
app.get('/', (req, res) => {
  res.send('Hello World Server');
});

app.listen(10000, () => {
  console.log('Server started');
});
