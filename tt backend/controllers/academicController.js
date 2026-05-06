const db = require("../config/db");
const XLSX = require("xlsx");
const { generateEmptySlots, generateFourthYearSlots, generateTimetable } = require("../services/slotEngine");

function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, result) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(result);
    });
  });
}

function normalizeDepartment(value) {
  return String(value || "ECS").trim().toUpperCase();
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

async function buildTimetableForSelection(department, year, semester) {
  const subjectSql = `
    SELECT name, hours_per_week AS hoursPerWeek, type, faculty, is_major_minor, closes_day
    FROM subjects
    WHERE department = ? AND year = ? AND semester = ?
  `;
  const subjects = await query(subjectSql, [department, year, semester]);

  if (!subjects.length) {
    const error = new Error("No subjects found");
    error.statusCode = 400;
    throw error;
  }

  const lockSql = `
    SELECT faculty, day, time
    FROM timetable_slots
    WHERE faculty IS NOT NULL
      AND faculty <> ''
      AND NOT (department = ? AND year = ? AND semester = ?)
  `;
  const lockedRows = await query(lockSql, [department, year, semester]);
  const lockedFacultyBookings = lockedRows.map((slot) => {
    return `${slot.faculty}__${slot.day}__${slot.time}`;
  });

  const timetable = generateTimetable(
    subjects,
    Number(year) === 4 ? generateFourthYearSlots() : generateEmptySlots(),
    { lockedFacultyBookings }
  );

  if (!timetable) {
    const error = new Error("Could not generate a timetable with the current constraints");
    error.statusCode = 400;
    throw error;
  }

  return timetable;
}

const previewTimetableController = async (req, res) => {
  try {
    const { year, semester } = req.body;
    const department = normalizeDepartment(req.body.department);

    if (!year || !semester) {
      return res.status(400).json({ message: "year & semester required" });
    }

    const timetable = await buildTimetableForSelection(department, year, semester);
    const savedSlots = timetable.filter((slot) => slot.subject && slot.subject !== "BREAK" && slot.subject !== "LUNCH");

    res.json({
      success: true,
      inserted: savedSlots.length,
      slots: timetable
    });
  } catch (err) {
    console.error(err);
    res.status(err.statusCode || 500).json({ message: err.message || "Preview failed" });
  }
};

const saveTimetableController = async (req, res) => {
  try {
    const { year, semester } = req.body;
    const department = normalizeDepartment(req.body.department);

    if (!year || !semester) {
      return res.status(400).json({ message: "year & semester required" });
    }

    const timetable = await buildTimetableForSelection(department, year, semester);
    const rowsToInsert = timetable
      .filter((slot) => slot.subject && slot.subject !== "BREAK" && slot.subject !== "LUNCH")
      .map((slot) => [department, year, semester, slot.day, slot.time, slot.subject, slot.faculty || null]);

    await query("DELETE FROM timetable_slots WHERE department = ? AND year = ? AND semester = ?", [department, year, semester]);
    const result = await query(
      `INSERT INTO timetable_slots (department, year, semester, day, time, subject, faculty) VALUES ?`,
      [rowsToInsert]
    );

    res.json({ success: true, inserted: result.affectedRows });
  } catch (err) {
    console.error(err);
    res.status(err.statusCode || 500).json({ message: err.message || "Save failed" });
  }
};

const generateTimetableController = saveTimetableController;

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

const getFacultyAvailabilityController = async (req, res) => {
  try {
    const department = normalizeDepartment(req.query.department);
    const day = String(req.query.day || "").trim().toUpperCase();
    const time = String(req.query.time || "").trim();
    const year = req.query.year ? Number(req.query.year) : null;
    const semester = req.query.semester ? Number(req.query.semester) : null;

    if (!day || !time) {
      return res.status(400).json({ message: "day & time required" });
    }

    const facultySqlParts = [
      "SELECT DISTINCT faculty",
      "FROM subjects",
      "WHERE faculty IS NOT NULL",
      "AND faculty <> ''"
    ];
    const facultyParams = [];

    if (department !== "SCIENCE_HUMANITIES") {
      facultySqlParts.push("AND department = ?");
      facultyParams.push(department);
    }

    if (year) {
      facultySqlParts.push("AND year = ?");
      facultyParams.push(year);
    }

    if (semester) {
      facultySqlParts.push("AND semester = ?");
      facultyParams.push(semester);
    }

    const busySql = `
      SELECT DISTINCT faculty
      FROM timetable_slots
      WHERE day = ?
        AND time = ?
        AND faculty IS NOT NULL
        AND faculty <> ''
    `;

    const [facultyRows, busyRows] = await Promise.all([
      query(facultySqlParts.join(" "), facultyParams),
      query(busySql, [day, time])
    ]);

    const busyFaculty = new Set(busyRows.map((row) => row.faculty));
    const availableFaculty = facultyRows
      .map((row) => row.faculty)
      .filter((faculty) => !busyFaculty.has(faculty))
      .sort((left, right) => left.localeCompare(right));

    res.json({ success: true, availableFaculty });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Faculty availability lookup failed" });
  }
};

module.exports = {
  uploadSubjectsController,
  getSubjectsController,
  previewTimetableController,
  saveTimetableController,
  generateTimetableController,
  getTimetableController,
  getFacultyAvailabilityController
};
