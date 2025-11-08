// routes/auth.js
const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rbpool = require('../db'); 

const router = express.Router();

// 우리 서비스용 JWT 만들기 (7일 유효)
const signToken = (user) =>
  jwt.sign(
    { id: user.user_id, nickname: user.users_nickname },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
/** =============================
 *  📍 이메일 회원가입
 *  POST /auth/signup
 *  body: { email, password, nickname }
 * ============================= */
router.post('/signup', async (req, res) => {
  const { email, password, nickname } = req.body;
  if (!email || !password || !nickname) {
    return res.status(400).json({ message: '필수 항목 누락' });
  }

  const conn = await rbpool.getConnection();
  try {
    // 중복 이메일 체크
    const [dup] = await conn.query(
      'SELECT user_id FROM users WHERE email = ?',
      [email]
    );
    if (dup.length) return res.status(409).json({ message: '이미 사용 중인 이메일' });

    // 비밀번호 해싱
    const hash = await bcrypt.hash(password, 10);

    // 새 사용자 삽입
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
 *  POST /auth/login
 *  body: { email, password }
 * ============================= */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: '필수 항목 누락' });

  const conn = await rbpool.getConnection();
  try {
    const [rows] = await conn.query(
      'SELECT user_id, password_hash, users_nickname FROM users WHERE email = ?',
      [email]
    );

    if (!rows.length) return res.status(401).json({ message: '존재하지 않는 계정' });

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


/** 카카오 로그인 (code 교환 → 우리 JWT 발급) */
router.post('/kakao', async (req, res) => {
  const { code, redirectUri } = req.body;
  if (!code || !redirectUri) {
    return res.status(400).json({ message: 'code/redirectUri required' });
  }

  try {
    // 1) 카카오 토큰 교환
    const tokenRes = await axios.post(
      'https://kauth.kakao.com/oauth/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.KAKAO_REST_API_KEY,
        redirect_uri: redirectUri,
        code
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    const accessToken = tokenRes.data.access_token;

    // 2) 카카오 프로필 조회
    const meRes = await axios.get('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const kakao_id = meRes.data.id;
    const users_nickname = meRes.data.kakao_account?.profile?.nickname || '카카오유저';
    const profile_image_url = meRes.data.kakao_account?.profile?.profile_image_url || null;

    // 3) 우리 DB upsert (네 컬럼명에 맞춤: user_id / users_nickname 등)
    const conn = await rbpool.getConnection();
    try {
      const [found] = await conn.query(
        'SELECT user_id, users_nickname FROM users WHERE kakao_id = ?',
        [kakao_id]
      );

      let userRow;
      if (found.length) {
        const user_id = found[0].user_id;
        // 마지막 로그인 시간 업데이트
        await conn.query('UPDATE users SET last_login = NOW() WHERE user_id = ?', [user_id]);
        // 닉네임/이미지 변경 시 업데이트(선택)
        await conn.query(
          'UPDATE users SET users_nickname = ?, profile_image_url = ? WHERE user_id = ?',
          [users_nickname, profile_image_url, user_id]
        );
        const [rows] = await conn.query(
          'SELECT user_id, kakao_id, users_nickname, profile_image_url FROM users WHERE user_id = ?',
          [user_id]
        );
        userRow = rows[0];
      } else {
        const [r] = await conn.query(
          `INSERT INTO users
           (kakao_id, registered_at, last_login, users_nickname, profile_image_url, provider)
           VALUES (?, NOW(), NOW(), ?, ?, 'kakao')`,
          [kakao_id, users_nickname, profile_image_url]
        );
        const user_id = r.insertId;
        const [rows] = await conn.query(
          'SELECT user_id, kakao_id, users_nickname, profile_image_url FROM users WHERE user_id = ?',
          [user_id]
        );
        userRow = rows[0];
      }

      // 4) 우리 JWT 발급해서 반환
      const token = signToken(userRow);
      res.json({ user: userRow, token });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e?.response?.data || e.message);
    res.status(500).json({ message: 'kakao login failed' });
  }
});

/** (유지) 사용자 정보 조회: GET /auth/user?user_id=... */
router.get('/user', async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ message: '필수 정보 누락' });

  try {
    const conn = await rbpool.getConnection();
    const sql = `SELECT user_id, kakao_id, registered_at, last_login,
                        users_nickname, profile_image_url,
                        agree_terms, agree_privacy, agree_marketing
                 FROM users WHERE user_id = ?`;
    const [rows] = await conn.query(sql, [user_id]);
    conn.release();

    if (rows.length === 0) return res.status(404).json({ message: '사용자 없음' });
    res.json({ user: rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: '서버 에러' });
  }
});

/** (구버전 차단) POST /auth/kakao-login */
router.post('/kakao-login', (req, res) => {
  return res.status(410).json({ message: 'use /auth/kakao with code/redirectUri' });
});

module.exports = router;