const db = require("../config/db");
const XLSX = require("xlsx");
const {
  generateEmptySlots,
  generateFourthYearSlots,
  generateTimetable,
  normalizeFacultyName,
  splitLabHours
} = require("../services/slotEngine");

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
  const rawValue = String(value || "ECS").trim().toUpperCase();
  const compactValue = rawValue.replace(/[\s&/-]+/g, "_");

  if (
    compactValue === "SCIENCE_HUMANITIES" ||
    compactValue === "SCIENCE_AND_HUMANITIES"
  ) {
    return "SCIENCE_HUMANITIES";
  }

  return compactValue;
}

function normalizeSemesterValue(value) {
  const rawValue = String(value || "").trim().toUpperCase();

  const romanMap = {
    I: 1,
    II: 2,
    III: 3,
    IV: 4,
    V: 5,
    VI: 6,
    VII: 7,
    VIII: 8
  };

  if (romanMap[rawValue]) {
    return romanMap[rawValue];
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function isDbAccessError(err) {
  return err && err.code === "ER_ACCESS_DENIED_ERROR";
}

function dbErrorMessage(err, fallback) {
  if (isDbAccessError(err)) {
    return "Database login failed. Check tt backend/.env DB_USER and DB_PASSWORD.";
  }

  return fallback;
}

function inferYearFromSemester(semester) {
  const numericSemester = normalizeSemesterValue(semester);
  if (!numericSemester) return null;
  return Math.ceil(numericSemester / 2);
}

function normalizeRowKeys(row) {
  return Object.entries(row).reduce((result, [key, value]) => {
    const normalizedKey = String(key || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");

    if (normalizedKey) {
      result[normalizedKey] = value;
    }

    return result;
  }, {});
}

function getCellValue(row, aliases) {
  for (const alias of aliases) {
    const normalizedAlias = alias.replace(/[^a-z0-9]+/gi, "").toLowerCase();

    if (Object.prototype.hasOwnProperty.call(row, normalizedAlias)) {
      return row[normalizedAlias];
    }
  }

  return null;
}

function normalizeSubjectTypeForStorage(type, subject) {
  const typeValue = String(type || "").trim().toUpperCase();
  const subjectValue = String(subject || "").trim().toUpperCase();

  if (typeValue.includes("PROJECT") || subjectValue.includes("PROJECT")) {
    return "PROJECT";
  }

  if (
    typeValue.includes("LAB") ||
    typeValue.includes("PRACTICAL") ||
    typeValue.includes("WORKSHOP") ||
    subjectValue.includes("LAB")
  ) {
    return "LAB";
  }

  if (
    typeValue.includes("TUTORIAL") ||
    subjectValue.includes("TUTORIAL")
  ) {
    return "TUTORIAL";
  }

  return "THEORY";
}

function isLabLikeType(type) {
  const typeValue = String(type || "").trim().toUpperCase();

  return (
    typeValue.includes("LAB") ||
    typeValue.includes("PRACTICAL") ||
    typeValue.includes("WORKSHOP")
  );
}

function getTimetableHoursForUpload(row, type, fallbackHours) {
  const batchDuration = Number(
    getCellValue(row, [
      "batch_duration",
      "batchduration",
      "durationperbatch",
      "batchhours",
      "hoursperbatch"
    ])
  );

  if (
    isLabLikeType(type) &&
    Number.isFinite(batchDuration) &&
    batchDuration > 0
  ) {
    return batchDuration;
  }

  return fallbackHours;
}

function hasRowsMissingHours(rows) {
  return rows.some((row) => {
    const normalizedRow = normalizeRowKeys(row);

    const subject = getCellValue(normalizedRow, [
      "subject",
      "subjects",
      "course",
      "coursetitle",
      "name"
    ]);

    const type = normalizeSubjectTypeForStorage(
      getCellValue(normalizedRow, ["type", "subjecttype"]),
      subject
    );

    const hours = getCellValue(normalizedRow, [
      "hours",
      "hrs",
      "hoursperweek",
      "weeklyhours",
      "theory",
      "lecture",
      "lectures",
      "l",
      "practical",
      "lab",
      "practicals",
      "p",
      "tutorial",
      "tutorials",
      "t"
    ]);

    return subject && type && (hours === null || hours === "");
  });
}

function estimateLabBlockCount(subjects) {
  return subjects.reduce((count, subject) => {
    const type = String(subject.type || "").toUpperCase();
    const name = String(subject.name || "").toUpperCase();

    const isLab =
      type.includes("LAB") ||
      type.includes("PRACTICAL") ||
      type.includes("WORKSHOP") ||
      name.includes("LAB") ||
      name.includes("WORKSHOP");

    if (!isLab) {
      return count;
    }

    const segments = splitLabHours(Number(subject.hoursPerWeek) || 0);
    return count + (segments ? segments.length : 0);
  }, 0);
}

function isPlaceholderFaculty(name) {
  const value = String(name || "").trim().toLowerCase();

  return (
    !value ||
    value === "none" ||
    value === "-" ||
    value === "tba" ||
    value === "faculty tba" ||
    value === "elective faculty" ||
    value === "open elective faculty" ||
    value === "honor faculty" ||
    value === "honors faculty" ||
    value === "major/minor faculty"
  );
}

function splitFacultyNames(faculty) {
  if (isPlaceholderFaculty(faculty)) {
    return [];
  }

  return String(faculty || "")
    .split(/\s*(?:\/|,|&|\band\b)\s*/i)
    .map((name) => name.trim())
    .filter((name) => !isPlaceholderFaculty(name))
    .filter(Boolean);
}

function buildClashScopeWhere(department, semester) {
  const numericSemester = Number(semester);

  if (numericSemester <= 2) {
    return {
      where: "1 = 1",
      params: []
    };
  }

  return {
    where: "(department = ? OR semester IN (1, 2))",
    params: [department]
  };
}

async function getLockedFacultyBookings(department, year, semester) {
  const scope = buildClashScopeWhere(department, semester);

  const lockSql = `
    SELECT faculty, day, time
    FROM timetable_slots
    WHERE faculty IS NOT NULL
      AND faculty <> ''
      AND ${scope.where}
      AND NOT (department = ? AND year = ? AND semester = ?)
  `;

  const lockedRows = await query(lockSql, [
    ...scope.params,
    department,
    year,
    semester
  ]);

  return lockedRows.flatMap((slot) => {
    return splitFacultyNames(slot.faculty).map((faculty) => {
      return `${normalizeFacultyName(faculty)}__${slot.day}__${slot.time}`;
    });
  });
}

async function findSwapFacultyConflicts(department, year, semester, placements) {
  const scope = buildClashScopeWhere(department, semester);
  const conflicts = [];

  for (const placement of placements) {
    const facultyNames = splitFacultyNames(placement.faculty);
    if (!facultyNames.length) continue;

    const placeholders = facultyNames.map(() => "faculty LIKE ?").join(" OR ");

    const sql = `
      SELECT department, year, semester, subject, faculty, day, time
      FROM timetable_slots
      WHERE ${scope.where}
        AND day = ?
        AND time = ?
        AND (${placeholders})
        AND NOT (department = ? AND year = ? AND semester = ?)
    `;

    const params = [
      ...scope.params,
      placement.day,
      placement.time,
      ...facultyNames.map((faculty) => `%${faculty}%`),
      department,
      year,
      semester
    ];

    const rows = await query(sql, params);
    conflicts.push(...rows);
  }

  return conflicts;
}

function normalizeUploadRows(rows, defaults = {}) {
  const values = [];

  for (const row of rows) {
    const normalizedRow = normalizeRowKeys(row);

    const department = normalizeDepartment(
      getCellValue(normalizedRow, ["department", "dept", "branch"]) ||
        defaults.department
    );

    const semester = normalizeSemesterValue(
      getCellValue(normalizedRow, ["semester", "sem", "semesterno"]) ||
        defaults.semester
    );

    const year =
      Number(
        getCellValue(normalizedRow, ["year", "academicyear", "yearofstudy"]) ||
          defaults.year
      ) || inferYearFromSemester(semester);

    const faculty =
      getCellValue(normalizedRow, [
        "faculty",
        "facultyname",
        "staff",
        "teacher",
        "professor"
      ]) || null;

    const subject = getCellValue(normalizedRow, [
      "subject",
      "subjects",
      "course",
      "coursetitle",
      "name",
      "subjectname"
    ]);

    const hours = Number(
      getCellValue(normalizedRow, [
        "hours",
        "hrs",
        "hoursperweek",
        "weeklyhours"
      ])
    );

    const type = normalizeSubjectTypeForStorage(
      getCellValue(normalizedRow, ["type", "subjecttype"]),
      subject
    );

    const timetableHours = getTimetableHoursForUpload(
      normalizedRow,
      type,
      hours
    );

    if (subject && timetableHours && type) {
      values.push([
        department,
        year,
        semester,
        String(subject).trim(),
        timetableHours,
        type,
        faculty ? String(faculty).trim() : null
      ]);
      continue;
    }

    const courseName = getCellValue(normalizedRow, [
      "course",
      "subject",
      "coursetitle",
      "name"
    ]);

    if (!courseName) continue;

    const derivedEntries = [
      {
        name: courseName,
        hours: Number(
          getCellValue(normalizedRow, ["theory", "lecture", "lectures", "l"])
        ),
        type: "THEORY"
      },
      {
        name: `${courseName} Lab`,
        hours: Number(
          getCellValue(normalizedRow, [
            "practical",
            "lab",
            "practicals",
            "p"
          ])
        ),
        type: "LAB"
      },
      {
        name: `${courseName} Tutorial`,
        hours: Number(
          getCellValue(normalizedRow, ["tutorial", "tutorials", "t"])
        ),
        type: "TUTORIAL"
      }
    ];

    for (const entry of derivedEntries) {
      if (!entry.hours) continue;

      values.push([
        department,
        year,
        semester,
        String(entry.name).trim(),
        entry.hours,
        entry.type,
        faculty ? String(faculty).trim() : null
      ]);
    }
  }

  return values;
}

const uploadSubjectsController = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    if (!req.body.department) {
      return res.status(400).json({ message: "Department is required" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    if (!rows.length) {
      return res.status(400).json({ message: "Excel file empty" });
    }

    const uploadDepartment = normalizeDepartment(req.body.department);
    const uploadSemester = normalizeSemesterValue(req.body.semester);
    const uploadYear =
      Number(req.body.year) || inferYearFromSemester(uploadSemester);

    if (!uploadYear || !uploadSemester) {
      return res.status(400).json({
        message: "Year and semester are required"
      });
    }

    const values = normalizeUploadRows(rows, {
      department: uploadDepartment,
      year: uploadYear,
      semester: uploadSemester
    }).map((row) => [uploadDepartment, uploadYear, uploadSemester, ...row.slice(3)]);

    if (!values.length) {
      if (hasRowsMissingHours(rows)) {
        return res.status(400).json({
          message:
            "Some rows are missing weekly hours. Please fill the hours column before uploading."
        });
      }

      return res.status(400).json({
        message: "Excel columns did not match the expected format"
      });
    }

    await query(
      "DELETE FROM timetable_slots WHERE department = ? AND year = ? AND semester = ?",
      [uploadDepartment, uploadYear, uploadSemester]
    );

    await query(
      "DELETE FROM subjects WHERE department = ? AND year = ? AND semester = ?",
      [uploadDepartment, uploadYear, uploadSemester]
    );

    const result = await query(
      `
      INSERT INTO subjects
      (department, year, semester, name, hours_per_week, type, faculty)
      VALUES ?
      `,
      [values]
    );

    res.json({
      success: true,
      uploaded: result.affectedRows
    });
  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    res.status(500).json({
      message: dbErrorMessage(err, "Upload crashed")
    });
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
      return res.status(500).json({
        message: dbErrorMessage(err, "Fetch failed")
      });
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

  const lockedFacultyBookings = await getLockedFacultyBookings(
    department,
    year,
    semester
  );

  const totalWeeklyHours = subjects.reduce((sum, subject) => {
    return sum + (Number(subject.hoursPerWeek) || 0);
  }, 0);

  const labBlockCount = estimateLabBlockCount(subjects);
  const usesSingleLunchBreak = Number(semester) <= 2 || Number(year) === 4;

  const firstYearLabLoadNeedsSaturday =
    usesSingleLunchBreak &&
    Number(semester) <= 2 &&
    totalWeeklyHours + labBlockCount > 35;

  const includeSaturday =
    totalWeeklyHours >= 35 || labBlockCount > 5 || firstYearLabLoadNeedsSaturday;

  const availableDays = includeSaturday ? 6 : 5;
  const maxLabsPerDay = Math.max(1, Math.ceil(labBlockCount / availableDays));

  const slotGrid = usesSingleLunchBreak
    ? generateFourthYearSlots({ includeSaturday })
    : generateEmptySlots({ includeSaturday });

  const classCapacity = slotGrid.filter((slot) => slot.type === "CLASS").length;

  if (totalWeeklyHours > classCapacity) {
    const error = new Error(
      `Weekly load is ${totalWeeklyHours} hours but this timetable grid has only ${classCapacity} teaching slots. Reduce elective/extra rows or split this semester into a special pattern.`
    );
    error.statusCode = 400;
    throw error;
  }

  const timetable = generateTimetable(subjects, slotGrid, {
    lockedFacultyBookings,
    department,
    year: Number(year),
    semester: Number(semester),
    labsInLaterHalfOnly: Number(semester) <= 2,
    singleBreakSchedule: usesSingleLunchBreak,
    singleLabSessionPerWeek: Number(semester) >= 3,
    allowClassesAfterLab: totalWeeklyHours > 35,
    includeSaturday,
    maxLabsPerDay
  });

  if (!timetable) {
    const error = new Error(
      "Could not generate a timetable with the current constraints"
    );
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

    const timetable = await buildTimetableForSelection(
      department,
      year,
      semester
    );

    const savedSlots = timetable.filter(
      (slot) =>
        slot.subject && slot.subject !== "BREAK" && slot.subject !== "LUNCH"
    );

    res.json({
      success: true,
      inserted: savedSlots.length,
      slots: timetable
    });
  } catch (err) {
    console.error(err);
    res.status(err.statusCode || 500).json({
      message: dbErrorMessage(err, err.message || "Preview failed")
    });
  }
};

const saveTimetableController = async (req, res) => {
  try {
    const { year, semester } = req.body;
    const department = normalizeDepartment(req.body.department);
    const previewSlots = Array.isArray(req.body.slots) ? req.body.slots : null;

    if (!year || !semester) {
      return res.status(400).json({ message: "year & semester required" });
    }

    const timetable =
      previewSlots && previewSlots.length
        ? previewSlots
        : await buildTimetableForSelection(department, year, semester);

    const rowsToInsert = timetable
      .filter(
        (slot) =>
          slot.subject && slot.subject !== "BREAK" && slot.subject !== "LUNCH"
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
      return res.status(400).json({ message: "No timetable slots to save" });
    }

    await query(
      "DELETE FROM timetable_slots WHERE department = ? AND year = ? AND semester = ?",
      [department, year, semester]
    );

    const result = await query(
      `
      INSERT INTO timetable_slots
      (department, year, semester, day, time, subject, faculty)
      VALUES ?
      `,
      [rowsToInsert]
    );

    res.json({ success: true, inserted: result.affectedRows });
  } catch (err) {
    console.error(err);
    res.status(err.statusCode || 500).json({
      message: dbErrorMessage(err, err.message || "Save failed")
    });
  }
};

const generateTimetableController = saveTimetableController;

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
      return res.status(500).json({
        message: dbErrorMessage(err, "Fetch failed")
      });
    }

    res.json({ success: true, slots: rows });
  });
};

const getSavedTimetablesController = async (_req, res) => {
  try {
    const rows = await query(`
      SELECT department, year, semester, COUNT(*) AS slotCount
      FROM timetable_slots
      WHERE subject IS NOT NULL AND subject <> ''
      GROUP BY department, year, semester
      ORDER BY department, year, semester
    `);

    res.json({ success: true, timetables: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: dbErrorMessage(err, "Could not load saved timetables")
    });
  }
};

const getTeacherTimetableController = async (req, res) => {
  try {
    const facultyName = String(req.query.facultyName || "").trim();

    if (!facultyName) {
      return res.status(400).json({ message: "facultyName required" });
    }

    const rows = await query(
      `
      SELECT department, year, semester, day, time, subject, faculty
      FROM timetable_slots
      WHERE faculty LIKE ?
        AND subject IS NOT NULL
        AND subject <> ''
      ORDER BY FIELD(day,'MON','TUE','WED','THU','FRI','SAT'), time, department, year, semester
      `,
      [`%${facultyName}%`]
    );

    const exactRows = rows.filter((row) => {
      return splitFacultyNames(row.faculty).some((faculty) => {
        return faculty.toLowerCase() === facultyName.toLowerCase();
      });
    });

    res.json({ success: true, slots: exactRows });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: dbErrorMessage(err, "Could not load teacher timetable")
    });
  }
};

const swapSlotsController = async (req, res) => {
  try {
    const department = normalizeDepartment(req.body.department);
    const year = Number(req.body.year);
    const semester = Number(req.body.semester);
    const first = req.body.first || {};
    const second = req.body.second || {};

    if (
      !year ||
      !semester ||
      !first.day ||
      !first.time ||
      !second.day ||
      !second.time
    ) {
      return res.status(400).json({
        message: "department, year, semester and two slots are required"
      });
    }

    if (first.day === second.day && first.time === second.time) {
      return res.status(400).json({
        message: "Choose two different slots to swap"
      });
    }

    const rows = await query(
      `
      SELECT id, day, time, subject, faculty
      FROM timetable_slots
      WHERE department = ?
        AND year = ?
        AND semester = ?
        AND ((day = ? AND time = ?) OR (day = ? AND time = ?))
      `,
      [
        department,
        year,
        semester,
        first.day,
        first.time,
        second.day,
        second.time
      ]
    );

    if (rows.length !== 2) {
      return res.status(400).json({
        message: "Both selected cells must contain saved timetable slots"
      });
    }

    const firstRow = rows.find(
      (row) => row.day === first.day && row.time === first.time
    );

    const secondRow = rows.find(
      (row) => row.day === second.day && row.time === second.time
    );

    if (!firstRow || !secondRow) {
      return res.status(400).json({
        message: "Could not match the selected slots"
      });
    }

    const conflicts = await findSwapFacultyConflicts(department, year, semester, [
      { ...firstRow, day: second.day, time: second.time },
      { ...secondRow, day: first.day, time: first.time }
    ]);

    if (conflicts.length) {
      return res.status(409).json({
        message: "Swap blocked because it creates a faculty clash",
        conflicts
      });
    }

    await query(
      `
      UPDATE timetable_slots
      SET day = ?, time = ?
      WHERE id = ?
      `,
      ["__TEMP__", "__TEMP__", firstRow.id]
    );

    await query(
      `
      UPDATE timetable_slots
      SET day = ?, time = ?
      WHERE id = ?
      `,
      [first.day, first.time, secondRow.id]
    );

    await query(
      `
      UPDATE timetable_slots
      SET day = ?, time = ?
      WHERE id = ?
      `,
      [second.day, second.time, firstRow.id]
    );

    res.json({ success: true, message: "Slots swapped" });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: dbErrorMessage(err, "Swap failed")
    });
  }
};

const getFacultyAvailabilityController = async (req, res) => {
  try {
    const department = normalizeDepartment(req.query.department);
    const day = String(req.query.day || "").trim().toUpperCase();
    const time = String(req.query.time || "").trim();
    const semester = req.query.semester ? Number(req.query.semester) : null;

    if (!day || !time) {
      return res.status(400).json({ message: "day & time required" });
    }

    const numericSemester = Number(semester);

    const facultySqlParts = [
      "SELECT DISTINCT faculty",
      "FROM subjects",
      "WHERE faculty IS NOT NULL",
      "AND faculty <> ''"
    ];

    const facultyParams = [];

    if (department !== "SCIENCE_HUMANITIES" && numericSemester > 2) {
      facultySqlParts.push("AND department = ?");
      facultyParams.push(department);
    }

    if (numericSemester > 2) {
      facultySqlParts.push("AND semester BETWEEN 3 AND 8");
    }

    const scope = buildClashScopeWhere(department, numericSemester || semester);

    const busySql = `
      SELECT faculty
      FROM timetable_slots
      WHERE day = ?
        AND time = ?
        AND faculty IS NOT NULL
        AND faculty <> ''
        AND ${scope.where}
    `;

    const [facultyRows, busyRows] = await Promise.all([
      query(facultySqlParts.join(" "), facultyParams),
      query(busySql, [day, time, ...scope.params])
    ]);

    const busyFaculty = new Set(
      busyRows.flatMap((row) =>
        splitFacultyNames(row.faculty).map(normalizeFacultyName)
      )
    );

    const availableFaculty = [
      ...new Set(facultyRows.flatMap((row) => splitFacultyNames(row.faculty)))
    ]
      .filter((faculty) => !busyFaculty.has(normalizeFacultyName(faculty)))
      .sort((left, right) => left.localeCompare(right));

    res.json({ success: true, availableFaculty });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: dbErrorMessage(err, "Faculty availability lookup failed")
    });
  }
};

async function ensureFacultyRequestsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS faculty_requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      requester_name VARCHAR(100) NOT NULL,
      requester_faculty VARCHAR(100) NOT NULL,
      department VARCHAR(40) NOT NULL,
      year INT NULL,
      semester INT NULL,
      day VARCHAR(10) NOT NULL,
      time VARCHAR(20) NOT NULL,
      subject VARCHAR(150) NOT NULL,
      reason TEXT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
      responder_name VARCHAR(100) NULL,
      responder_faculty VARCHAR(100) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
}

const createFacultyRequestController = async (req, res) => {
  try {
    await ensureFacultyRequestsTable();

    const requesterName = String(req.body.requesterName || "").trim();
    const requesterFaculty = String(req.body.requesterFaculty || "").trim();
    const department = normalizeDepartment(req.body.department);
    const year = req.body.year ? Number(req.body.year) : null;
    const semester = req.body.semester ? Number(req.body.semester) : null;
    const day = String(req.body.day || "").trim().toUpperCase();
    const time = String(req.body.time || "").trim();
    const subject = String(req.body.subject || "").trim();
    const reason = String(req.body.reason || "").trim() || null;

    if (!requesterName || !requesterFaculty || !day || !time || !subject) {
      return res.status(400).json({
        message: "requester, day, time and subject are required"
      });
    }

    const result = await query(
      `
      INSERT INTO faculty_requests
      (requester_name, requester_faculty, department, year, semester, day, time, subject, reason)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        requesterName,
        requesterFaculty,
        department,
        year,
        semester,
        day,
        time,
        subject,
        reason
      ]
    );

    res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: dbErrorMessage(err, "Could not send faculty request")
    });
  }
};

const getFacultyRequestsController = async (req, res) => {
  try {
    await ensureFacultyRequestsTable();

    const facultyName = String(req.query.facultyName || "").trim();

    const rows = await query(`
      SELECT id, requester_name AS requesterName, requester_faculty AS requesterFaculty,
             department, year, semester, day, time, subject, reason, status,
             responder_name AS responderName, responder_faculty AS responderFaculty,
             created_at AS createdAt, updated_at AS updatedAt
      FROM faculty_requests
      ORDER BY FIELD(status, 'OPEN', 'ACCEPTED', 'DECLINED'), created_at DESC
    `);

    res.json({
      success: true,
      openRequests: rows.filter((request) => {
        return (
          request.status === "OPEN" &&
          (!facultyName ||
            request.requesterFaculty.toLowerCase() !==
              facultyName.toLowerCase())
        );
      }),
      myRequests: rows.filter((request) => {
        return (
          facultyName &&
          request.requesterFaculty.toLowerCase() === facultyName.toLowerCase()
        );
      }),
      requests: rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: dbErrorMessage(err, "Could not load faculty requests")
    });
  }
};

const acceptFacultyRequestController = async (req, res) => {
  try {
    await ensureFacultyRequestsTable();

    const requestId = Number(req.params.id);
    const responderName = String(req.body.responderName || "").trim();
    const responderFaculty = String(req.body.responderFaculty || "").trim();

    if (!requestId || !responderName || !responderFaculty) {
      return res.status(400).json({
        message: "request id and responder are required"
      });
    }

    const result = await query(
      `
      UPDATE faculty_requests
      SET status = 'ACCEPTED', responder_name = ?, responder_faculty = ?
      WHERE id = ? AND status = 'OPEN'
      `,
      [responderName, responderFaculty, requestId]
    );

    if (!result.affectedRows) {
      return res.status(409).json({
        message: "Request is no longer open"
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: dbErrorMessage(err, "Could not accept request")
    });
  }
};

module.exports = {
  uploadSubjectsController,
  getSubjectsController,
  previewTimetableController,
  saveTimetableController,
  generateTimetableController,
  getTimetableController,
  getSavedTimetablesController,
  getTeacherTimetableController,
  swapSlotsController,
  getFacultyAvailabilityController,
  createFacultyRequestController,
  getFacultyRequestsController,
  acceptFacultyRequestController
};