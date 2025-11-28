// routes/reports.js
const express = require('express');
const router = express.Router();
const rbpool = require('../db');

// GET /reports/weekly?user_id=xxx
router.get('/weekly', async (req, res) => {
    const { user_id } = req.query;

    if (!user_id) {
        return res.status(400).json({ message: '필수 정보 누락' });
    }

    try {
        const conn = await rbpool.getConnection();

        // 1️⃣ 유저가 선택한 미션 가져오기
        const [missionRows] = await conn.query(
            `SELECT label 
             FROM missions 
             WHERE user_id = ?`,
            [user_id]
        );

        const selectedMissions = missionRows.map(m => m.label);

        // 2️⃣ 지난 7일간 AI 행동 로그 가져오기
        const [logRows] = await conn.query(
            `SELECT action_type, DATE(detected_at) AS date_only, DAYOFWEEK(detected_at) AS day_num
             FROM user_action_log
             WHERE user_id = ?
               AND detected_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
             ORDER BY detected_at ASC`,
            [user_id]
        );

        // 3️⃣ 요일 매핑 (MySQL DAYOFWEEK: 1=일요일 ~ 7=토요일)
        const dayMap = {
            1: '일',  // Sunday
            2: '월',
            3: '화',
            4: '수',
            5: '목',
            6: '금',
            7: '토',
        };

        const successByDay = { '월': 0, '화': 0, '수': 0, '목': 0, '금': 0, '토': 0, '일': 0 };
        const totalActionsByDay = { '월': 0, '화': 0, '수': 0, '목': 0, '금': 0, '토': 0, '일': 0 };

        // 4️⃣ AI 행동 중 미션과 일치한 것 계산
        for (const log of logRows) {
            const day = dayMap[log.day_num]; // << 수정됨 (정확한 매핑)

            totalActionsByDay[day] += 1;

            if (selectedMissions.includes(log.action_type)) {
                successByDay[day] += 1;
            }
        }

        // 5️⃣ 성공률 계산
        const rateByDay = {};
        let sum = 0;
        let cnt = 0;

        for (const day of Object.keys(successByDay)) {
            const total = totalActionsByDay[day];
            const success = successByDay[day];

            // 성공률 = (성공 / 전체) × 100
            const rate = total > 0 ? Math.round((success / total) * 100) : 0;

            rateByDay[day] = rate;

            sum += rate;
            cnt += 1;
        }

        const weeklyAverage = cnt > 0 ? (sum / cnt).toFixed(1) : "0.0";

        const bestDay = Object.entries(rateByDay).sort((a, b) => b[1] - a[1])[0][0];

        conn.release();

        return res.json({
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
