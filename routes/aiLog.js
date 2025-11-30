// routes/aiLog.js

const express = require("express");
const router = express.Router();
const rbpool = require("../db");

console.log("🟢 aiLog.js 라우터 로드됨!");

// 🟦 AI 행동 로그 저장 API
router.post("/", async (req, res) => {
  try {
    console.log("🔥 AI 서버가 보낸 데이터:", req.body);

    const { user_id, action_type } = req.body;

    if (!user_id || !action_type) {
      return res.status(400).json({ message: "user_id, action_type required" });
    }

    const conn = await rbpool.getConnection();

    // ⭐ 중복방지: 오늘 같은 행동이 이미 저장됐는지 확인
    const [existing] = await conn.query(
      `SELECT action_id 
       FROM user_action_log
       WHERE user_id = ?
       AND action_type = ?
       AND DATE(detected_at) = CURDATE()
       LIMIT 1`,
      [user_id, action_type]
    );

    if (existing.length > 0) {
      conn.release();
      return res.json({ message: "Already logged today (skipped)" });
    }

    // ✨ 첫 기록이면 저장
    await conn.query(
      `INSERT INTO user_action_log (user_id, action_type) VALUES (?, ?)`,
      [user_id, action_type]
    );

    conn.release();
    res.json({ message: "AI log saved!" });

  } catch (err) {
    console.error("AI Log Error:", err);
    res.status(500).json({ message: "AI log save failed" });
  }
});

module.exports = router;
