router.get("/notifications/:user", (req, res) => {
  const user = req.params.user;

  db.query(
    "SELECT * FROM notifications WHERE receiver = ? ORDER BY created_at DESC",
    [user],
    (err, results) => {
      if (err) return res.status(500).json(err);
      res.json(results);
    }
  );
});