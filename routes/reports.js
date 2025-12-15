const express = require("express");
const router = express.Router();
const rbpool = require("../db");

/* ---------------------------------
   📌 주간 리포트 (/weekly)
   - routine_reports 테이블 기반
----------------------------------*/
router.get("/weekly", async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) {
    return res.status(400).json({ message: "user_id required" });
  }

  let conn;
  try {
    conn = await rbpool.getConnection();

    // ✅ 이번 주 월요일 계산
    const [[{ monday }]] = await conn.query(`
      SELECT CURDATE() - INTERVAL (DAYOFWEEK(CURDATE()) - 2) DAY AS monday
    `);

    // ✅ routine_reports 조회
    const [rows] = await conn.query(
      `
      SELECT
        monday_success_rate,
        tuesday_success_rate,
        wednesday_success_rate,
        thursday_success_rate,
        friday_success_rate,
        saturday_success_rate,
        sunday_success_rate,
        weekly_average_success_rate,
        best_day,
        next_week_goal
      FROM routine_reports
      WHERE user_id = ?
        AND week_start_date = ?
      `,
      [user_id, monday]
    );

    // 📌 리포트 없을 경우
    if (rows.length === 0) {
      return res.json(null);
    }

    const r = rows[0];

    // ✅ 프론트가 기대하는 형태로 그대로 반환
    res.json({
      successByDay: {
        월: r.monday_success_rate ?? 0,
        화: r.tuesday_success_rate ?? 0,
        수: r.wednesday_success_rate ?? 0,
        목: r.thursday_success_rate ?? 0,
        금: r.friday_success_rate ?? 0,
        토: r.saturday_success_rate ?? 0,
        일: r.sunday_success_rate ?? 0,
      },
      weeklyAverage: Number(r.weekly_average_success_rate),
      bestDay: r.best_day,
      nextWeekGoal: r.next_week_goal,
    });

  } catch (err) {
    console.error("❌ weekly report error:", err);
    res.status(500).json({ message: "server error" });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;
