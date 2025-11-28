// routes/reports.js
const express = require('express');
const router = express.Router();  // ✅ 이 한 줄이 없어서 생긴 에러

// ✅ 예시 라우트
router.get('/weekly', async (req, res) => {
  try {
    res.json({ message: '주간 리포트 API 정상 작동!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류' });
  }
});

module.exports = router;

