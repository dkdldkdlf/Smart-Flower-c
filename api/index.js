const axios = require('axios');
const lineToken = process.env.LINE_ACCESS_TOKEN;

// 서버리스 전역 상태 의존 최소화: 마지막 명령과 대상 ID를 "묶어서" 한 번에 전달
let pending = { command: '대기', to: null };

module.exports = async (req, res) => {
  // 1) LINE Webhook
  if (req.headers['x-line-signature']) {
    try {
      const events = req.body.events || [];
      for (const event of events) {
        if (event.type === 'message' && event.message?.type === 'text') {
          const userMessage = (event.message.text || '').trim();
          const replyToken = event.replyToken;
          const userId = event.source?.userId || null;

          let responseMessage = '';
          if (userMessage.includes('습도')) {
            pending = { command: '습도', to: userId };   // 명령 + 대상ID 같이 저장
            responseMessage = '🌡️ 습도 측정을 요청했습니다!\n잠시만 기다려주세요 ⏳';
          } else {
            // 다른 입력 → 안내만, 명령은 '대기'로 유지
            pending = { command: '대기', to: null };
            responseMessage = '안녕하세요! 스마트 화분 알리미입니다 🌱\n👉 "습도"를 입력해 현재 습도를 확인해보세요!';
          }

          await axios.post('https://api.line.me/v2/bot/message/reply', {
            replyToken,
            messages: [{ type: 'text', text: responseMessage }],
          }, {
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${lineToken}` }
          });
        }
      }
      return res.status(200).send('Webhook processed successfully.');
    } catch (error) {
      console.error('Error processing LINE webhook:', error.response?.data || error.message);
      return res.status(500).send('Error processing webhook.');
    }
  }

  // 2) ESP32 API
  try {
    if (req.method === 'POST') {
      const { action, message, to } = req.body || {};

      if (action === 'reply' && message) {
        // 우선순위: 본문으로 받은 to → pending.to → (없으면 에러)
        const target = to || pending.to;
        if (!target) return res.status(400).send('Bad Request: missing target userId.');

        await axios.post('https://api.line.me/v2/bot/message/push', {
          to: target,
          messages: [{ type: 'text', text: String(message) }],
        }, {
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${lineToken}` }
        });

        // 한 번 보냈으면 소모
        pending = { command: '대기', to: null };
        return res.status(200).send('Reply sent to LINE user.');
      }

      if (action === 'notify' && message) {
        // 알림용(관리자 고정)
        const adminUserID = 'U326ad71508358143c1673f43f39d0ebb';
        await axios.post('https://api.line.me/v2/bot/message/push', {
          to: adminUserID,
          messages: [{ type: 'text', text: String(message) }],
        }, {
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${lineToken}` }
        });
        return res.status(200).send('Notification sent to LINE user.');
      }

      return res.status(400).send('Bad Request: Missing parameters.');
    }

    if (req.method === 'GET') {
      const action = req.query.action;
      if (action === 'get_command') {
        // 명령과 대상 userId를 함께 전달 → ESP32가 그대로 되돌려 보냄
        const out = { command: pending.command, to: pending.to };
        // command만 소모하고, to는 유지 (ESP32가 reply에서 못 가져오면 1회 더 사용 가능)
        pending.command = '대기';
        return res.status(200).json(out);
      }
      return res.status(400).send('Bad Request: Invalid action.');
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).send('Method Not Allowed');
  } catch (e) {
    console.error('Server error:', e.response?.data || e.message);
    return res.status(500).send('Server error');
  }
};
