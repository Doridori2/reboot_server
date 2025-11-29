// routes/aiLog.js

const express = require("express");
const router = express.Router();
const rbpool = require("../db");

// 🟦 AI 행동 로그 저장 API
router.post("/", async (req, res) => {
  try {
    const { user_id, action_type } = req.body;

    if (!user_id || !action_type) {
      return res.status(400).json({ message: "user_id, action_type required" });
    }

    const conn = await rbpool.getConnection();

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
