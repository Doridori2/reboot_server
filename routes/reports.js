// routes/reports.js
const express = require('express');
const router = express.Router();  // ✅ 이 한 줄이 없어서 생긴 에러

/// GET /reports/weekly?user_id=xxx
router.get('/weekly', async (req, res) => {
    const { user_id } = req.query;

    if (!user_id) {
        return res.status(400).json({ message: '필수 정보 누락' });
    }

    try {
        const conn = await rbpool.getConnection();

        // 1️⃣ 유저가 선택한 미션 가져오기
        const [missionRows] = await conn.query(
            `SELECT mission_label 
             FROM missions 
             WHERE user_id = ?`,
            [user_id]
        );

        const selectedMissions = missionRows.map(m => m.mission_label);

        // mission_label 예시:
        // ["음식을 먹는다", "이를 닦는다", "물 마시기"]

        // 2️⃣ 지난 7일간 user_action_log 조회
        const [logRows] = await conn.query(
            `SELECT action_type, DATE(detected_at) AS date_only, DAYOFWEEK(detected_at) AS day_num
             FROM user_action_log
             WHERE user_id = ?
             AND detected_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
             ORDER BY detected_at ASC`,
            [user_id]
        );

        const dayMap = ['일', '월', '화', '수', '목', '금', '토'];
        const successByDay = { '월': 0, '화': 0, '수': 0, '목': 0, '금': 0, '토': 0, '일': 0 };
        const totalActionsByDay = { '월': 0, '화': 0, '수': 0, '목': 0, '금': 0, '토': 0, '일': 0 };

        // 3️⃣ AI 인식 행동이 미션과 매칭되는지 체크
        for (const log of logRows) {
            const day = dayMap[log.day_num % 7];

            totalActionsByDay[day] += 1;

            if (selectedMissions.includes(log.action_type)) {
                successByDay[day] += 1;
            }
        }

        // 4️⃣ 성공률 계산
        const rateByDay = {};
        let sum = 0;
        let cnt = 0;

        for (const day of Object.keys(successByDay)) {
            const total = totalActionsByDay[day];
            const success = successByDay[day];

            const rate = total > 0 ? Math.round((success / total) * 100) : 0;
            rateByDay[day] = rate;

            sum += rate;
            cnt += 1;
        }

        const weeklyAverage = (sum / cnt).toFixed(1);
        const bestDay = Object.entries(rateByDay).sort((a, b) => b[1] - a[1])[0][0];

        conn.release();

        res.json({
            successByDay: rateByDay,
            weeklyAverage,
            bestDay
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: '서버 에러' });
    }
});
