const axios = require('axios');
const lineToken = process.env.LINE_ACCESS_TOKEN;

// ✅ 변경: '명령'과 '사용자ID'를 하나의 객체로 묶어서 관리
let pendingRequest = { 
  command: '대기', 
  userId: null 
};

module.exports = async (req, res) => {
  // 1. LINE 플랫폼으로부터 온 Webhook 요청 처리
  if (req.headers['x-line-signature']) {
    try {
      const events = req.body.events;
      for (const event of events) {
        if (event.type === 'message' && event.message.type === 'text') {
          const userMessage = event.message.text;
          const replyToken = event.replyToken;
          let responseMessage = '';

          if (userMessage.includes('습도')) {
            // ✅ 변경: Vercel 변수에 command와 userId를 함께 저장
            pendingRequest = { 
              command: '습도', 
              userId: event.source.userId 
            };
            responseMessage = '🌡️ 습도 측정을 요청했습니다!\n잠시만 기다려주세요 ⏳';
          } else {
            responseMessage = '안녕하세요! 스마트 화분 알리미입니다 🌱\n👉 "습도"를 입력해 현재 습도를 확인해보세요!';
          }

          // 사용자에게 우선 응답 메시지 전송
          await axios.post('https://api.line.me/v2/bot/message/reply', {
            replyToken: replyToken,
            messages: [{ type: 'text', text: responseMessage }],
          }, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${lineToken}` } });
        }
      }
      res.status(200).send('Webhook processed successfully.');
    } catch (error) {
      console.error('Error processing LINE webhook:', error);
      res.status(500).send('Error processing webhook.');
    }
  }
  // 2. ESP32로부터 온 API 요청 처리
  else {
    // ESP32가 데이터를 보내는 경우 (POST)
    if (req.method === 'POST') {
      try {
        // ✅ 변경: ESP32가 보낸 데이터에서 userId를 직접 받음
        const { action, message, userId } = req.body;
        
        // ESP가 보낸 응답을 라인 사용자에게 전송
        if (action === 'reply' && message && userId) {
          await axios.post('https://api.line.me/v2/bot/message/push', {
            to: userId, // ✅ 변경: 전달받은 userId를 사용
            messages: [{ type: 'text', text: message }],
          }, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${lineToken}` } });
          res.status(200).send('Reply sent to LINE user.');
        } 
        // ESP가 보내는 알림을 관리자에게 전송
        else if (action === 'notify' && message) {
          const adminUserID = 'U326ad71508358143c1673f43f39d0ebb'; // 관리자 ID는 하드코딩 유지
          await axios.post('https://api.line.me/v2/bot/message/push', {
            to: adminUserID,
            messages: [{ type: 'text', text: message }],
          }, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${lineToken}` } });
          res.status(200).send('Notification sent to LINE user.');
        } else {
          res.status(400).send('Bad Request: Missing parameters.');
        }
      } catch (error) {
        console.error('Failed to send LINE push message:', error.response ? error.response.data : error.message);
        res.status(500).send('Failed to send LINE push message.');
      }
    }
    // ESP32가 명령을 가져가는 경우 (GET)
    else if (req.method === 'GET') {
      const action = req.query.action;
      if (action === 'get_command') {
        // ✅ 변경: 저장해둔 요청 객체 전체를 ESP32에게 전달
        res.status(200).json(pendingRequest);
        // ESP32에게 명령을 전달했으므로 초기 상태로 복귀
        pendingRequest = { command: '대기', userId: null };
      } else {
        res.status(400).send('Bad Request: Invalid action.');
      }
    } else {
      res.status(405).send('Method Not Allowed');
    }
  }
};
