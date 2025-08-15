// axois 라이브러리를 사용하기 때문에 설치 필요: npm install axios
const axios = require('axios');

module.exports = async (req, res) => {
  // 환경 변수에서 LINE 토큰을 가져옵니다.
  const lineToken = process.env.LINE_ACCESS_TOKEN;

  // ESP32에서 보낼 메시지 내용을 정의합니다.
  const message = 'ESP32에서 알림이 왔습니다!';

  // 푸시 메시지를 받을 LINE 사용자 ID 또는 그룹 ID를 여기에 입력하세요.
  // 이 정보는 LINE Developers 콘솔에서 찾을 수 있습니다.
  const lineUserID = 'YOUR_LINE_USER_ID_OR_GROUP_ID';

  try {
    await axios.post(
      'https://api.line.me/v2/bot/message/push',
      {
        to: lineUserID,
        messages: [{
          type: 'text',
          text: message,
        }],
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${lineToken}`,
        },
      }
    );
    // 메시지 전송 성공 시 200 OK 응답을 보냅니다.
    res.status(200).send('Message sent successfully!');
  } catch (error) {
    // 메시지 전송 실패 시 에러 응답을 보냅니다.
    console.error('Failed to send LINE message:', error.response ? error.response.data : error.message);
    res.status(500).send('Failed to send LINE message.');
  }
};
