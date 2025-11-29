//mission.js
const express = require('express');
const router = express.Router();
const rbpool = require('../db');

// GET /missions/today?user_id=xxx
router.get('/today', async (req, res) => {
    const { user_id } = req.query;
    console.log(`[GET] /missions/today 요청 - user_id: ${user_id}`);

    if (!user_id) {
        return res.status(400).json({ message: '필수 정보 누락' });
    }

    try {
        const conn = await rbpool.getConnection();
        const sql = `
            SELECT * FROM missions
            WHERE user_id = ? AND DATE(created_at) = CURDATE()
            ORDER BY created_at ASC
        `;
        const [missions] = await conn.query(sql, [user_id]);
        conn.release();
        res.json({ missions });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: '서버 에러' });
    }
});

// GET /missions/by-time?user_id=xxx&time=evening
router.get('/by-time', async (req, res) => {
    const { user_id, time } = req.query;

    if (!user_id || !time) {
        return res.status(400).json({ message: '필수 정보 누락' });
    }

    try {
        const conn = await rbpool.getConnection();
        const sql = `
            SELECT * FROM missions
            WHERE user_id = ? AND mission_time_period = ? AND DATE(created_at) = CURDATE()
            ORDER BY created_at ASC
        `;
        const [missions] = await conn.query(sql, [user_id, time]);
        conn.release();
        res.json({ missions });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: '서버 에러' });
    }
});

// POST /missions – 새 미션 추가
router.post('/', async (req, res) => {
    const { user_id, mission_description, mission_type, mission_time_period } = req.body;
    console.log(`[POST] /missions 요청 - user_id: ${user_id}, 내용: ${mission_description}`);

    if (!user_id || !mission_description) {s
        return res.status(400).json({ message: '필수 정보 누락' });
    }

    try {
        const conn = await rbpool.getConnection();
        const sql = `
            INSERT IGNORE INTO missions
            (user_id, mission_description, mission_type, mission_time_period, created_at, created_time, status)
            VALUES (?, ?, ?, ?, CURDATE(), NOW(), 'pending')
            `;
        const [result] = await conn.query(sql, [
            user_id,
            mission_description,
            mission_type,
            mission_time_period
        ]);
        conn.release();
        res.status(201).json({ message: '미션 추가 성공', mission_id: result.insertId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: '서버 에러' });
    }
});

//DELETE 삭제
router.post('/delete', async (req, res) => {
  const { user_id, mission_time_period, mission_description } = req.body;

  if (!user_id || !mission_time_period || !mission_description) {
    return res.status(400).json({ message: '필수 정보 누락' });
  }

  try {
    const conn = await rbpool.getConnection();
   const sql = `
  DELETE FROM missions
  WHERE user_id = ? AND mission_description = ? AND mission_time_period = ? AND DATE(created_at) = CURDATE()
`;
await conn.query(sql, [user_id, mission_description, mission_time_period]);
    conn.release();
    res.json({ message: '미션 삭제 성공' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '서버 에러' });
  }
});

// POST /missions/save-batch
router.post('/save-batch', async (req, res) => {
    const { user_id, time_period, mission_list } = req.body;

    if (!user_id || !time_period || !Array.isArray(mission_list)) {
        return res.status(400).json({ message: '필수 정보 누락' });
    }

    try {
        const conn = await rbpool.getConnection();

        // 1. 기존 해당 시간대 미션 삭제
        await conn.query(
            `DELETE FROM missions WHERE user_id = ? AND mission_time_period = ? AND DATE(created_at) = CURDATE()`,
            [user_id, time_period]
        );

        // 2. 새 미션들 등록
        for (const desc of mission_list) {
            await conn.query(
                `INSERT INTO missions (user_id, mission_description, mission_type, mission_time_period, created_at, created_time, status)
                VALUES (?, ?, ?, ?, CURDATE(), NOW(), 'pending');`,
                [user_id, desc, time_period]
            );
        }

        conn.release();
        res.json({ message: '미션 저장 완료', count: mission_list.length });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: '서버 에러' });
    }
});

// POST /missions/update-status
router.post('/update-status', async (req, res) => {
    const { user_id, mission_id, status } = req.body;

    if (!user_id || !mission_id || !status) {
        return res.status(400).json({ message: '필수 정보 누락' });
    }

    try {
        const conn = await rbpool.getConnection();
        const sql = `
            UPDATE missions
            SET status = ?
            WHERE mission_id = ? AND user_id = ?
        `;
        const [result] = await conn.query(sql, [status, mission_id, user_id]);
        conn.release();
        res.json({ message: '미션 상태 업데이트 완료' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: '서버 에러' });
    }
});

// POST /missions/increment-completed
router.post('/increment-completed', async (req, res) => {
    const { user_id, mission_id } = req.body;

    if (!user_id || !mission_id) {
        return res.status(400).json({ message: '필수 정보 누락' });
    }

    try {
        const conn = await rbpool.getConnection();
        const sql = `
            UPDATE missions
            SET completed_number = completed_number + 1, status = 'completed', completed_at = NOW()
            WHERE mission_id = ? AND user_id = ?
        `;
        const [result] = await conn.query(sql, [mission_id, user_id]);
        conn.release();
        res.json({ message: '완료 횟수 +1, 상태 업데이트 완료' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: '서버 에러' });
    }
});

// PATCH /missions/:id
router.patch('/:id', async (req, res) => {
    const { id } = req.params;
    const { mission_description, mission_type, mission_time_period, status, comment } = req.body;

    try {
        const conn = await rbpool.getConnection();
        const sql = `
            UPDATE missions
            SET mission_description = ?, mission_type = ?, mission_time_period = ?, status = ?, comment = ?
            WHERE mission_id = ?
        `;
        const [result] = await conn.query(sql, [
            mission_description,
            mission_type,
            mission_time_period,
            status,
            comment,
            id
        ]);
        conn.release();
        res.json({ message: '미션 수정 완료' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: '서버 에러' });
    }
});

// DELETE /missions/:id
router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    if (!id) {
        return res.status(400).json({ message: '미션 ID 누락' });
    }

    try {
        const conn = await rbpool.getConnection();
        const sql = `DELETE FROM missions WHERE mission_id = ?`;
        const [result] = await conn.query(sql, [id]);
        conn.release();

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: '해당 미션을 찾을 수 없습니다' });
        }

        res.json({ message: '미션 삭제 완료', deleted_id: id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: '서버 에러' });
    }
});

module.exports = router;