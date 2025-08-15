// axios 라이브러리 사용
const axios = require('axios');

// 환경 변수에서 LINE 토큰 가져오기
const lineToken = process.env.LINE_ACCESS_TOKEN;

// --- 전역 변수 ---
// ESP32에 전달할 명령어를 임시로 저장
let pendingCommand = '대기';
// ESP32의 응답을 다시 보내줄 사용자의 ID를 임시로 저장
let replyUserId = null;

module.exports = async (req, res) => {
  // --- 1. LINE 플랫폼에서 온 Webhook 요청 처리 ---
  if (req.headers['x-line-signature']) {
    try {
      const events = req.body.events;
      for (const event of events) {
        if (event.type === 'message' && event.message.type === 'text') {
          const userMessage = event.message.text;
          const replyToken = event.replyToken;
          let responseMessage = '';

          // 사용자가 보낸 메시지에 따라 동작 결정
          if (userMessage.includes('습도')) {
            pendingCommand = '습도'; // ESP32에 '습도' 명령 설정
            replyUserId = event.source.userId; // 응답을 보낼 사용자 ID 저장
            responseMessage = 'ESP32에 습도 측정을 요청했습니다. 잠시만 기다려주세요.';
          } else if (userMessage.includes('상태')) {
            responseMessage = `현재 ESP32에게 "${pendingCommand}" 명령이 대기 중입니다.`;
          } else if (userMessage.includes('켜기')) {
            pendingCommand = '켜기';
            responseMessage = 'ESP32를 켰습니다. 잠시 후 ESP32에서 명령을 받을 것입니다.';
          } else if (userMessage.includes('끄기')) {
            pendingCommand = '끄기';
            responseMessage = 'ESP32를 껐습니다. 잠시 후 ESP32에서 명령을 받을 것입니다.';
          } else {
            responseMessage = '안녕하세요! "습도", "상태", "켜기", "끄기" 중 하나를 입력해보세요.';
          }

          // LINE으로 사용자에게 즉시 답장 보내기
          await axios.post('https://api.line.me/v2/bot/message/reply', {
            replyToken: replyToken,
            messages: [{ type: 'text', text: responseMessage }],
          }, {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${lineToken}`,
            },
          });
        }
      }
      res.status(200).send('Webhook processed successfully.');
    } catch (error) {
      console.error('Error processing LINE webhook:', error);
      res.status(500).send('Error processing webhook.');
    }
  } 
  // --- 2. ESP32에서 온 API 요청 처리 ---
  else {
    // ESP32가 응답(습도 값)을 보냈을 때 (POST 요청)
    if (req.method === 'POST') {
      try {
        const { action, message } = req.body;
        // action이 'reply'이고, 메시지와 저장된 사용자 ID가 있을 경우
        if (action === 'reply' && message && replyUserId) {
          await axios.post('https://api.line.me/v2/bot/message/push', {
            to: replyUserId,
            messages: [{ type: 'text', text: message }],
          }, {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${lineToken}`,
            },
          });
          replyUserId = null; // 응답을 보낸 후 사용자 ID 초기화
          res.status(200).send('Reply sent to LINE user.');
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
        res.status(200).json({ command: pendingCommand });
        pendingCommand = '대기'; // 명령을 전달한 후 초기화
      } else if (action === 'send_message') {
        // 정기 알림 기능 (기존 코드 유지)
        const lineUserID = 'U326ad71508358143c1673f43f39d0ebb'; // 특정 사용자에게 보내는 경우
        try {
          await axios.post('https://api.line.me/v2/bot/message/push', {
            to: lineUserID,
            messages: [{ type: 'text', text: 'ESP32가 정상적으로 동작 중입니다.' }],
          }, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${lineToken}` } });
          res.status(200).send('Periodic message sent successfully!');
        } catch (error) {
          console.error('Failed to send periodic LINE message:', error.response ? error.response.data : error.message);
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
