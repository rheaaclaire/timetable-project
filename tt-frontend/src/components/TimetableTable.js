import React from "react";

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
  "16:00-17:00",
];

const FOURTH_YEAR_TIMES = [
  "09:00-10:00",
  "10:00-11:00",
  "11:00-12:00",
  "12:00-13:00",
  "13:00-14:00",
  "14:00-15:00",
  "15:00-16:00",
  "16:00-17:00",
];

function TimetableTable({
  slots,
  year,
  semester,
  swapMode = false,
  selectedSlots = [],
  onCellSelect,
}) {
  const data = Array.isArray(slots)
    ? slots
    : Array.isArray(slots?.timetable)
    ? slots.timetable
    : [];

  const usesSingleLunchBreak = Number(semester) <= 2 || Number(year) === 4;
  const times = usesSingleLunchBreak ? FOURTH_YEAR_TIMES : REGULAR_TIMES;

  const getCell = (day, time) => {
    return data.find((s) => s.day === day && s.time === time);
  };

  const isSelected = (day, time) => {
    return selectedSlots.some(
      (slot) => slot.day === day && slot.time === time
    );
  };

  const getFacultyInitials = (faculty) => {
    if (!faculty) return "";

    return String(faculty)
      .split(/\/|,|&/)
      .map((name) =>
        name
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .map((word) => word[0]?.toUpperCase())
          .join("")
      )
      .filter(Boolean)
      .join(" / ");
  };

  const parseBatchLab = (subject = "", faculty = "") => {
    const subjectParts = String(subject)
      .split(/(?=B[123]-)/)
      .map((item) => item.trim())
      .filter(Boolean);

    const facultyParts = String(faculty)
      .split(/(?=B[123]-)/)
      .map((item) => item.trim())
      .filter(Boolean);

    if (subjectParts.length < 2) {
      return null;
    }

    return subjectParts.map((part, index) => {
      const batch = part.match(/^B[123]/)?.[0] || `B${index + 1}`;
      const subjectName = part.replace(/^B[123]-/, "").trim();

      const matchingFaculty = facultyParts.find((f) =>
        f.startsWith(batch)
      );

      const facultyName = matchingFaculty
        ? matchingFaculty.replace(/^B[123]-/, "").trim()
        : "";

      return {
        batch,
        subjectName,
        facultyName,
      };
    });
  };

  const renderCellContent = (cell) => {
  const batchLabs = parseBatchLab(
    cell.subject,
    cell.faculty
  );

  if (batchLabs) {
    const uniqueSubjects = [
      ...new Set(
        batchLabs.map((lab) => lab.subjectName)
      ),
    ];

    const uniqueFaculty = [
      ...new Set(
        batchLabs
          .map((lab) => lab.facultyName)
          .filter(Boolean)
      ),
    ];

    return (
      <div className="tt-cell">
        <div className="slot-subject">
          {uniqueSubjects.join(" / ")}
        </div>

        <div className="slot-batch">
  {(() => {
    const grouped = {};

    batchLabs.forEach((lab) => {
      if (!grouped[lab.subjectName]) {
        grouped[lab.subjectName] = [];
      }

      grouped[lab.subjectName].push(lab.batch);
    });

    return Object.values(grouped).map(
      (batches, index) => (
        <div key={index}>
          {batches.join(" & ")}
        </div>
      )
    );
  })()}
</div>

        <div className="slot-faculty">
          {uniqueFaculty.map((faculty, index) => (
            <div key={index}>{faculty}</div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="tt-cell">
      <div className="slot-subject">
        {cell.subject}
      </div>

      <div className="slot-faculty">
        {cell.faculty || "Faculty TBA"}
      </div>
    </div>
  );
};

  return (
    <div className="timetable-wrap">
      <table className="timetable-table">
        <thead>
          <tr>
            <th>Day / Time</th>
            {times.map((t) => (
              <th key={t}>{t}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {DAYS.map((day) => (
            <tr key={day}>
              <td className="day-label">{day}</td>

              {times.map((time) => {
                const cell = getCell(day, time);

                if (usesSingleLunchBreak && time === "12:00-13:00") {
                  return (
                    <td key={time} className="slot slot-lunch">
                      <span>Lunch</span>
                    </td>
                  );
                }

                if (!cell || !cell.subject) {
                  return (
                    <td key={time} className="slot slot-empty"></td>
                  );
                }

                if (cell.type === "BREAK") {
                  return (
                    <td key={time} className="slot slot-break">
                      <span>Tea Break</span>
                    </td>
                  );
                }

                if (cell.type === "LUNCH") {
                  return (
                    <td key={time} className="slot slot-lunch">
                      <span>Lunch</span>
                    </td>
                  );
                }

                return (
                  <td
                    key={time}
                    className={`slot slot-class ${
                      isSelected(day, time) ? "slot-selected" : ""
                    } ${swapMode ? "slot-clickable" : ""}`}
                    onClick={() =>
                      swapMode &&
                      onCellSelect?.({
                        day,
                        time,
                        subject: cell.subject,
                        faculty: cell.faculty,
                      })
                    }
                  >
                    {renderCellContent(cell)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default TimetableTable;