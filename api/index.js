// axios 라이브러리를 사용하기 때문에 설치 필요: npm install axios
const axios = require('axios');

// 환경 변수에서 LINE 토큰을 가져옵니다.
// 원본 코드에 하드코딩된 토큰은 보안상 위험합니다.
// Vercel 프로젝트의 환경 변수에 토큰을 추가하여 사용하세요.
const lineToken = process.env.LINE_ACCESS_TOKEN; 

// ESP32 상태를 저장할 변수 (실제로는 데이터베이스 사용 권장)
let esp32Status = '알 수 없음'; 

module.exports = async (req, res) => {
  // 요청이 LINE 웹훅 이벤트인지 확인
  if (req.headers['x-line-signature']) {
    const events = req.body.events;

    for (const event of events) {
      if (event.type === 'message' && event.message.type === 'text') {
        const userMessage = event.message.text;
        const replyToken = event.replyToken;

        let responseMessage = '';

        // 사용자가 보낸 메시지에 따라 응답 결정
        if (userMessage.includes('상태')) {
          responseMessage = `현재 ESP32 상태: ${esp32Status}`;
        } else if (userMessage.includes('켜기')) {
          // ESP32에 '켜기' 명령을 보내는 로직을 추가해야 함
          responseMessage = 'ESP32를 켰습니다.';
        } else {
          responseMessage = '죄송해요, "상태"나 "켜기"라고 입력해보세요.';
        }

        // LINE으로 답장 보내기 (replyToken 사용)
        await axios.post(
          'https://api.line.me/v2/bot/message/reply',
          {
            replyToken: replyToken,
            messages: [{
              type: 'text',
              text: responseMessage,
            }],
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${lineToken}`,
            },
          }
        );
      }
    }
    res.status(200).end();

  } else { // X-Line-Signature가 없으면 ESP32의 요청으로 간주
    // 원래의 단방향 코드 로직
    const lineUserID = 'U326ad71508358143c1673f43f39d0ebb';
    const message = '정동건 테스트';

    try {
      await axios.post(
        'https://api.line.me/v2/bot/message/push',
        {
          to: lineUserID,
          messages: [{ type: 'text', text: message }],
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${lineToken}`,
          },
        }
      );
      res.status(200).send('Message sent successfully!');
    } catch (error) {
      console.error('Failed to send LINE message:', error.response ? error.response.data : error.message);
      res.status(500).send('Failed to send LINE message.');
    }
  }
};
