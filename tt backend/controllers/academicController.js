const db = require("../config/db");
const XLSX = require("xlsx");

const {
  generateEmptySlots,
  generateFourthYearSlots,
  generateTimetable
} = require("../services/slotEngine");

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
    "COMP 2",
    "SCIENCE_HUMANITIES"
  ];

  if (!allowedDepartments.includes(dept)) {
    return "ECS";
  }

  return dept;
}

function getValue(row, possibleKeys) {
  for (const key of possibleKeys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
      return row[key];
    }
  }
  return null;
}

function normalizeUploadRows(rows, selectedDepartment, selectedYear, selectedSemester) {
  const values = [];

  for (const row of rows) {
    const department = selectedDepartment;
    const year = Number(selectedYear);
    const semester = Number(selectedSemester);

    const subject = getValue(row, [
      "subject",
      "Subject",
      "SUBJECT",
      "name",
      "Name",
      "COURSE",
      "Course",
      "course",
      "Subject Name",
      "subject_name"
    ]);

    const hours = getValue(row, [
      "hours",
      "Hours",
      "HOURS",
      "hours_per_week",
      "Hours Per Week",
      "hoursPerWeek",
      "Hrs",
      "hrs"
    ]);

    const type = getValue(row, [
      "type",
      "Type",
      "TYPE",
      "Subject Type",
      "subject_type"
    ]);

    const faculty = getValue(row, [
      "faculty",
      "Faculty",
      "FACULTY",
      "teacher",
      "Teacher",
      "Faculty Name"
    ]);

    if (subject && hours && type) {
      values.push([
        department,
        year,
        semester,
        subject,
        Number(hours),
        type,
        faculty || null
      ]);
      continue;
    }

    const course = getValue(row, [
      "course",
      "Course",
      "COURSE",
      "subject",
      "Subject",
      "SUBJECT"
    ]);

    if (!course) continue;

    const theory =
      Number(getValue(row, ["theory", "Theory", "THEORY"])) || 0;

    const practical =
      Number(
        getValue(row, [
          "practical",
          "Practical",
          "PRACTICAL",
          "lab",
          "Lab",
          "LAB"
        ])
      ) || 0;

    const tutorial =
      Number(getValue(row, ["tutorial", "Tutorial", "TUTORIAL"])) || 0;

    const derivedEntries = [
      { name: course, hours: theory, type: "THEORY" },
      { name: `${course} Lab`, hours: practical, type: "LAB" },
      { name: `${course} Tutorial`, hours: tutorial, type: "TUTORIAL" }
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
        faculty || null
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

    const uploadDepartment = normalizeDepartment(req.body.department);
    const uploadYear = Number(req.body.year);
    const uploadSemester = Number(req.body.semester);

    if (!uploadDepartment || !uploadYear || !uploadSemester) {
      return res.status(400).json({
        message: "Department, year and semester are required"
      });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    if (!rows.length) {
      return res.status(400).json({ message: "Excel file empty" });
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

    const sql = `
      INSERT INTO subjects
      (department, year, semester, name, hours_per_week, type, faculty)
      VALUES ?
    `;

    db.query(
      "DELETE FROM subjects WHERE department = ? AND year = ? AND semester = ?",
      [uploadDepartment, uploadYear, uploadSemester],
      (deleteError) => {
        if (deleteError) {
          console.error("DELETE ERROR:", deleteError);
          return res.status(500).json({
            message: "Failed to replace old subjects"
          });
        }

        db.query(sql, [values], (insertError, result) => {
          if (insertError) {
            console.error("INSERT ERROR:", insertError);
            return res.status(500).json({ message: "Insert failed" });
          }

          res.json({
            success: true,
            uploaded: result.affectedRows
          });
        });
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
        timetable = generateMechTimetable(subjects, lockedFacultyBookings);
      } else if (department === "COMP 1" || department === "COMP 2") {
        timetable = generateCompTimetable(subjects, year, lockedFacultyBookings);
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

      const clashMap = new Map();
      const clashes = [];

      for (const row of rowsToInsert) {
        const [, , , day, time, subject, faculty] = row;

        if (!faculty) continue;

        const facultyList = String(faculty)
          .split("/")
          .map((f) => f.trim())
          .filter(Boolean);

        for (const singleFaculty of facultyList) {
          const key = `${singleFaculty}_${day}_${time}`;

          if (clashMap.has(key)) {
            clashes.push({
              faculty: singleFaculty,
              day,
              time,
              firstSubject: clashMap.get(key),
              secondSubject: subject
            });
          } else {
            clashMap.set(key, subject);
          }
        }
      }

      if (clashes.length > 0) {
        return res.status(400).json({
          message: "Teacher clash detected",
          clashes
        });
      }

      db.query(
        "DELETE FROM timetable_slots WHERE department = ? AND year = ? AND semester = ?",
        [department, year, semester],
        (deleteError) => {
          if (deleteError) {
            console.error("DELETE ERROR:", deleteError);
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
                console.error("INSERT ERROR:", insertError);
                return res.status(500).json({ message: "Insert failed" });
              }

              res.json({ success: true, inserted: result.affectedRows });
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
    WHERE faculty LIKE ?
    ORDER BY FIELD(day,'MON','TUE','WED','THU','FRI','SAT'), time
  `;

  db.query(sql, [`%${faculty}%`], (err, rows) => {
    if (err) {
      console.error("TEACHER TIMETABLE ERROR:", err);
      return res.status(500).json({
        message: "Teacher timetable fetch failed"
      });
    }

    res.json({
      success: true,
      faculty,
      slots: rows
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