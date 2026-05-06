// routes/notificationRoutes.js

const express = require("express");
const db = require("../config/db");

const router = express.Router();

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

router.post("/notify", (req, res) => {
  const { message, receiver, type } = req.body;

  db.query(
    "INSERT INTO notifications (message, receiver, type) VALUES (?, ?, ?)",
    [message, receiver, type],
    (err) => {
      if (err) return res.status(500).json({ error: "Notification failed" });
      res.json({ success: