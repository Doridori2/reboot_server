// routes/users.js
const express = require('express');
const rbpool = require('../db'); // ✅ db pool 불러오기
const router = express.Router();

/** 닉네임 설정 API */
router.post('/set-nickname', async (req, res) => {
  const { user_id, users_nickname } = req.body;

  if (!user_id || !users_nickname) {
    return res.status(400).json({ message: '필수 정보 누락' });
  }

  try {
    const conn = await rbpool.getConnection();
    await conn.query('UPDATE users SET users_nickname = ? WHERE user_id = ?', [users_nickname, user_id]);
    conn.release();
    res.json({ message: '닉네임 설정 완료' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '서버 에러' });
  }
});

module.exports = router;