const axios = require('axios');
const lineToken = process.env.LINE_ACCESS_TOKEN;

// '명령'과 '사용자ID'를 하나의 객체로 묶어서 관리합니다.
let pendingRequest = { 
  command: '대기', 
  userId: null 
};

module.exports = async (req, res) => {
  // 1. LINE 플랫폼 Webhook 처리
  if (req.headers['x-line-signature']) {
    try {
      const events = req.body.events;
      // ✅ 수정: 중복된 for문을 하나로 합쳤습니다.
      for (const event of events) {
        if (event && event.type === 'message' && event.message.type === 'text') {
          const userMessage = event.message.text;
          const replyToken = event.replyToken;
          let responseMessage = '';

          if (userMessage.includes('습도')) {
            // Vercel 변수에 command와 userId를 함께 저장합니다.
            pendingRequest = { 
              command: '습도', 
              userId: event.source.userId 
            };
            responseMessage = '🌡️ 습도 측정을 요청했습니다!\n잠시만 기다려주세요 ⏳';
          } else {
            responseMessage = '안녕하세요! 스마트 화분 알리미입니다 🌱\n👉 "습도"를 입력해 현재 습도를 확인해보세요!';
          }

          // 사용자에게 요청 즉시 답장 보내기
          await axios.post('https://api.line.me/v2/bot/message/reply', {
            replyToken: replyToken,
            messages: [{ type: 'text', text: responseMessage }],
          }, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${lineToken}` } });
        }
      }
      return res.status(200).send('Webhook processed.');
    } catch (error) {
      console.error('Error processing LINE webhook:', error.message);
      return res.status(500).send('Error.');
    }
  }
  
  // 2. ESP32 API 요청 처리
  else {
    // ESP32가 데이터를 보냈을 때 (POST)
    if (req.method === 'POST') {
      try {
        const { action, message, userId } = req.body;
        
        if (action === 'reply' && message && userId) {
          await axios.post('https://api.line.me/v2/bot/message/push', {
            to: userId, // 전달받은 userId를 사용합니다.
            messages: [{ type: 'text', text: message }],
          }, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${lineToken}` } });
          return res.status(200).send('Reply sent to LINE user.');

        } else if (action === 'notify' && message) {
          // ✅ 수정: 중복된 변수 선언을 정리했습니다.
          const adminUserID = 'U326ad71508358143c1673f43f39d0ebb';
           await axios.post('https://api.line.me/v2/bot/message/push', {
            to: adminUserID,
            messages: [{ type: 'text', text: message }],
          }, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${lineToken}` } });
          return res.status(200).send('Notification sent to admin.');

        } else {
          return res.status(400).send('Bad Request: Missing parameters.');
        }
      } catch (error) {
        console.error('Failed to send LINE push message:', error.response ? error.response.data : error.message);
        return res.status(500).send('Failed to send push message.');
      }
    }
    // ESP32가 명령을 가져갈 때 (GET)
    else if (req.method === 'GET') {
      const action = req.query.action;
      // ✅ 수정: GET 요청 로직을 명확하게 정리했습니다.
      if (action === 'get_command') {
        res.status(200).json(pendingRequest);
        pendingRequest = { command: '대기', userId: null };
      } else if (action === 'send_message') {
        const adminUserID = 'U326ad71508358143c1673f43f39d0ebb';
        try {
          await axios.post('https://api.line.me/v2/bot/message/push', {
            to: adminUserID,
            messages: [{ type: 'text', text: 'ESP32가 연결되었습니다.' }],
          }, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${lineToken}` } });
          res.status(200).send('Periodic message sent successfully!');
        } catch (error) {
          res.status(500).send('Failed to send periodic LINE message.');
        }
      } else {
        res.status(400).send('Bad Request: Invalid action.');
      }
    } else {
      res.status(405).send('Method Not Allowed');
    }
  }
};
