router.put("/notifications/:id", (req, res) => {
  db.query(
    "UPDATE notifications SET status = 'read' WHERE id = ?",
    [req.params.id],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json({ success: true });
    }
  );
});