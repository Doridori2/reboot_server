//이모지 반응
const express = require('express');
const pool = require('../db');
const router = express.Router();

const VALID_REACTIONS = ['CHEER', 'HUG', 'SAME', 'LOVE', 'BRAVE'];

// 반응 토글
router.post('/:postId/reactions', async (req, res) => {
  try {
    const postId = Number(req.params.postId);
    const { user_id, reaction_type } = req.body;

    if (!VALID_REACTIONS.includes(reaction_type)) {
      return res.status(400).json({ message: 'reaction_type이 유효하지 않습니다.' });
    }

    const [existing] = await pool.execute(
      `SELECT 1 FROM post_reactions WHERE post_id=? AND user_id=? AND reaction_type=?`,
      [postId, user_id, reaction_type]
    );

    if (existing.length) {
      await pool.execute(
        `DELETE FROM post_reactions WHERE post_id=? AND user_id=? AND reaction_type=?`,
        [postId, user_id, reaction_type]
      );
      return res.json({ toggled: 'off' });
    } else {
      await pool.execute(
        `INSERT INTO post_reactions (post_id, user_id, reaction_type) VALUES (?,?,?)`,
        [postId, user_id, reaction_type]
      );
      return res.json({ toggled: 'on' });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// 게시글별 반응 개수 조회
router.get('/:postId/reactions', async (req, res) => {
  try {
    const postId = Number(req.params.postId);
    const [rows] = await pool.execute(
      `SELECT reaction_type, COUNT(*) AS count 
       FROM post_reactions WHERE post_id=? GROUP BY reaction_type`,
      [postId]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


module.exports = router;