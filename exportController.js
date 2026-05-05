const db = require("../config/db");
const XLSX = require("xlsx");

exports.exportTimetableController = (req, res) => {
  const { department, year, semester } = req.query;

  if (!department || !year || !semester) {
    return res.status(400).json({
      message: "department, year and semester are required"
    });
  }

  const sql = `
    SELECT day, time, subject, faculty
    FROM timetable_slots
    WHERE department=? AND year=? AND semester=?
    ORDER BY FIELD(day,'MON','TUE','WED','THU','FRI','SAT'), time
  `;

  db.query(sql, [department, year, semester], (err, rows) => {
    if (err) {
      console.error("EXPORT ERROR:", err);
      return res.status(500).json({ message: "DB error" });
    }

    if (rows.length === 0) {
      return res.status(404).json({ message: "No timetable found" });
    }

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Timetable");

    const buffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx"
    });

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${department}_Y${year}_S${semester}_Timetable.xlsx"`
    );

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.send(buffer);
  });
};