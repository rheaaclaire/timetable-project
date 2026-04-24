const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const db = require("../config/db");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/upload-subjects", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ message: "Excel is empty" });
    }

    const values = rows.map(r => [
      Number(r.year),
      Number(r.semester),
      r.subject,
      Number(r.hours),
      r.type,
      r.faculty || null
    ]);

    const sql = `
      INSERT INTO subjects
      (year, semester, name, hours_per_week, type, faculty)
      VALUES ?
    `;

    db.query(sql, [values], err => {
      if (err) {
        console.error("UPLOAD DB ERROR:", err);
        return res.status(500).json({ message: "DB insert failed" });
      }

      res.json({
        success: true,
        uploaded: values.length
      });
    });

  } catch (e) {
    console.error("UPLOAD ERROR:", e);
    res.status(500).json({ message: "Upload failed" });
  }
});

module.exports = router;