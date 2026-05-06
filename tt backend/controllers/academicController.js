const db = require("../config/db");
const XLSX = require("xlsx");
const { generateEmptySlots, generateFourthYearSlots, generateTimetable } = require("../services/slotEngine");
const { generateMechTimetable } = require("../services/mechSlotEngine");
const { generateCompTimetable } = require("../services/compSlotEngine");

function normalizeDepartment(value) {
  const dept = String(value || "ECS").trim().toUpperCase();

  const allowedDepartments = [
    "ECS",
    "MECH",
    "CIVIL",
    "COMP",
    "COMP 1",
    "COMP 2"
  ];

  if (!allowedDepartments.includes(dept)) {
    return "ECS";
  }

  return dept;
}

function inferYearFromSemester(semester) {
  const numericSemester = Number(semester);
  if (!numericSemester) return null;
  return Math.ceil(numericSemester / 2);
}

function normalizeUploadRows(rows) {
  const values = [];

  for (const row of rows) {
    const department = normalizeDepartment(row.department);
    const year = Number(row.year) || inferYearFromSemester(row.semester);
    const semester = Number(row.semester);
    const faculty = row.faculty || null;

    if (row.subject && row.hours && row.type) {
      values.push([
        department,
        year,
        semester,
        row.subject,
        Number(row.hours),
        row.type,
        faculty
      ]);
      continue;
    }

    if (!row.course) continue;

    const derivedEntries = [
      { name: row.course, hours: Number(row.theory), type: "THEORY" },
      { name: `${row.course} Lab`, hours: Number(row.practical), type: "LAB" },
      { name: `${row.course} Tutorial`, hours: Number(row.tutorial), type: "TUTORIAL" }
    ];

    for (const entry of derivedEntries) {
      if (!entry.hours) continue;

      values.push([
        department,
        year,
        semester,
        entry.name,
        entry.hours,
        entry.type,
        faculty
      ]);
    }
  }

  return values.filter(([, year, semester, name, hours]) => {
    return year && semester && name && Number.isFinite(hours) && hours > 0;
  });
}

const uploadSubjectsController = (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);
    const uploadDepartment = normalizeDepartment(req.body.department);

    if (!rows.length) {
      return res.status(400).json({ message: "Excel file empty" });
    }

    const values = normalizeUploadRows(rows);
    const valuesWithDepartment = values.map((row) => [uploadDepartment, ...row.slice(1)]);

    if (!valuesWithDepartment.length) {
      return res.status(400).json({
        message: "Excel columns did not match the expected format"
      });
    }

    const department = valuesWithDepartment[0][0];
    const year = valuesWithDepartment[0][1];
    const semester = valuesWithDepartment[0][2];
    const sql = `
      INSERT INTO subjects
      (department, year, semester, name, hours_per_week, type, faculty)
      VALUES ?
    `;

    db.query("DELETE FROM subjects WHERE department = ? AND year = ? AND semester = ?", [department, year, semester], (deleteError) => {
      if (deleteError) {
        console.error("DELETE ERROR:", deleteError);
        return res.status(500).json({ message: "Failed to replace old subjects" });
      }

      db.query(sql, [valuesWithDepartment], (insertError, result) => {
        if (insertError) {
          console.error("INSERT ERROR:", insertError);
          return res.status(500).json({ message: "Insert failed" });
        }

        res.json({
          success: true,
          uploaded: result.affectedRows
        });
      });
    });
  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    res.status(500).json({ message: "Upload crashed" });
  }
};

const getSubjectsController = (req, res) => {
  const { year, semester } = req.query;
  const department = normalizeDepartment(req.query.department);

  if (!year || !semester) {
    return res.status(400).json({ message: "year & semester required" });
  }

  const sql = `
    SELECT name, hours_per_week AS hoursPerWeek, type, faculty
    FROM subjects
    WHERE department = ? AND year = ? AND semester = ?
  `;

  db.query(sql, [department, year, semester], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Fetch failed" });
    }

    res.json({ success: true, subjects: rows });
  });
};

const generateTimetableController = (req, res) => {
  const { year, semester } = req.body;
  const department = normalizeDepartment(req.body.department);

  if (!year || !semester) {
    return res.status(400).json({ message: "year & semester required" });
  }

  const subjectSql = `
    SELECT 
      name, 
     hours_per_week AS hoursPerWeek, 
      type, 
      faculty
  FROM subjects
  WHERE department = ? AND year = ? AND semester = ?
  `;

  db.query(subjectSql, [department, year, semester], (err, subjects) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Subject fetch failed" });
    }

    if (!subjects.length) {
      return res.status(400).json({ message: "No subjects found" });
    }

    const lockSql = `
      SELECT faculty, day, time
      FROM timetable_slots
      WHERE semester = ?
        AND department <> ?
        AND faculty IS NOT NULL
        AND faculty <> ''
    `;

    db.query(lockSql, [semester, department], (lockError, lockedRows) => {
      if (lockError) {
        console.error(lockError);
        return res.status(500).json({ message: "Faculty lock fetch failed" });
      }

      const lockedFacultyBookings = lockedRows.map((slot) => {
        return `${slot.faculty}__${slot.day}__${slot.time}`;
      });

      let timetable;

if (department === "MECH") {
  timetable = generateMechTimetable(subjects, lockedFacultyBookings);
} else if (department === "COMP 1" || department === "COMP 2") {
  timetable = generateCompTimetable(subjects, year, lockedFacultyBookings);
} else {
  timetable = generateTimetable(
    subjects,
    Number(year) === 4 ? generateFourthYearSlots() : generateEmptySlots(),
    {
      lockedFacultyBookings
    }
  );
}

      if (!timetable) {
        return res.status(400).json({
          message: "Could not generate a timetable with the current constraints"
        });
      }

      const rowsToInsert = timetable
        .filter((slot) => slot.subject && slot.subject !== "BREAK" && slot.subject !== "LUNCH")
        .map((slot) => [department, year, semester, slot.day, slot.time, slot.subject, slot.faculty || null]);
        const clashMap = new Map();
const clashes = [];

for (const row of rowsToInsert) {
  const [dept, yr, sem, day, time, subject, faculty] = row;

  if (!faculty) continue;

  const key = `${faculty}_${day}_${time}`;

  if (clashMap.has(key)) {
    clashes.push({
      faculty,
      day,
      time,
      firstSubject: clashMap.get(key),
      secondSubject: subject
    });
  } else {
    clashMap.set(key, subject);
  }
}

if (clashes.length > 0) {
  return res.status(400).json({
    message: "Teacher clash detected",
    clashes
  });
}

      db.query("DELETE FROM timetable_slots WHERE department = ? AND year = ? AND semester = ?", [department, year, semester], (deleteError) => {
        if (deleteError) {
          console.error("DELETE ERROR:", deleteError);
          return res.status(500).json({ message: "Failed to replace old timetable" });
        }

        db.query(
          `INSERT INTO timetable_slots (department, year, semester, day, time, subject, faculty) VALUES ?`,
          [rowsToInsert],
          (insertError, result) => {
            if (insertError) {
              console.error("INSERT ERROR:", insertError);
              return res.status(500).json({ message: "Insert failed" });
            }

            res.json({ success: true, inserted: result.affectedRows });
          }
        );
      });
    });
  });
};

const getTimetableController = (req, res) => {
  const { year, semester } = req.query;
  const department = normalizeDepartment(req.query.department);
  const sql = `
    SELECT day, time, subject, faculty
    FROM timetable_slots
    WHERE department = ? AND year = ? AND semester = ?
    ORDER BY FIELD(day,'MON','TUE','WED','THU','FRI','SAT'), time
  `;

  db.query(sql, [department, year, semester], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Fetch failed" });
    }

    res.json({ success: true, slots: rows });
  });
};

const getTeacherTimetableController = (req, res) => {
  const { faculty } = req.query;

  if (!faculty) {
    return res.status(400).json({ message: "faculty required" });
  }

  const sql = `
    SELECT department, year, semester, day, time, subject, faculty
    FROM timetable_slots
    WHERE faculty = ?
    ORDER BY FIELD(day,'MON','TUE','WED','THU','FRI','SAT'), time
  `;

  db.query(sql, [faculty], (err, rows) => {
    if (err) {
      console.error("TEACHER TIMETABLE ERROR:", err);
      return res.status(500).json({ message: "Teacher timetable fetch failed" });
    }

    res.json({
      success: true,
      faculty,
      timetable: rows
    });
  });
};

module.exports = {
  uploadSubjectsController,
  getSubjectsController,
  generateTimetableController,
  getTimetableController,
  getTeacherTimetableController
};