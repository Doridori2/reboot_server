//게시판 
const express = require('express');
const pool = require('../db');
const router = express.Router();

// 한 줄 글 작성
router.post('/', async (req, res) => {
  console.log("📩 요청 Body:", req.body);   // ✅ 로그 확인
  try {
    const { title = null, content, mood_color = null, visibility = 'ANON', topic_id = null } = req.body;
    if (!content || content.length === 0 || content.length > 140) {
      return res.status(400).json({ message: 'content는 1~140자' });
    }

    const [r] = await pool.execute(
      `INSERT INTO posts (user_id, title, content, mood_color, visibility, topic_id)
       VALUES (1, ?, ?, ?, ?, ?)`,
      [title, content, mood_color, visibility, topic_id]
    );

    res.status(201).json({ id: r.insertId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 공개 피드 조회
router.get('/', async (req, res) => {
  try {
    const cursor = Number(req.query.cursor || 0);
    const cond = cursor ? 'AND p.id < ?' : '';
    const params = cursor ? [cursor] : [];
    const [rows] = await pool.execute(
       `SELECT p.id, p.user_id, p.title, p.content, p.mood_color, p.visibility, p.created_at 
      FROM posts p
      WHERE p.deleted_at IS NULL AND p.visibility='ANON' ${cond}
      ORDER BY p.id DESC
      LIMIT 20`, params
    );
    res.json({ items: rows, next_cursor: rows?.[rows.length-1]?.id || null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ✏️ 게시물 수정
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title = null, content, mood_color } = req.body;

    if (!content || content.length === 0 || content.length > 140) {
      return res.status(400).json({ message: 'content는 1~140자' });
    }

    const [r] = await pool.execute(
      `UPDATE posts SET title=?, content=?, mood_color=? WHERE id=? AND deleted_at IS NULL`,
      [title, content, mood_color, id]
    );

    if (r.affectedRows === 0) return res.status(404).json({ message: "게시물이 없거나 이미 삭제됨" });
    res.json({ message: "수정 성공" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 🗑 게시물 완전 삭제 (hard delete)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [r] = await pool.execute(
      `DELETE FROM posts WHERE id=?`,
      [id]
    );

    if (r.affectedRows === 0) {
      return res.status(404).json({ message: "이미 삭제되었거나 없는 글" });
    }
    res.json({ message: "완전 삭제 성공" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
// 🗑 게시물 삭제 (soft delete)
// router.delete('/:id', async (req, res) => {
//   try {
//     const { id } = req.params;

//     const [r] = await pool.execute(
//       `UPDATE posts SET deleted_at = NOW() WHERE id=? AND deleted_at IS NULL`,
//       [id]
//     );

//     if (r.affectedRows === 0) return res.status(404).json({ message: "이미 삭제되었거나 없는 글" });
//     res.json({ message: "삭제 성공" });
//   } catch (e) {
//     res.status(500).json({ error: e.message });
//   }
// });

module.exports = router;