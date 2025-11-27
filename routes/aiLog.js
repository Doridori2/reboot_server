import express from "express";
import db from "../config/db.js";
import dayjs from "dayjs";

const router = express.Router();

// 1️⃣ AI 로그 수신 → ai_logs 저장
router.post("/", async (req, res) => {
  try {
    const { user_id, action_code, action_label } = req.body;

    if (!user_id || !action_code) {
      return res.status(400).json({ message: "user_id, action_code required" });
    }

    await db.query(
      "INSERT INTO ai_logs (user_id, action_code, action_label) VALUES (?, ?, ?)",
      [user_id, action_code, action_label || null]
    );

    res.json({ message: "AI log saved!" });
  } catch (err) {
    console.error("AI Log Error:", err);
    res.status(500).json({ message: "AI log save failed" });
  }
});

// 2️⃣ 주간 리포트 생성
router.post("/generate/:user_id", async (req, res) => {
  try {
    const user_id = req.params.user_id;

    const startOfWeek = dayjs().startOf("week").format("YYYY-MM-DD");
    const endOfWeek = dayjs().endOf("week").format("YYYY-MM-DD");

    const [logs] = await db.query(
      `SELECT action_code, DATE(detected_at) AS date 
       FROM ai_logs 
       WHERE user_id=? AND detected_at BETWEEN ? AND ?`,
      [user_id, startOfWeek, endOfWeek]
    );

    const days = [
      "monday","tuesday","wednesday",
      "thursday","friday","saturday","sunday"
    ];

    const rates = {};
    days.forEach((d) => (rates[`${d}_success_rate`] = 0));

    logs.forEach((log) => {
      const dayName = dayjs(log.date).format("dddd").toLowerCase();
      rates[`${dayName}_success_rate`] += 1;
    });

    const total = Object.values(rates).reduce((a, b) => a + b, 0);
    const avg = (total / 7).toFixed(2);
    const bestDay = Object.keys(rates).reduce((a, b) => (rates[a] > rates[b] ? a : b));

    await db.query(
      `INSERT INTO weekly_reports 
       (user_id, week_start_date, monday_success_rate, tuesday_success_rate, wednesday_success_rate, 
        thursday_success_rate, friday_success_rate, saturday_success_rate, sunday_success_rate, 
        weekly_average_success_rate, best_day)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user_id,
        startOfWeek,
        rates.monday_success_rate,
        rates.tuesday_success_rate,
        rates.wednesday_success_rate,
        rates.thursday_success_rate,
        rates.friday_success_rate,
        rates.saturday_success_rate,
        rates.sunday_success_rate,
        avg,
        bestDay
      ]
    );

    res.json({ message: "Weekly report created!" });
  } catch (err) {
    console.error("Report Error:", err);
    res.status(500).json({ message: "Report generation failed" });
  }
});

export default router;
