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
    const dayMap = { 1: "일", 2: "월", 3: "화", 4: "수", 5: "목", 6: "금", 7: "토" };

    let totalRate = 0;
    let validDays = 0;

    for (let i = 0; i < 7; i++) {
      console.log("📅 date:", date);
console.log("📌 missions:", missions);
console.log("🎥 actions:", logRows.map(l => clean(ACTION_MAP[l.action_type])));
  // 📅 기준 날짜
  const [dateRows] = await conn.query(
    `SELECT CURDATE() - INTERVAL ? DAY AS date`,
    [i]
  );
  const date = dateRows[0].date;

  // 📌 오늘의 미션
  const [missionRows] = await conn.query(
    `SELECT mission_description
     FROM missions
     WHERE user_id = ?
     AND created_at = ?`,
    [user_id, date]
  );

  const missions = missionRows.map(m => clean(m.mission_description));
  const missionCount = missions.length;

  // 📌 오늘의 행동 로그
  const [logRows] = await conn.query(
    `SELECT action_type
     FROM user_action_log
     WHERE user_id = ?
     AND detected_at >= ?
     AND detected_at < DATE_ADD(?, INTERVAL 1 DAY)`,
    [user_id, date, date]
  );

  const successSet = new Set();
  for (const log of logRows) {
    const action = clean(ACTION_MAP[log.action_type] || "");
    if (missions.includes(action)) {
      successSet.add(action);
    }
  }

  const successCount = successSet.size;
  const rate =
    missionCount > 0
      ? Math.round((successCount / missionCount) * 100)
      : 0;

  // 📌 요일 계산 (MySQL 기준)
  const [dayRows] = await conn.query(
    `SELECT DAYOFWEEK(?) AS day_num`,
    [date]
  );

  const dayName = dayMap[dayRows[0].day_num];
  successByDay[dayName] = rate;

  if (missionCount > 0) {
    totalRate += rate;
    validDays++;
  }
}

    const weeklyAverage =
      validDays > 0 ? (totalRate / validDays).toFixed(1) : 0;

    const bestDay = Object.entries(successByDay)
      .sort((a, b) => b[1] - a[1])[0][0];

    /* ⭐ 추천 미션 */
    const recommendedMissions = [];

    const [allLogs] = await conn.query(
      `SELECT action_type
       FROM user_action_log
       WHERE user_id = ?
       AND detected_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)`,
      [user_id]
    );

    const phoneCount = allLogs.filter(l => l.action_type === "C074").length;
    const cleaningCount = allLogs.filter(l => l.action_type === "C079").length;
    const drinkCount = allLogs.filter(l => l.action_type === "C002").length;

    if (phoneCount > 10) {
      recommendedMissions.push({
        icon: "🧘",
        title: "목·어깨 스트레칭하기",
        reason: "최근 휴대폰 사용이 많았어요!",
      });
    }

    if (cleaningCount === 0) {
      recommendedMissions.push({
        icon: "🧹",
        title: "책상 정리하기",
        reason: "정리·정돈 행동이 거의 없었어요!",
      });
    }

    if (drinkCount === 0) {
      recommendedMissions.push({
        icon: "🥤",
        title: "물 한 잔 마시기",
        reason: "수분 섭취가 부족했던 한 주였어요!",
      });
    }

    res.json({
      successByDay,
      weeklyAverage,
      bestDay,
      recommendedMissions: recommendedMissions.slice(0, 3),
    });

  } catch (err) {
    console.error("❌ weekly report error:", err);
    res.status(500).json({ message: "server error" });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;
