//action.js
const express = require('express');
const router = express.Router();
const rbpool = require('../db');

/// POST /actions/record
router.post('/record', async (req, res) => {
    const { user_id, action_type, detected_at } = req.body;

    if (!user_id || !action_type || !detected_at) {
        return res.status(400).json({ message: '필수 정보 누락' });
    }

    try {
        const conn = await rbpool.getConnection();
        const sql = `
            INSERT INTO user_action_log (user_id, action_type, detected_at)
            VALUES (?, ?, ?)
        `;
        await conn.query(sql, [user_id, action_type, detected_at]);
        conn.release();
        res.json({ message: '행동 기록 완료' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: '서버 에러' });
    }
});

module.exports = router;