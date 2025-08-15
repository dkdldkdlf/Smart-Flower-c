// axios 라이브러리 사용
const axios = require('axios');

// 환경 변수에서 LINE 토큰 가져오기 (보안을 위해 하드코딩된 토큰 삭제)
const lineToken = process.env.LINE_ACCESS_TOKEN;

// ESP32에 전달할 명령어를 임시로 저장하는 변수
// 실제 서비스에서는 데이터베이스를 사용해야 합니다.
let pendingCommand = '대기';

module.exports = async (req, res) => {
  // 요청 헤더에 x-line-signature가 있으면 LINE 웹훅 이벤트로 간주
  if (req.headers['x-line-signature']) {
    const events = req.body.events;
    for (const event of events) {
      if (event.type === 'message' && event.message.type === 'text') {
        const userMessage = event.message.text;
        const replyToken = event.replyToken;
        let responseMessage = '';

        // 사용자가 보낸 메시지에 따라 pendingCommand와 응답 메시지를 설정
        if (userMessage.includes('상태')) {
          responseMessage = `현재 ESP32에게 "${pendingCommand}" 명령이 대기 중입니다.`;
        } else if (userMessage.includes('켜기')) {
          pendingCommand = '켜기'; // ESP32에 보낼 명령어를 저장
          responseMessage = 'ESP32를 켰습니다. 잠시 후 ESP32에서 명령을 받을 것입니다.';
        } else if (userMessage.includes('끄기')) {
          pendingCommand = '끄기'; // ESP32에 보낼 명령어를 저장
          responseMessage = 'ESP32를 껐습니다. 잠시 후 ESP32에서 명령을 받을 것입니다.';
        } else {
          responseMessage = '죄송해요, "상태", "켜기" 또는 "끄기"라고 입력해보세요.';
        }

        // LINE으로 답장 보내기
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
    res.status(200).end();

  } else { // X-Line-Signature가 없으면 ESP32의 요청으로 간주
    // ESP32의 요청에 따라 동작
    if (req.query.action === 'send_message') {
      // 1. ESP32에서 라인으로 메시지를 보내는 기능
      const message = 'ESP32에서 알림이 왔습니다!';
      const lineUserID = 'U326ad71508358143c1673f43f39d0ebb';
      try {
        await axios.post('https://api.line.me/v2/bot/message/push', {
          to: lineUserID,
          messages: [{ type: 'text', text: message }],
        }, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${lineToken}`,
          },
        });
        res.status(200).send('Message sent successfully!');
      } catch (error) {
        console.error('Failed to send LINE message:', error.response ? error.response.data : error.message);
        res.status(500).send('Failed to send LINE message.');
      }
    } else if (req.query.action === 'get_command') {
      // 2. ESP32에 명령어를 전달하는 기능
      res.status(200).json({ command: pendingCommand });
      pendingCommand = '대기'; // 명령을 전달한 후 초기화
    } else {
      res.status(400).send('Bad Request');
    }
  }
};
