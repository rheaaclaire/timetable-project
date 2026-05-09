const express = require("express");
const router = express.Router();
const db = require("../config/db");

// GET all calendar events
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT * FROM academic_calendar
      ORDER BY event_date ASC
    `);

    res.json(rows);
  } catch (err) {
    console.error("Calendar GET error:", err);
    res.status(500).json({ message: "Failed to fetch calendar events" });
  }
});

// ADD calendar event
router.post("/", async (req, res) => {
  try {
    console.log("BODY RECEIVED:", req.body);

    const body = req.body || {};

    const title = body.title;
    const description = body.description || "";
    const event_date = body.event_date || body.date;
    const event_type = body.event_type || body.type;
    const created_by = body.created_by || "admin";

    if (!title || !event_date || !event_type) {
      return res.status(400).json({
        message: "Missing required fields",
        received: body,
      });
    }

    const [result] = await db.query(
      `
      INSERT INTO academic_calendar
      (title, description, event_date, event_type, created_by)
      VALUES (?, ?, ?, ?, ?)
      `,
      [title, description, event_date, event_type, created_by]
    );

    res.status(201).json({
      message: "Event added successfully",
      id: result.insertId,
    });
  } catch (err) {
    console.error("Calendar POST error:", err);
    res.status(500).json({
      message: "Could not add event",
      error: err.message,
    });
  }
});

// DELETE calendar event
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    await db.query("DELETE FROM academic_calendar WHERE id = ?", [id]);

    res.json({ message: "Event deleted successfully" });
  } catch (err) {
    console.error("Calendar DELETE error:", err);
    res.status(500).json({ message: "Failed to delete calendar event" });
  }
});

module.exports = router;