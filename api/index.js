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
      for (const event of events) {
        if (event.type === 'message' && event.message.type === 'text') {
          const userMessage = event.message.text;
          const replyToken = event.replyToken;
          let responseMessage = '';

          if (userMessage.includes('습도')) {
            // Vercel 변수에 command와 userId를 함께 저장합니다.
            pendingRequest = { 
              command: '습도', 
              userId: event.source.userId 
            };
            responseMessage = '습도 측정을 요청했습니다! 잠시만 기다려주세요.';
          } else {
            responseMessage = '안녕하세요! 스마트 화분 알리미입니다! \n "습도"를 입력해보세요.';
          }

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
  // 2. ESP32 API 요청 처리
  else {
    // ESP32가 응답 또는 알림을 보냈을 때 (POST 요청)
    if (req.method === 'POST') {
      try {
        // ESP32가 보낸 데이터에서 userId를 직접 받습니다.
        const { action, message, userId } = req.body;
        
        // action: 'reply' -> "습도" 요청에 대한 응답
        if (action === 'reply' && message && userId) {
          await axios.post('https://api.line.me/v2/bot/message/push', {
            to: userId, // 전달받은 userId를 사용합니다.
            messages: [{ type: 'text', text: message }],
          }, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${lineToken}` } });
          res.status(200).send('Reply sent to LINE user.');
        } 
        // action: 'notify' -> 물 주기 등 ESP32의 자발적인 알림
        else if (action === 'notify' && message) {
          const adminUserID = 'U326ad71508358143c1673f43f39d0ebb'; // 알림을 받을 관리자 ID
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
    // ESP32가 명령을 가져가거나, 정기 알림을 보낼 때 (GET 요청)
    else if (req.method === 'GET') {
      const action = req.query.action;
      if (action === 'get_command') {
        // 저장해둔 요청 객체 전체를 ESP32에게 전달합니다.
        res.status(200).json(pendingRequest);
        // ESP32에게 명령을 전달했으므로 초기 상태로 복귀합니다.
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
