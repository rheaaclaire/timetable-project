const db = require('../config/db');

/**
 * Find an available faculty for a subject at a given day & time
 */
exports.findAvailableFaculty = (subjectName, day, time, callback) => {
  const sql = `
    SELECT f.id
    FROM faculty f
    JOIN faculty_subjects fs ON fs.faculty_id = f.id
    WHERE fs.subject_name = ?
    AND f.id NOT IN (
      SELECT faculty_id
      FROM faculty_slots
      WHERE day = ? AND time = ?
    )
    LIMIT 1
  `;

  db.query(sql, [subjectName, day, time], (err, rows) => {
    if (err) return callback(err);
    if (rows.length === 0) return callback(null, null);

    callback(null, rows[0].id);
  });
};