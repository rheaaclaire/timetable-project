const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT"];

const MORNING_SLOTS = [
  "09:00-10:00",
  "10:00-11:00",
  "11:15-12:15",
  "12:15-13:15"
];

const AFTERNOON_SLOTS = [
  "14:00-15:00",
  "15:00-16:00",
  "16:00-17:00"
];

// ---------- HELPERS ----------

function getFacultyList(faculty) {
  return String(faculty || "")
    .split("/")
    .map((f) => f.trim())
    .filter(Boolean);
}

function hasFacultyClash(subject, day, time, lockedFacultyBookings) {
  const facultyList = getFacultyList(subject.faculty);

  return facultyList.some((faculty) => {
    const key = `${faculty}__${day}__${time}`;
    return lockedFacultyBookings.has(key);
  });
}

function lockFaculty(subject, day, time, lockedFacultyBookings) {
  const facultyList = getFacultyList(subject.faculty);

  facultyList.forEach((faculty) => {
    const key = `${faculty}__${day}__${time}`;
    lockedFacultyBookings.add(key);
  });
}

function isMajorMinor(subjectName) {
  const name = subjectName.toUpperCase();
  return (
    name.includes("MAJOR") ||
    name.includes("MINOR") ||
    name.includes("HONOR") ||
    name.includes("HONOUR")
  );
}

// ---------- MAIN FUNCTION ----------

function generateCompTimetable(subjects, year, lockedFacultyBookings) {
  const timetable = [];

  const grid = {};
  DAYS.forEach((day) => {
    grid[day] = {};
  });

  // -------- SPLIT SUBJECTS --------

  const theorySubjects = [];
  const labSubjects = [];
  const majorMinorSubjects = [];

  subjects.forEach((sub) => {
    if (isMajorMinor(sub.name)) {
      majorMinorSubjects.push({ ...sub });
    } else if (sub.type === "LAB") {
      labSubjects.push({ ...sub });
    } else {
      theorySubjects.push({ ...sub });
    }
  });

  // -------- PLACE THEORY (MORNING ONLY) --------

  theorySubjects.forEach((subject) => {
    let hours = subject.hoursPerWeek;

    for (let day of DAYS) {
      for (let time of MORNING_SLOTS) {
        if (hours <= 0) break;

        if (grid[day][time]) continue;

        if (hasFacultyClash(subject, day, time, lockedFacultyBookings)) continue;

        grid[day][time] = subject.name;

        lockFaculty(subject, day, time, lockedFacultyBookings);

        timetable.push({
          day,
          time,
          subject: subject.name,
          faculty: subject.faculty
        });

        hours--;
      }
    }
  });

  // -------- PLACE LABS (AFTERNOON 2-HOUR BLOCK) --------

  labSubjects.forEach((subject) => {
    let placed = false;

    for (let day of DAYS) {
      for (let i = 0; i < AFTERNOON_SLOTS.length - 1; i++) {
        const t1 = AFTERNOON_SLOTS[i];
        const t2 = AFTERNOON_SLOTS[i + 1];

        if (grid[day][t1] || grid[day][t2]) continue;

        if (
          hasFacultyClash(subject, day, t1, lockedFacultyBookings) ||
          hasFacultyClash(subject, day, t2, lockedFacultyBookings)
        ) continue;

        grid[day][t1] = subject.name;
        grid[day][t2] = subject.name;

        lockFaculty(subject, day, t1, lockedFacultyBookings);
        lockFaculty(subject, day, t2, lockedFacultyBookings);

        timetable.push(
          { day, time: t1, subject: subject.name, faculty: subject.faculty },
          { day, time: t2, subject: subject.name, faculty: subject.faculty }
        );

        placed = true;
        break;
      }
      if (placed) break;
    }
  });

  // -------- PLACE MAJOR/MINOR (AFTERNOON 2-HOUR BLOCK) --------

  majorMinorSubjects.forEach((subject) => {
    let placed = false;

    for (let day of DAYS) {
      for (let i = 0; i < AFTERNOON_SLOTS.length - 1; i++) {
        const t1 = AFTERNOON_SLOTS[i];
        const t2 = AFTERNOON_SLOTS[i + 1];

        if (grid[day][t1] || grid[day][t2]) continue;

        if (
          hasFacultyClash(subject, day, t1, lockedFacultyBookings) ||
          hasFacultyClash(subject, day, t2, lockedFacultyBookings)
        ) continue;

        grid[day][t1] = subject.name;
        grid[day][t2] = subject.name;

        lockFaculty(subject, day, t1, lockedFacultyBookings);
        lockFaculty(subject, day, t2, lockedFacultyBookings);

        timetable.push(
          { day, time: t1, subject: subject.name, faculty: subject.faculty },
          { day, time: t2, subject: subject.name, faculty: subject.faculty }
        );

        placed = true;
        break;
      }
      if (placed) break;
    }
  });

  return timetable;
}

module.exports = { generateCompTimetable };