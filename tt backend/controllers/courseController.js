const db = require('../config/db');
const xlsx = require('xlsx');
const path = require('path');
const multer = require('multer');

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

exports.uploadCourses = [
  upload.single('file'),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const filePath = path.join(__dirname, '..', req.file.path);
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    // Insert each row into DB
    rows.forEach(row => {
      const { semester, branch, course, theory, practical, tutorial } = row;

      // Get branch_id from branch_code
      db.query(
        'SELECT branch_id FROM branches WHERE branch_code = ?',
        [branch],
        (err, result) => {
          if (err || result.length === 0) {
            console.error('Branch not found:', branch);
            return;
          }

          const branch_id = result[0].branch_id;

          db.query(
            `INSERT INTO courses 
             (course_name, semester, branch_id, theory_hours, practical_hours, tutorial_hours)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [course, semester, branch_id, theory, practical, tutorial],
            err => {
              if (err) console.error('Insert error:', err);
            }
          );
        }
      );
    });

    res.json({ message: 'Courses saved to database successfully' });
  }
];
