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
  if (!user_id) return res.status(400).json({ message: "user_id required" });

  let conn;
  try {
    conn = await rbpool.getConnection();

    const successByDay = { 월: 0, 화: 0, 수: 0, 목: 0, 금: 0, 토: 0, 일: 0 };
    const daysKor = ["일", "월", "화", "수", "목", "금", "토"];

    // ✅ 이번 주 월요일
    const [[{ monday }]] = await conn.query(`
      SELECT CURDATE() - INTERVAL (DAYOFWEEK(CURDATE()) - 2) DAY AS monday
    `);

    // ✅ 사용자 전체 미션 목록 (라벨 기준)
    const [missionRows] = await conn.query(
      `SELECT mission_description FROM missions WHERE user_id = ?`,
      [user_id]
    );
    const allMissions = missionRows.map(m => clean(m.mission_description));

    let totalRate = 0;

    // ✅ 월 ~ 일 순회
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().slice(0, 10); // YYYY-MM-DD

      const dayName = daysKor[date.getDay()];

      // 그 날짜의 행동 로그
      const [logRows] = await conn.query(
        `SELECT action_type FROM user_action_log
         WHERE user_id = ?
         AND DATE(detected_at) = ?`,
        [user_id, dateStr]
      );

      const successSet = new Set();

      for (const log of logRows) {
        const actionLabel = ACTION_MAP[log.action_type];
        if (allMissions.includes(actionLabel)) {
          successSet.add(actionLabel);
        }
      }

      const missionCount = allMissions.length;
      const successCount = successSet.size;
      const rate =
        missionCount > 0
          ? Math.round((successCount / missionCount) * 100)
          : 0;

      successByDay[dayName] = rate;
      totalRate += rate;
    }

    const weeklyAverage = (totalRate / 7).toFixed(1);
    const bestDay = Object.entries(successByDay).sort((a, b) => b[1] - a[1])[0][0];

    conn.release();

    res.json({
      successByDay,
      weeklyAverage,
      bestDay,
      recommendedMissions: [],
    });
  } catch (err) {
    if (conn) conn.release();
    console.error(err);
    res.status(500).json({ message: "server error" });
  }
});

module.exports = router;
