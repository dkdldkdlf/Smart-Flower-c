let lastCommand = null;

export default function handler(req, res) {
  if (req.method === "POST") {
    const body = req.body;

    // LINE → 서버: 명령 저장
    if (body && body.message) {
      const msg = body.message.trim();

      if (msg === "습도") {
        lastCommand = "습도";
      } else if (msg === "도움말") {
        lastCommand = "도움말";
      } else {
        lastCommand = null; // 알 수 없는 명령은 null 처리
      }
    }

    return res.status(200).json({ status: "ok" });
  }

  if (req.method === "GET") {
    const { action } = req.query;

    if (action === "get_command") {
      const cmd = lastCommand;
      lastCommand = null; // 한 번 사용 후 초기화
      return res.status(200).json({ command: cmd });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
