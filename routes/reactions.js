//이모지 반응
const express = require('express');
const pool = require('../db');
const router = express.Router();

// 반응 토글
router.post('/:postId/reactions', async (req, res) => {
  try {
    const postId = Number(req.params.postId);
    const { reaction_type } = req.body; // 'CHEER' | 'SAME' | 'HUG'
    if (!['CHEER','SAME','HUG'].includes(reaction_type)) {
      return res.status(400).json({ message: 'reaction_type이 올바르지 않음' });
    }
    // 존재하면 삭제, 없으면 추가 (user_id는 임시 1)
    const [ex] = await pool.execute(
      `SELECT 1 FROM post_reactions WHERE post_id=? AND user_id=? AND reaction_type=?`,
      [postId, 1, reaction_type]
    );
    if (ex.length) {
      await pool.execute(
        `DELETE FROM post_reactions WHERE post_id=? AND user_id=? AND reaction_type=?`,
        [postId, 1, reaction_type]
      );
      return res.json({ toggled: 'off' });
    } else {
      await pool.execute(
        `INSERT INTO post_reactions (post_id, user_id, reaction_type) VALUES (?,?,?)`,
        [postId, 1, reaction_type]
      );
      return res.json({ toggled: 'on' });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;