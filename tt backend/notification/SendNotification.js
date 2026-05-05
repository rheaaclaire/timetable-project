router.post("/notify", (req, res) => {
  const { message, receiver, type } = req.body;

  db.query(
    "INSERT INTO notifications (message, receiver, type) VALUES (?, ?, ?)",
    [message, receiver, type],
    (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Notification failed" });
      }
      res.json({ success: true });
    }
  );
});