// axois 라이브러리를 사용하기 때문에 설치 필요: npm install axios
const axios = require('axios');

module.exports = async (req, res) => {
  // 환경 변수에서 LINE 토큰을 가져옵니다.
  const lineToken = 'QLEVOPZpqpO8SptudJJ03W/Rz/YP5o3GZnABZ+A2hXgz1SVo5RRII0/aEW9SL55l/qbA15p2MivU1YdGtZ/aEyURqbN+vXiNSDje2b0eqIpGapcSjbjNiiE5s/qXgdRy/1jqXf6yFrMIGLWlKspRrQdB04t89/1O/w1cDnyilFU=';

  // ESP32에서 보낼 메시지 내용을 정의합니다.
  const message = 'ESP32에서 알림이 왔습니다!';

  // 푸시 메시지를 받을 LINE 사용자 ID 또는 그룹 ID를 여기에 입력하세요.
  // 이 정보는 LINE Developers 콘솔에서 찾을 수 있습니다.
  const lineUserID = 'U326ad71508358143c1673f43f39d0ebb';

  try {
    await axios.post(
      'https://api.line.me/v2w',
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
