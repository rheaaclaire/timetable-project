const db = require('../config/db');
const XLSX = require('xlsx');

exports.exportTimetableController = (req, res) => {
  const { year, semester } = req.query;
  const department = String(req.query.department || "ECS").trim().toUpperCase();

  if (!year || !semester) {
    return res.status(400).json({
      message: 'year and semester are required'
    });
  }

  const sql = `
    SELECT day, time, subject, room, faculty
    FROM timetable_slots
    WHERE department=? AND year=? AND semester=?
    ORDER BY FIELD(day,'MON','TUE','WED','THU','FRI','SAT'), time
  `;

  db.query(sql, [department, year, semester], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: 'DB error' });
    }

    if (rows.length === 0) {
      return res.status(404).json({ message: 'No timetable found' });
    }

    // Convert to worksheet
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Timetable');

    // Write to buffer
    const buffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx'
    });

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Timetable_${department}_Y${year}_S${semester}.xlsx"`
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    res.send(buffer);
  });
};
