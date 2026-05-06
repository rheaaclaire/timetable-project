const ExcelJS = require("exceljs");
const db = require("../config/db");

exports.exportTimetable = async (req, res) => {
  try {
    const { department, year, semester } = req.query;

    const query = `
      SELECT day, time, subject, faculty
      FROM timetable_slots
      WHERE department = ? AND year = ? AND semester = ?
      ORDER BY 
        FIELD(day, 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'),
        time
    `;

    db.query(query, [department, year, semester], async (err, rows) => {
      if (err) {
        return res.status(500).json({ message: "Database error", error: err });
      }

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Timetable");

      const days = ["MON", "TUE", "WED", "THU", "FRI", "SAT"];

      const periods = [
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

      const breakSlots = ["11:00-11:15"];
      const lunchSlots = ["13:15-14:00"];

      // column widths
      sheet.getColumn(1).width = 14;
      for (let i = 2; i <= periods.length + 1; i++) {
        sheet.getColumn(i).width = 22;
      }

      // title section
      sheet.mergeCells("A1:J1");
      sheet.getCell("A1").value = "DON BOSCO COLLEGE OF ENGINEERING, FATORDA, MARGAO, GOA";
      sheet.getCell("A1").font = { bold: true, size: 14 };
      sheet.getCell("A1").alignment = { horizontal: "center" };

      sheet.mergeCells("A2:J2");
      sheet.getCell("A2").value = "TIME-TABLE FOR ACADEMIC YEAR 2025-2026";
      sheet.getCell("A2").font = { bold: true, size: 12 };
      sheet.getCell("A2").alignment = { horizontal: "center" };

      sheet.mergeCells("A3:J3");
      sheet.getCell("A3").value = `${department} - Year ${year}, Semester ${semester}`;
      sheet.getCell("A3").font = { bold: true, size: 12 };
      sheet.getCell("A3").alignment = { horizontal: "center" };

      // header row
      const headerRow = 5;
      sheet.getCell(headerRow, 1).value = "DAY / TIME";

      periods.forEach((time, index) => {
        sheet.getCell(headerRow, index + 2).value = time;
      });

      // timetable grid
      days.forEach((day, dayIndex) => {
        const rowNumber = headerRow + 1 + dayIndex;
        sheet.getCell(rowNumber, 1).value = day;

        periods.forEach((time, periodIndex) => {
          const cell = sheet.getCell(rowNumber, periodIndex + 2);

          if (breakSlots.includes(time)) {
            cell.value = "BREAK";
          } else if (lunchSlots.includes(time)) {
            cell.value = "LUNCH BREAK";
          } else {
            const slot = rows.find(
              (r) => r.day === day && r.time === time
            );

            if (slot) {
              cell.value = `${slot.subject || ""}\n${slot.faculty || ""}`;
            } else {
              cell.value = "";
            }
          }

          cell.alignment = {
            horizontal: "center",
            vertical: "middle",
            wrapText: true
          };
        });
      });

      // styling timetable area
      for (let r = 1; r <= 11; r++) {
        for (let c = 1; c <= 10; c++) {
          const cell = sheet.getCell(r, c);
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" }
          };
          cell.alignment = {
            horizontal: "center",
            vertical: "middle",
            wrapText: true
          };
        }
      }

      sheet.getRow(headerRow).font = { bold: true };
      sheet.getRow(headerRow).height = 28;

      for (let r = 6; r <= 11; r++) {
        sheet.getRow(r).height = 55;
        sheet.getCell(r, 1).font = { bold: true };
      }

      // subject/faculty summary table
      const summaryStart = 14;

      sheet.mergeCells(`A${summaryStart}:J${summaryStart}`);
      sheet.getCell(`A${summaryStart}`).value = "SUBJECT / FACULTY DETAILS";
      sheet.getCell(`A${summaryStart}`).font = { bold: true };
      sheet.getCell(`A${summaryStart}`).alignment = { horizontal: "center" };

      sheet.getCell(summaryStart + 1, 1).value = "Sr. No.";
      sheet.getCell(summaryStart + 1, 2).value = "Subject";
      sheet.getCell(summaryStart + 1, 6).value = "Faculty";

      sheet.mergeCells(summaryStart + 1, 2, summaryStart + 1, 5);
      sheet.mergeCells(summaryStart + 1, 6, summaryStart + 1, 10);

      const uniqueSubjects = [];
      rows.forEach((row) => {
        if (
          row.subject &&
          row.subject !== "BREAK" &&
          row.subject !== "LUNCH" &&
          !uniqueSubjects.some((s) => s.subject === row.subject)
        ) {
          uniqueSubjects.push({
            subject: row.subject,
            faculty: row.faculty
          });
        }
      });

      uniqueSubjects.forEach((item, index) => {
        const r = summaryStart + 2 + index;

        sheet.getCell(r, 1).value = index + 1;
        sheet.getCell(r, 2).value = item.subject;
        sheet.getCell(r, 6).value = item.faculty || "";

        sheet.mergeCells(r, 2, r, 5);
        sheet.mergeCells(r, 6, r, 10);
      });

      const lastRow = summaryStart + 2 + uniqueSubjects.length;

      for (let r = summaryStart; r <= lastRow; r++) {
        for (let c = 1; c <= 10; c++) {
          const cell = sheet.getCell(r, c);
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" }
          };
          cell.alignment = {
            horizontal: "center",
            vertical: "middle",
            wrapText: true
          };
        }
      }

      sheet.getRow(summaryStart + 1).font = { bold: true };

      // signature area
      const signRow = lastRow + 4;

      sheet.mergeCells(`A${signRow}:C${signRow}`);
      sheet.getCell(`A${signRow}`).value = "Time Table Incharge";

      sheet.mergeCells(`D${signRow}:G${signRow}`);
      sheet.getCell(`D${signRow}`).value = "Head of Department";

      sheet.mergeCells(`H${signRow}:J${signRow}`);
      sheet.getCell(`H${signRow}`).value = "Principal";

      for (let c = 1; c <= 10; c++) {
        sheet.getCell(signRow, c).alignment = {
          horizontal: "center",
          vertical: "middle"
        };
        sheet.getCell(signRow, c).font = { bold: true };
      }

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename=${department}_Y${year}_S${semester}_Timetable.xlsx`
      );

      await workbook.xlsx.write(res);
      res.end();
    });
  } catch (error) {
    res.status(500).json({
      message: "Export failed",
      error: error.message
    });
  }
};