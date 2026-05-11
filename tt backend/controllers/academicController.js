const db = require("../config/db");
const XLSX = require("xlsx");
const {
  generateEmptySlots,
  generateFourthYearSlots,
  generateTimetable
} = require("../services/slotEngine");

function normalizeDepartment(value) {
  return String(value || "ECS").trim().toUpperCase();
}

function inferYearFromSemester(semester) {
  const numericSemester = Number(semester);
  if (!numericSemester) return null;
  return Math.ceil(numericSemester / 2);
}

function normalizeUploadRows(rows, uploadDepartment, uploadYear, uploadSemester) {
  const values = [];

  for (const row of rows) {
    const keys = Object.keys(row).reduce((acc, key) => {
      acc[key.toLowerCase().trim()] = row[key];
      return acc;
    }, {});

    const department = uploadDepartment;
    const year = uploadYear;
    const semester = uploadSemester;

    const subject =
      keys.subject ||
      keys.course ||
      keys["course name"] ||
      keys.name ||
      keys["subject name"] ||
      "";

    const faculty =
      keys.faculty ||
      keys["faculty name"] ||
      keys.teacher ||
      "";

    let hours =
      Number(keys.hours) ||
      Number(keys["hours per week"]) ||
      Number(keys["hours_per_week"]) ||
      Number(keys["hrs"]) ||
      0;

    let type = String(keys.type || "").toUpperCase();

    const l = Number(keys.l) || 0;
    const t = Number(keys.t) || 0;
    const p = Number(keys.p) || 0;

    if (!hours && (l || t || p)) {
      hours = l + t + p;
      type = p > 0 ? "LAB" : "THEORY";
    }

    if (!hours && type === "LAB") {
      hours = 2;
    }

    if (!subject || !hours) continue;

    values.push([
      department,
      year,
      semester,
      String(subject).trim(),
      hours,
      type || "THEORY",
      String(faculty).trim()
    ]);
  }

  return values;
}

const uploadSubjectsController = (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    if (!rows.length) {
      return res.status(400).json({ message: "Excel file empty" });
    }

    const uploadDepartment = normalizeDepartment(req.body.department);
    const uploadSemester = Number(req.body.semester);
    const uploadYear =
      Number(req.body.year) || inferYearFromSemester(uploadSemester);

    if (!uploadYear || !uploadSemester) {
      return res.status(400).json({
        message: "Year and semester are required"
      });
    }

    const values = normalizeUploadRows(
      rows,
      uploadDepartment,
      uploadYear,
      uploadSemester
    );

    if (!values.length) {
      return res.status(400).json({
        message: "Excel columns did not match the expected format"
      });
    }

    const insertSubjectSql = `
      INSERT INTO subjects
      (department, year, semester, name, hours_per_week, type, faculty)
      VALUES ?
    `;

    db.query(
      "DELETE FROM timetable_slots WHERE department = ? AND year = ? AND semester = ?",
      [uploadDepartment, uploadYear, uploadSemester],
      (slotDeleteError) => {
        if (slotDeleteError) {
          console.error("TIMETABLE DELETE ERROR:", slotDeleteError);
          return res.status(500).json({
            message: "Failed to clear old timetable"
          });
        }

        db.query(
          "DELETE FROM subjects WHERE department = ? AND year = ? AND semester = ?",
          [uploadDepartment, uploadYear, uploadSemester],
          (subjectDeleteError) => {
            if (subjectDeleteError) {
              console.error("SUBJECT DELETE ERROR:", subjectDeleteError);
              return res.status(500).json({
                message: "Failed to replace old subjects"
              });
            }

            db.query(insertSubjectSql, [values], (insertError, result) => {
              if (insertError) {
                console.error("INSERT SUBJECT ERROR:", insertError);
                return res.status(500).json({
                  message: "Insert failed"
                });
              }

              res.json({
                success: true,
                uploaded: result.affectedRows
              });
            });
          }
        );
      }
    );
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
      console.error("FETCH SUBJECTS ERROR:", err);
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
    SELECT name, hours_per_week AS hoursPerWeek, type, faculty, is_major_minor, closes_day
    FROM subjects
    WHERE department = ? AND year = ? AND semester = ?
  `;

  db.query(subjectSql, [department, year, semester], (err, subjects) => {
    if (err) {
      console.error("SUBJECT FETCH ERROR:", err);
      return res.status(500).json({ message: "Subject fetch failed" });
    }

    if (!subjects.length) {
      return res.status(400).json({ message: "No subjects found" });
    }

    const lockSql = `
      SELECT faculty, day, time
      FROM timetable_slots
      WHERE department = ?
        AND year = ?
        AND semester = ?
        AND faculty IS NOT NULL
        AND faculty <> ''
    `;

    db.query(lockSql, [department, year, semester], (lockError, lockedRows) => {
      if (lockError) {
        console.error("FACULTY LOCK FETCH ERROR:", lockError);
        return res.status(500).json({
          message: "Faculty lock fetch failed"
        });
      }

      const lockedFacultyBookings = new Set();

      lockedRows.forEach((slot) => {
        if (!slot.faculty) return;

        const facultyList = String(slot.faculty)
          .split("/")
          .map((f) => f.trim())
          .filter(Boolean);

        facultyList.forEach((faculty) => {
          const key = `${faculty}__${slot.day}__${slot.time}`;
          lockedFacultyBookings.add(key);
        });
      });

      let timetable;

      if (department === "MECH") {
        const { generateMechTimetable } = require("../services/mechSlotEngine");
        timetable = generateMechTimetable(subjects, lockedFacultyBookings);
      } else if (
        department === "COMP" ||
        department === "COMP 1" ||
        department === "COMP 2"
      ) {
        const { generateCompTimetable } = require("../services/compSlotEngine");
        timetable = generateCompTimetable(
          subjects,
          Number(year),
          lockedFacultyBookings
        );
      } else {
        timetable = generateTimetable(
          subjects,
          Number(year) === 4 ? generateFourthYearSlots() : generateEmptySlots(),
          { lockedFacultyBookings }
        );
      }

      if (!timetable) {
        return res.status(400).json({
          message: "Could not generate a timetable with the current constraints"
        });
      }

      const rowsToInsert = timetable
        .filter(
          (slot) =>
            slot.subject &&
            slot.subject !== "BREAK" &&
            slot.subject !== "LUNCH"
        )
        .map((slot) => [
          department,
          year,
          semester,
          slot.day,
          slot.time,
          slot.subject,
          slot.faculty || null
        ]);

      if (!rowsToInsert.length) {
        return res.status(400).json({
          message: "Generated timetable has no valid slots to insert"
        });
      }

      db.query(
        "DELETE FROM timetable_slots WHERE department = ? AND year = ? AND semester = ?",
        [department, year, semester],
        (deleteError) => {
          if (deleteError) {
            console.error("DELETE TIMETABLE ERROR:", deleteError);
            return res.status(500).json({
              message: "Failed to replace old timetable"
            });
          }

          db.query(
            `
            INSERT INTO timetable_slots
            (department, year, semester, day, time, subject, faculty)
            VALUES ?
            `,
            [rowsToInsert],
            (insertError, result) => {
              if (insertError) {
                console.error("INSERT TIMETABLE ERROR:", insertError);
                return res.status(500).json({ message: "Insert failed" });
              }

              res.json({
                success: true,
                inserted: result.affectedRows
              });
            }
          );
        }
      );
    });
  });
};

const getTimetableController = (req, res) => {
  const { year, semester } = req.query;
  const department = normalizeDepartment(req.query.department);

  if (!year || !semester) {
    return res.status(400).json({ message: "year & semester required" });
  }

  const sql = `
    SELECT day, time, subject, faculty
    FROM timetable_slots
    WHERE department = ? AND year = ? AND semester = ?
    ORDER BY FIELD(day,'MON','TUE','WED','THU','FRI','SAT'), time
  `;

  db.query(sql, [department, year, semester], (err, rows) => {
    if (err) {
      console.error("FETCH TIMETABLE ERROR:", err);
      return res.status(500).json({ message: "Fetch failed" });
    }

    res.json({ success: true, slots: rows });
  });
};

module.exports = {
  uploadSubjectsController,
  getSubjectsController,
  generateTimetableController,
  getTimetableController
};