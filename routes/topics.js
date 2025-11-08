// routes/topics.js
const express = require('express');
const pool = require('../db');
const router = express.Router();

// KST(Asia/Seoul) 날짜 YYYY-MM-DD
function getKstDateString(d = new Date()) {
  const KST_OFFSET = 9 * 60 * 60 * 1000;
  const kst = new Date(d.getTime() + KST_OFFSET);
  return kst.toISOString().slice(0, 10);
}

// 오늘의 질문 조회
router.get('/today', async (req, res) => {
  try {
    const ymd = getKstDateString();
    const [rows] = await pool.execute(
      `SELECT id, title, body, valid_date
       FROM topics
       WHERE valid_date = ?
       LIMIT 1`,
      [ymd]
    );

    if (rows.length) return res.json(rows[0]);

    // DB에 없는 경우: 가벼운 기본 프롬프트 랜덤 제공(저장은 안 함)
    const FALLBACK = [
  { title: "오늘 나를 미소짓게 한 순간은?", body: null },
  { title: "오늘 몸이 가장 편안했던 순간은?", body: null },
  { title: "나를 차분하게 만드는 장소는?", body: null },
  { title: "요즘 붙잡고 있는 작은 목표는?", body: null },
  { title: "지금 내 마음을 한 단어로 표현하면?", body: null },
  { title: "오늘 감사했던 일 하나", body: null },
  { title: "이번 주 나에게 보내는 응원 한마디", body: null },
  { title: "어제의 나에게 고마운 점", body: null },
  { title: "나를 돕는 사소한 루틴 한 가지", body: null },
  { title: "최근에 해낸 작은 성취는?", body: null },
  { title: "오늘 쉬고 싶은 이유를 솔직하게 적어본다면?", body: null },
  { title: "좋아하는 향/소리/색 하나", body: null },
  { title: "지금 창밖 풍경을 한 줄로 묘사해본다면?", body: null },
  { title: "미래의 나에게 전하고 싶은 문장", body: null },
  { title: "오늘 나를 지켜준 경계(선) 하나", body: null },
  { title: "내일의 1% 변화를 만든다면 무엇?", body: null },
  { title: "안전하다고 느껴지는 사람/대상은?", body: null },
  { title: "최근에 새로 배운 것 하나", body: null },
  { title: "지금 내려놓고 싶은 걱정 하나", body: null },
  { title: "오늘의 기분을 이모지로 표현하면? (예: 😊🌿☁️)", body: null },
];
    const pick = FALLBACK[Math.floor(Math.random() * FALLBACK.length)];
    return res.json({ ...pick, valid_date: ymd, is_fallback: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// (옵션) 오늘의 질문 수동 등록/수정 (간단 운영용) — 필요 없으면 빼도 됨
router.post('/', async (req, res) => {
  try {
    const ymd = req.body.valid_date || getKstDateString();
    const { title, body = null } = req.body;
    if (!title || title.length > 80) {
      return res.status(400).json({ message: 'title은 1~80자' });
    }

    // valid_date 유니크이므로 upsert
    const [r] = await pool.execute(
      `INSERT INTO topics (title, body, valid_date)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE title=VALUES(title), body=VALUES(body)`,
      [title, body, ymd]
    );
    res.json({ ok: true, valid_date: ymd });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;