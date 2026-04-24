const db = require('../config/db');

/**
 * POST /api/assign-faculty
 * Body:
 * {
 *   "faculty_id": 1,
 *   "year": 2,
 *   "semester": 3,
 *   "day": "MON",
 *   "time": "09:00-10:00"
 * }
 */
exports.assignFacultyController = (req, res) => {
  const { faculty_id, year, semester, day, time } = req.body;

  if (!faculty_id || !year || !semester || !day || !time) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields'
    });
  }

  const sql = `
    INSERT INTO faculty_slots
    (faculty_id, year, semester, day, time)
    VALUES (?, ?, ?, ?, ?)
  `;

  db.query(sql, [faculty_id, year, semester, day, time], err => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          success: false,
          message: 'Faculty already assigned at this time'
        });
      }

      console.error(err);
      return res.status(500).json({
        success: false,
        message: 'DB error'
      });
    }

    res.json({
      success: true,
      message: 'Faculty assigned & slot locked'
    });
  });
};