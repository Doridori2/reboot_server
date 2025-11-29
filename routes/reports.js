//report.js
const express = require('express');
const router = express.Router();
const rbpool = require('../db');

// 🔥 AI 코드 → 행동 텍스트 매핑
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
  C101: "공놀이를 하다",
  C112: "춤을 춘다",
};

// 🧹 mission_description에서 이모지 제거
function removeEmoji(text) {
    return text.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "").trim();
}

router.get('/weekly', async (req, res) => {
    const { user_id } = req.query;

    if (!user_id) {
        return res.status(400).json({ message: '필수 정보 누락' });
    }

    try {
        const conn = await rbpool.getConnection();

        // 1️⃣ 유저 미션 목록 (이모지 제거!)
        const [missionRows] = await conn.query(
            `SELECT mission_description FROM missions WHERE user_id = ?`,
            [user_id]
        );

        const selectedMissions = missionRows.map(m =>
            removeEmoji(m.mission_description)
        );

        // 2️⃣ 지난 7일 행동 로그
        const [logRows] = await conn.query(
            `SELECT action_type,
                    DATE(detected_at) AS date_only,
                    DAYOFWEEK(detected_at) AS day_num
             FROM user_action_log
             WHERE user_id = ?
               AND detected_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
             ORDER BY detected_at ASC`,
            [user_id]
        );

        // 요일 매핑
        const dayMap = { 1: '일', 2: '월', 3: '화', 4: '수', 5: '목', 6: '금', 7: '토' };

        const successByDay = { '월': 0, '화': 0, '수': 0, '목': 0, '금': 0, '토': 0, '일': 0 };

        // 3️⃣ 미션 매칭
        for (const log of logRows) {
            const day = dayMap[log.day_num];
            const mappedAction = ACTION_MAP[log.action_type];

            if (selectedMissions.includes(mappedAction)) {
                successByDay[day] += 1;
            }
        }

        // 4️⃣ 성공률 계산
        const rateByDay = {};
        let sum = 0;
        let cnt = 0;

        for (const day of Object.keys(successByDay)) {
            const success = successByDay[day];

            const rate =
                selectedMissions.length > 0
                    ? Math.round((success / selectedMissions.length) * 100)
                    : 0;

            rateByDay[day] = rate;
            sum += rate;
            cnt += 1;
        }

        const weeklyAverage = (sum / cnt).toFixed(1);

        const bestDay = Object.entries(rateByDay)
            .sort((a, b) => b[1] - a[1])[0][0];

        conn.release();

        res.json({
            successByDay: rateByDay,
            weeklyAverage,
            bestDay
        });

    } catch (error) {
        console.error("📌 Weekly Report Error:", error);
        res.status(500).json({ message: '서버 에러' });
    }
});

module.exports = router;
