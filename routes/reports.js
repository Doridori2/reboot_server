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

// 이모지 제거
function removeEmoji(str) {
  return str.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "").trim();
}

router.get('/weekly', async (req, res) => {
  const { user_id } = req.query;

  if (!user_id) return res.status(400).json({ message: "user_id 필요" });

  try {
    const conn = await rbpool.getConnection();

    // 1️⃣ 오늘 선택한 미션 목록 가져오기 (중복 없이)
    const [missionRows] = await conn.query(
      `SELECT mission_description
       FROM missions
       WHERE user_id = ?
       AND DATE(created_at) = CURDATE()`,
      [user_id]
    );

    const todayMissionList = missionRows.map(m => removeEmoji(m.mission_description));
    const missionCount = todayMissionList.length;

    // 2️⃣ 지난 7일간 AI 행동 로그 가져오기
    const [logRows] = await conn.query(
      `SELECT action_type, detected_at, DAYOFWEEK(detected_at) AS day_num
       FROM user_action_log
       WHERE user_id = ?
       AND detected_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
       ORDER BY detected_at`,
      [user_id]
    );

    const dayMap = { 1: '일', 2: '월', 3: '화', 4: '수', 5: '목', 6: '금', 7: '토' };

    // 3️⃣ 요일별로 "성공한 미션 종류"만 카운트하기 위해 Set 사용
    const successSets = {
      '월': new Set(),
      '화': new Set(),
      '수': new Set(),
      '목': new Set(),
      '금': new Set(),
      '토': new Set(),
      '일': new Set()
    };

    // 4️⃣ 행동 로그를 미션과 매칭
    for (const log of logRows) {
      const mappedAction = ACTION_MAP[log.action_type];   // 행동 텍스트
      const day = dayMap[log.day_num];                    // 요일

      // 미션에 포함된 행동이고, 중복 없이 기록
      if (todayMissionList.includes(mappedAction)) {
        successSets[day].add(mappedAction);
      }
    }

    // 5️⃣ 요일별 성공률 계산 (중복 제거된 Set 기준)
    const rateByDay = {};
    let totalRate = 0;

    for (const day of Object.keys(successSets)) {
      const successCount = successSets[day].size;  // 해당 요일 성공한 미션 종류 수

      const rate =
        missionCount > 0 ? Math.round((successCount / missionCount) * 100) : 0;

      rateByDay[day] = rate;
      totalRate += rate;
    }

    // 6️⃣ 주간 평균
    const weeklyAverage = (totalRate / 7).toFixed(1);

    // 7️⃣ 최고 성과 요일
    const bestDay = Object.entries(rateByDay).sort((a, b) => b[1] - a[1])[0][0];

    conn.release();

    res.json({
      successByDay: rateByDay,
      weeklyAverage,
      bestDay
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "서버 에러" });
  }
});

module.exports = router;
