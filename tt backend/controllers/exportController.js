const db = require("../config/db");
const XLSX = require("xlsx");

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT"];

const REGULAR_TIMES = [
  "09:00-10:00",
  "10:00-11:00",
  "11:00-11:15",
  "11:15-12:15",
  "12:15-13:15",
  "13:15-14:00",
  "14:00-15:00",
  "15:00-16:00",
  "16:00-17:00"
];

const FOURTH_YEAR_TIMES = [
  "09:00-10:00",
  "10:00-11:00",
  "11:00-12:00",
  "12:00-13:00",
  "13:00-14:00",
  "14:00-15:00",
  "15:00-16:00",
  "16:00-17:00"
];

function normalizeDepartment(value) {
  const rawValue = String(value || "ECS").trim().toUpperCase();
  const compactValue = rawValue.replace(/[\s&/-]+/g, "_");

  if (
    compactValue === "SCIENCE_HUMANITIES" ||
    compactValue === "SCIENCE_AND_HUMANITIES"
  ) {
    return "SCIENCE_HUMANITIES";
  }

  return compactValue || "ECS";
}

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

function cellText(slot) {
  if (!slot || !slot.subject) return "";

  if (slot.subject === "BREAK") return "Tea Break";
  if (slot.subject === "LUNCH") return "Lunch";

  return slot.faculty ? `${slot.subject}\n${slot.faculty}` : slot.subject;
}

exports.exportTimetableController = async (req, res) => {
  try {
    const department = normalizeDepartment(req.query.department);
    const year = Number(req.query.year);
    const semester = Number(req.query.semester);

    if (!year || !semester) {
      return res.status(400).json({
        message: "department, year and semester are required"
      });
    }

    const rows = await query(
      `
      SELECT day, time, subject, faculty
      FROM timetable_slots
      WHERE department = ? AND year = ? AND semester = ?
      ORDER BY FIELD(day,'MON','TUE','WED','THU','FRI','SAT'), time
      `,
      [department, year, semester]
    );

    if (!rows.length) {
      return res.status(404).json({
        message: "No timetable found"
      });
    }

    const usesSingleLunchBreak = semester <= 2 || year === 4;
    const times = usesSingleLunchBreak ? FOURTH_YEAR_TIMES : REGULAR_TIMES;

    const grid = [
      [`${department} Timetable`],
      [`Year ${year}, Semester ${semester}`],
      [],
      ["Day / Time", ...times]
    ];

    DAYS.forEach((day) => {
      grid.push([
        day,
        ...times.map((time) => {
          const slot = rows.find((row) => row.day === day && row.time === time);

          if (usesSingleLunchBreak && time === "12:00-13:00") {
            return "Lunch";
          }

          return cellText(slot);
        })
      ]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(grid);

    worksheet["!cols"] = [
      { wch: 14 },
      ...times.map(() => ({ wch: 26 }))
    ];

    worksheet["!merges"] = [
      {
        s: { r: 0, c: 0 },
        e: { r: 0, c: times.length }
      },
      {
        s: { r: 1, c: 0 },
        e: { r: 1, c: times.length }
      }
    ];

    Object.keys(worksheet).forEach((key) => {
      if (key.startsWith("!")) return;

      worksheet[key].s = {
        alignment: {
          wrapText: true,
          vertical: "top"
        }
      };
    });

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
  } catch (err) {
    console.error("EXPORT ERROR:", err);
    res.status(500).json({
      message: "Export failed"
    });
  }
};