// routes/reports.js
const express = require("express");
const router = express.Router();
const rbpool = require("../db");

/* ---------------------------------
   📌 주간 리포트 (최근 7일, missions 기준)
----------------------------------*/
router.get("/weekly", async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ message: "user_id required" });

  let conn;
  try {
    conn = await rbpool.getConnection();

    // 1) 최근 7일 날짜 목록 (DB 기준) + 요일(0=월..6=일)까지 받아오기
    const [days] = await conn.query(`
      SELECT
        d.dt AS date,
        WEEKDAY(d.dt) AS wd
      FROM (
        SELECT CURDATE() AS dt
        UNION ALL SELECT CURDATE() - INTERVAL 1 DAY
        UNION ALL SELECT CURDATE() - INTERVAL 2 DAY
        UNION ALL SELECT CURDATE() - INTERVAL 3 DAY
        UNION ALL SELECT CURDATE() - INTERVAL 4 DAY
        UNION ALL SELECT CURDATE() - INTERVAL 5 DAY
        UNION ALL SELECT CURDATE() - INTERVAL 6 DAY
      ) d
    `);

    // 2) 최근 7일 missions 집계 (created_at은 DATE 타입이라 이 방식이 가장 안전)
    const [agg] = await conn.query(
      `
      SELECT
        created_at AS date,
        COUNT(*) AS total,
        SUM(status = 'completed') AS completed
      FROM missions
      WHERE user_id = ?
        AND created_at >= CURDATE() - INTERVAL 6 DAY
      GROUP BY created_at
      `,
      [user_id]
    );

    // date -> {total, completed} 맵 만들기
    const aggMap = new Map(
      agg.map((r) => [
        String(r.date), // 'YYYY-MM-DD' 형태로 들어오는 경우가 많음
        { total: Number(r.total), completed: Number(r.completed) },
      ])
    );

    const dayKorByWd = ["월", "화", "수", "목", "금", "토", "일"];
    const successByDay = { 월: 0, 화: 0, 수: 0, 목: 0, 금: 0, 토: 0, 일: 0 };

    let totalRate = 0;

    for (const row of days) {
      const dateStr = String(row.date);        // DB가 준 날짜 그대로
      const dayName = dayKorByWd[row.wd];      // WEEKDAY: 0=월 ... 6=일

      const info = aggMap.get(dateStr) || { total: 0, completed: 0 };
      const rate = info.total > 0 ? Math.round((info.completed / info.total) * 100) : 0;

      successByDay[dayName] = rate;
      totalRate += rate;

      console.log(`[weekly] ${dateStr} ${dayName} total=${info.total} completed=${info.completed} rate=${rate}`);
    }

    const weeklyAverage = (totalRate / 7).toFixed(1);
    const bestDay = Object.entries(successByDay).sort((a, b) => b[1] - a[1])[0][0];

        /* ⭐ 추천 미션 (최근 7일 AI 로그 기반) */
    const recommendedMissions = [];

    const [allLogs] = await conn.query(
      `
      SELECT action_type, detected_at
      FROM user_action_log
      WHERE user_id = ?
        AND detected_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      `,
      [user_id]
    );

    const phoneCount = allLogs.filter(l => l.action_type === "C074").length;
    const cleaningCount = allLogs.filter(l => l.action_type === "C079").length;
    const drinkCount = allLogs.filter(l => l.action_type === "C002").length;

    if (phoneCount > 10) {
      recommendedMissions.push({
        icon: "🧘",
        title: "목·어깨 스트레칭하기",
        reason: "최근 휴대폰 사용이 많았어요.",
      });
    }

    if (cleaningCount === 0) {
      recommendedMissions.push({
        icon: "🧹",
        title: "책상 정리하기",
        reason: "정리·정돈 행동이 거의 없었어요.",
      });
    }

    if (drinkCount === 0) {
      recommendedMissions.push({
        icon: "🥤",
        title: "물 한 잔 마시기",
        reason: "수분 섭취 기록이 거의 없었어요.",
      });
    }


    conn.release();

    return res.json({
      successByDay,
      weeklyAverage,
      bestDay,
      recommendedMissions: recommendedMissions.slice(0, 3),
    });
  } catch (err) {
    if (conn) conn.release();
    console.error("❌ /reports/weekly error:", err);
    return res.status(500).json({ message: "server error" });
  }
});

module.exports = router;
