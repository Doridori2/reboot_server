// routes/emotion.js
const express = require("express");
const router = express.Router();
const rbpool = require("../db");

/** 📌 감정 일기 저장 */
router.post("/", async (req, res) => {
  const { user_id, emotion, content } = req.body;

  if (!user_id || !emotion || !content) {
    return res.status(400).json({ message: "필수 항목 누락" });
  }

  const conn = await rbpool.getConnection();
  try {
    await conn.query(
      "INSERT INTO emotion_diary (user_id, emotion, content, created_at) VALUES (?, ?, ?, NOW())",
      [user_id, emotion, content]
    );
    res.status(201).json({ message: "감정 일기 저장 성공" });
  } catch (e) {
    console.error("감정 일기 저장 오류:", e);
    res.status(500).json({ message: "DB 오류" });
  } finally {
    conn.release();
  }
});

/** 📌 감정 일기 목록 불러오기 (최근순) */
router.get("/:user_id", async (req, res) => {
  const { user_id } = req.params;
  const conn = await rbpool.getConnection();

  try {
    const [rows] = await conn.query(
      "SELECT * FROM emotion_diary WHERE user_id = ? ORDER BY created_at DESC",
      [user_id]
    );
    res.json({ items: rows });
  } catch (e) {
    console.error("감정 일기 조회 오류:", e);
    res.status(500).json({ message: "DB 오류" });
  } finally {
    conn.release();
  }
});

module.exports = router;
