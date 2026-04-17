const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');

console.log('🔥 CLEAN DAY BOT START (CHANNEL VERSION)');

const app = express();
app.use(express.json());

const CLIENT_ID = process.env.LW_CLIENT_ID;
const CLIENT_SECRET = process.env.LW_CLIENT_SECRET;
const SERVICE_ACCOUNT = process.env.LW_SERVICE_ACCOUNT;
const PRIVATE_KEY = process.env.LW_PRIVATE_KEY;
const BOT_ID = process.env.LW_BOT_ID;

// =======================
// アクセストークン取得
// =======================
async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);

  const privateKey = (PRIVATE_KEY || '')
    .replace(/^"(.*)"$/s, '$1')
    .replace(/\\n/g, '\n')
    .trim();

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
}

// =======================
// グループ送信（channelId）
// =======================
async function sendMessage(token, text) {
  const channelId = process.env.LW_TARGET_CHANNEL_ID;

  if (!channelId) {
    throw new Error('LW_TARGET_CHANNEL_ID が未設定です');
  }

  await axios.post(
    `https://www.worksapis.com/v1.0/bots/${BOT_ID}/channels/${channelId}/messages`,
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

  console.log('✅ グループ送信成功');
}

// =======================
// クリーンデー通知本文
// =======================
function buildCleanDayMessage() {
  return `毎月10日・15日・20日・25日はクリーンデーです🧹

次回クリーンデーの日時と場所を確認しています。
予定通りでよろしいでしょうか？

天気予報はこちら👇
https://weathernews.jp/onebox/tenki/okinawa/47311/`;
}

// =======================
// Webhook受信（必要なら）
// WEBHOOK=true のときだけ返信
// ※ room/channel確認用に残してもOK
// =======================
app.post('/', async (req, res) => {
  console.log('📩 受信:', JSON.stringify(req.body, null, 2));
  res.sendStatus(200);

  try {
    if (req.body.type !== 'message') return;

    if (process.env.WEBHOOK !== 'true') {
      console.log('📩 受信のみモード（返信しない）');
      return;
    }

    const source = req.body.source || {};
    const token = await getAccessToken();

    if (source.userId) {
      await axios.post(
        `https://www.worksapis.com/v1.0/bots/${BOT_ID}/users/${source.userId}/messages`,
        {
          content: {
            type: 'text',
            text: 'メッセージ受信しました。'
          }
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      console.log('✅ 個人返信成功');
      return;
    }

    if (source.channelId) {
      await axios.post(
        `https://www.worksapis.com/v1.0/bots/${BOT_ID}/channels/${source.channelId}/messages`,
        {
          content: {
            type: 'text',
            text: 'メッセージ受信しました。'
          }
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      console.log('✅ グループ返信成功');
    }
  } catch (e) {
    console.error('❌ Webhookエラー:', e.response?.data || e.message);
  }
});

// =======================
// 動作確認
// =======================
app.get('/', (req, res) => {
  res.send('Clean Day Bot Running');
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server started on ${PORT}`);
});

// =======================
// Cron実行
// RenderのCronは 0 0 * * * にする
// 毎日9:00 JST に1回起動し、対象日だけ送信
// =======================
if (process.env.CRON === 'true') {
  (async () => {
    try {
      console.log('⏰ Cron実行');

      const now = new Date();
      const day = now.getDate();

      // クリーンデー（10,15,20,25）の2日前
      const targetDays = [8, 13, 18, 23];

      if (!targetDays.includes(day)) {
        console.log('⏭ 条件外スキップ');
        process.exit(0);
      }

      console.log('🎯 送信条件一致');

      const token = await getAccessToken();
      await sendMessage(token, buildCleanDayMessage());

      console.log('✅ Cron送信成功');
      process.exit(0);

    } catch (e) {
      console.error('❌ Cronエラー:', e.response?.data || e.message);
      process.exit(1);
    }
  })();
}
