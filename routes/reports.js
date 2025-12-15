// routes/reports.js

const express = require("express");
const router = express.Router();
const rbpool = require("../db");

const ACTION_MAP = {
  C001: "음식을 먹는다",
  C002: "음료를 마신다",
  C007: "이를 닦는다",
  C009: "손을 씻는다",
  C028: "머리를 손질하다",
  C033: "모자를 쓴다",
  C035: "신발을 신는다",
  C038: "쓰레기를 버린다",
  C046: "공부하다",
  C050: "카드게임을 하다",
  C061: "그릇을 정리하다",
  C063: "책(서류)를 본다",
  C069: "전화통화를 하다",
  C073: "컴퓨터를 한다",
  C074: "휴대폰을 조작한다",
  C079: "청소를 한다",
  C084: "기타를 친다",
  C090: "반려동물과 논다",
  C093: "식물에 물을 준다",
  C098: "스쿼트를 하다",
  C101: "공놀이를 한다",
  C112: "춤을 춘다",
};

function clean(str) {
  return str.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "").trim();
}

/* ---------------------------------
   📌 주간 리포트 (/weekly)
----------------------------------*/
router.get("/weekly", async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) {
    return res.status(400).json({ message: "user_id required" });
  }

  let conn;
  try {
    conn = await rbpool.getConnection();

    // ✅ 이번 주 월요일 계산 (ISO week 기준)
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
        best_day
      FROM routine_reports
      WHERE user_id = ?
        AND week_start_date = ?
      LIMIT 1
      `,
      [user_id, monday]
    );

    if (rows.length === 0) {
      return res.json(null);
    }

    const r = rows[0];

    // ✅ 프론트에서 바로 쓰는 구조로 반환
    const successByDay = {
      월: r.monday_success_rate ?? 0,
      화: r.tuesday_success_rate ?? 0,
      수: r.wednesday_success_rate ?? 0,
      목: r.thursday_success_rate ?? 0,
      금: r.friday_success_rate ?? 0,
      토: r.saturday_success_rate ?? 0,
      일: r.sunday_success_rate ?? 0,
    };

    res.json({
      successByDay,
      weeklyAverage: Number(r.weekly_average_success_rate),
      bestDay: r.best_day,
      recommendedMissions: [], // 🔒 일단 비워둠 (안정 우선)
    });

  } catch (err) {
    console.error("❌ weekly report error:", err);
    res.status(500).json({ message: "server error" });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;