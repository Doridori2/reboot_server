// routes/reports.js

const express = require('express');
const router = express.Router();
const rbpool = require('../db');

// 행동 텍스트 매핑
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
  C079: "청소를 하다",
  C084: "기타를 친다",
  C090: "반려동물과 논다",
  C093: "식물에 물을 준다",
  C098: "스쿼트를 하다",
  C101: "공놀이를 한다",
  C112: "춤을 춘다",
};

function removeEmoji(str) {
  return str.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "").trim();
}

router.get('/weekly', async (req, res) => {
  const { user_id } = req.query;

  if (!user_id) return res.status(400).json({ message: "user_id 필요" });

  try {
    const conn = await rbpool.getConnection();

    // 1) 오늘 미션 목록
    const [missionRows] = await conn.query(
      `SELECT mission_description
       FROM missions
       WHERE user_id = ?
       AND DATE(created_at) = CURDATE()`,
      [user_id]
    );

    const todayMissions = missionRows.map(m => removeEmoji(m.mission_description));
    const missionCount = todayMissions.length;

    // 2) 지난 7일 행동 로그
    const [logRows] = await conn.query(
      `SELECT action_type, detected_at, DAYOFWEEK(detected_at) AS day_num
       FROM user_action_log
       WHERE user_id = ?
       AND detected_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)`,
      [user_id]
    );

    const dayMap = { 1: '일', 2: '월', 3: '화', 4: '수', 5: '목', 6: '금', 7: '토' };

    // 3) 요일별로 중복 없는 성공 미션 저장
    const successSets = {
      '월': new Set(),
      '화': new Set(),
      '수': new Set(),
      '목': new Set(),
      '금': new Set(),
      '토': new Set(),
      '일': new Set(),
    };

    for (const log of logRows) {
      const action = ACTION_MAP[log.action_type];
      const day = dayMap[log.day_num];

      if (todayMissions.includes(action)) {
        successSets[day].add(action);  // 중복 제거됨!
      }
    }

    // 4) 성공률 계산
    const successByDay = {};
    let total = 0;

    for (const day of Object.keys(successSets)) {
      const successCount = successSets[day].size;
      const rate = missionCount > 0 ? Math.round((successCount / missionCount) * 100) : 0;

      successByDay[day] = rate;
      total += rate;
    }

    const weeklyAverage = (total / 7).toFixed(1);

    // 5) 최고 요일
    const bestDay = Object.entries(successByDay)
      .sort((a, b) => b[1] - a[1])[0][0];

    conn.release();
    res.json({
      successByDay,
      weeklyAverage,
      bestDay
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "서버 에러" });
  }
});

module.exports = router;
