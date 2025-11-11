// routes/auth.js
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rbpool = require('../db'); 

const router = express.Router();

// 우리 서비스용 JWT (이메일 로그인용만 유지)
const signToken = (user) =>
  jwt.sign(
    { id: user.user_id, nickname: user.users_nickname },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

/** =============================
 *  📍 이메일 회원가입
 * ============================= */
router.post('/signup', async (req, res) => {
  const { email, password, nickname } = req.body;
  if (!email || !password || !nickname)
    return res.status(400).json({ message: '필수 항목 누락' });

  const conn = await rbpool.getConnection();
  try {
    const [dup] = await conn.query(
      'SELECT user_id FROM users WHERE email = ?',
      [email]
    );
    if (dup.length)
      return res.status(409).json({ message: '이미 사용 중인 이메일' });

    const hash = await bcrypt.hash(password, 10);

    const [r] = await conn.query(
      `INSERT INTO users (email, password_hash, users_nickname, provider, registered_at, last_login)
       VALUES (?, ?, ?, 'local', NOW(), NOW())`,
      [email, hash, nickname]
    );

    const user = { user_id: r.insertId, users_nickname: nickname };
    res.status(201).json({ user, token: signToken(user) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: '회원가입 실패' });
  } finally {
    conn.release();
  }
});

/** =============================
 *  📍 이메일 로그인
 * ============================= */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: '필수 항목 누락' });

  const conn = await rbpool.getConnection();
  try {
    const [rows] = await conn.query(
      'SELECT user_id, password_hash, users_nickname FROM users WHERE email = ?',
      [email]
    );

    if (!rows.length)
      return res.status(401).json({ message: '존재하지 않는 계정' });

    const userRow = rows[0];
    const ok = await bcrypt.compare(password, userRow.password_hash || '');
    if (!ok) return res.status(401).json({ message: '비밀번호 불일치' });

    const user = { user_id: userRow.user_id, users_nickname: userRow.users_nickname };
    res.json({ user, token: signToken(user) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: '로그인 실패' });
  } finally {
    conn.release();
  }
});

/** =============================
 *  ✅ 게스트 로그인 (가상 닉네임 입력 → 체험 모드)
 * ============================= */
router.post('/guest-login', async (req, res) => {
  const { nickname } = req.body; // 사용자가 입력한 닉네임
  if (!nickname) return res.status(400).json({ message: '닉네임이 필요합니다.' });

  const conn = await rbpool.getConnection();
  try {
    // DB에 임시 게스트 계정 추가
    const [result] = await conn.query(
      'INSERT INTO users (users_nickname, is_guest, provider, registered_at, last_login) VALUES (?, 1, "guest", NOW(), NOW())',
      [nickname]
    );

    const user_id = result.insertId;

    res.status(200).json({
      message: `${nickname}님, 환영합니다!`,
      user_id,
      users_nickname: nickname,
      is_guest: true,
    });
  } catch (err) {
    console.error('게스트 로그인 오류:', err);
    res.status(500).json({ message: '서버 오류' });
  } finally {
    conn.release();
  }
});

/** =============================
 *  📍 사용자 정보 조회
 * ============================= */
router.get('/user', async (req, res) => {
  const { user_id } = req.query;
  if (!user_id)
    return res.status(400).json({ message: '필수 정보 누락' });

  try {
    const conn = await rbpool.getConnection();
    const sql = `
      SELECT user_id, registered_at, last_login,
             users_nickname, profile_image_url,
             agree_terms, agree_privacy, agree_marketing
      FROM users WHERE user_id = ?`;
    const [rows] = await conn.query(sql, [user_id]);
    conn.release();

    if (!rows.length)
      return res.status(404).json({ message: '사용자 없음' });

    res.json({ user: rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: '서버 에러' });
  }
});

module.exports = router;
