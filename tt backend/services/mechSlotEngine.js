const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT"];
const PRIMARY_DAYS = ["MON", "TUE", "WED", "THU", "FRI"];
const BACKUP_DAYS = ["SAT"];

const PERIODS = [
  { time: "09:00-10:00", type: "CLASS" },
  { time: "10:00-11:00", type: "CLASS" },
  { time: "11:00-11:15", type: "BREAK" },
  { time: "11:15-12:15", type: "CLASS" },
  { time: "12:15-13:15", type: "CLASS" },
  { time: "13:15-14:00", type: "LUNCH" },
  { time: "14:00-15:00", type: "CLASS" },
  { time: "15:00-16:00", type: "CLASS" },
  { time: "16:00-17:00", type: "CLASS" }
];

function generateMechEmptySlots() {
  const slots = [];

  for (const day of DAYS) {
    for (const period of PERIODS) {
      slots.push({
        day,
        time: period.time,
        type: period.type,
        subject:
          period.type === "BREAK"
            ? "BREAK"
            : period.type === "LUNCH"
            ? "LUNCH"
            : null,
        faculty: null
      });
    }
  }

  return slots;
}

function normalizeType(type, name) {
  const t = String(type || "").toUpperCase();
  const n = String(name || "").toUpperCase();

  if (t.includes("WORKSHOP") || n.includes("WORKSHOP")) return "WORKSHOP";
  if (t.includes("LAB") || t.includes("PRACTICAL") || n.includes("LAB")) return "LAB";
  if (t.includes("TUTORIAL")) return "TUTORIAL";

  return "THEORY";
}

function isMajorMinorSubject(subject) {
  const name = String(subject.name || "").toUpperCase();
  const type = String(subject.type || "").toUpperCase();

  return (
    name.includes("MAJOR") ||
    name.includes("MINOR") ||
    name.includes("HONOR") ||
    name.includes("HONOUR") ||
    name.includes("IOT") ||
    name.includes("INDUSTRY 4.0") ||
    type.includes("MAJOR") ||
    type.includes("MINOR") ||
    type.includes("HONOR") ||
    type.includes("HONOUR")
  );
}

function getClassSlots(slots) {
  return slots.filter((slot) => slot.type === "CLASS");
}

function canPlace(slot, faculty, facultyBookings) {
  if (!slot) return false;
  if (slot.subject) return false;

  if (faculty) {
    const faculties = String(faculty)
      .split("/")
      .map((f) => f.trim())
      .filter(Boolean);

    for (const f of faculties) {
      const key = `${f}__${slot.day}__${slot.time}`;
      if (facultyBookings.has(key)) return false;
    }
  }

  return true;
}

function assignSlot(slot, subject, faculty, facultyBookings) {
  slot.subject = subject;
  slot.faculty = faculty || null;

  if (faculty) {
    const faculties = String(faculty)
      .split("/")
      .map((f) => f.trim())
      .filter(Boolean);

    for (const f of faculties) {
      facultyBookings.add(`${f}__${slot.day}__${slot.time}`);
    }
  }
}

// Labs/workshops must be continuous and cannot start in first two hours.
// Valid blocks:
// 11:15-13:15
// 14:00-16:00
// 15:00-17:00
function findLabBlock(timetable, subject, facultyBookings) {
  const allowedStartTimes = [
    "11:15-12:15",
    "14:00-15:00",
    "15:00-16:00"
  ];

  for (const day of [...PRIMARY_DAYS, ...BACKUP_DAYS]) {
    for (const startTime of allowedStartTimes) {
      const startIndex = timetable.findIndex(
        (slot) =>
          slot.day === day &&
          slot.time === startTime &&
          slot.type === "CLASS"
      );

      if (startIndex === -1) continue;

      const slot1 = timetable[startIndex];
      const slot2 = timetable[startIndex + 1];

      if (!slot2) continue;
      if (slot1.day !== slot2.day) continue;
      if (slot1.type !== "CLASS" || slot2.type !== "CLASS") continue;

      if (
        canPlace(slot1, subject.faculty, facultyBookings) &&
        canPlace(slot2, subject.faculty, facultyBookings)
      ) {
        return [slot1, slot2];
      }
    }
  }

  return null;
}

// Major / Minor / Honors theory should be towards end of day.
function findEndOfDaySlot(timetable, subject, facultyBookings) {
  const endTimes = ["14:00-15:00", "15:00-16:00", "16:00-17:00"];

  for (const day of [...PRIMARY_DAYS, ...BACKUP_DAYS]) {
    for (const time of endTimes) {
      const slot = timetable.find(
        (s) => s.day === day && s.time === time && s.type === "CLASS"
      );

      if (canPlace(slot, subject.faculty, facultyBookings)) {
        return slot;
      }
    }
  }

  return null;
}

function findNormalSlot(timetable, subject, facultyBookings) {
  const preferredDays = ["MON", "TUE", "WED", "THU", "FRI"];
  const backupDays = ["SAT"];

  const preferredTimes = [
    "09:00-10:00",
    "10:00-11:00",
    "11:15-12:15",
    "12:15-13:15",
    "14:00-15:00",
    "15:00-16:00"
  ];

  const saturdayLightTimes = [
    "09:00-10:00",
    "10:00-11:00",
    "11:15-12:15"
  ];

  for (const day of preferredDays) {
    for (const time of preferredTimes) {
      const slot = timetable.find(
        (s) => s.day === day && s.time === time && s.type === "CLASS"
      );

      if (canPlace(slot, subject.faculty, facultyBookings)) {
        return slot;
      }
    }
  }

  // Saturday only as backup, and only morning/light slots
  for (const day of backupDays) {
    for (const time of saturdayLightTimes) {
      const slot = timetable.find(
        (s) => s.day === day && s.time === time && s.type === "CLASS"
      );

      if (canPlace(slot, subject.faculty, facultyBookings)) {
        return slot;
      }
    }
  }

  return null;
}

function generateLabGroups(labSubjects) {
  const labGroups = [];

  for (let i = 0; i < labSubjects.length; i += 3) {
    const group = labSubjects.slice(i, i + 3);

    const subjectName = group.map((s) => s.name).join(" / ");
    const facultyName = group
      .map((s) => s.faculty)
      .filter(Boolean)
      .join(" / ");

    labGroups.push({
      name: `${subjectName}\nBatch A / B / C`,
      faculty: facultyName,
      type: "LAB_GROUP",
      duration: 2,
      isMajorMinor: group.some((s) => isMajorMinorSubject(s))
    });
  }

  return labGroups;
}

function generateMechTimetable(subjects, lockedFacultyBookings = []) {
  const timetable = generateMechEmptySlots();
  const facultyBookings = new Set(lockedFacultyBookings);

  const labSubjects = [];
  const normalSubjects = [];

  for (const subject of subjects) {
    const type = normalizeType(subject.type, subject.name);
    const hours = Number(subject.hoursPerWeek) || 0;

    if (hours <= 0) continue;

    const normalizedSubject = {
      name: subject.name,
      faculty: subject.faculty,
      type,
      hours
    };

    if (type === "LAB" || type === "WORKSHOP") {
      labSubjects.push(normalizedSubject);
    } else {
      normalSubjects.push(normalizedSubject);
    }
  }

  const labGroups = generateLabGroups(labSubjects);
  const expandedSubjects = [];

  for (const labGroup of labGroups) {
    expandedSubjects.push(labGroup);
  }

  for (const subject of normalSubjects) {
    for (let i = 0; i < subject.hours; i++) {
      expandedSubjects.push({
        name: subject.name,
        faculty: subject.faculty,
        type: subject.type,
        duration: 1,
        isMajorMinor: isMajorMinorSubject(subject)
      });
    }
  }

  expandedSubjects.sort((a, b) => {
    const priority = (subject) => {
      if (subject.isMajorMinor || isMajorMinorSubject(subject)) return 1;
      if (subject.type === "LAB_GROUP") return 2;
      if (subject.type === "WORKSHOP") return 3;
      if (subject.type === "LAB") return 4;
      if (subject.type === "TUTORIAL") return 5;
      return 6;
    };

    return priority(a) - priority(b);
  });

  for (const subject of expandedSubjects) {
    let placed = false;

    // Major / Minor / Honors labs also use lab block, but will be placed first.
    if (subject.type === "LAB_GROUP") {
      const block = findLabBlock(timetable, subject, facultyBookings);

      if (!block) {
        console.log("MECH ERROR: Could not place lab group", subject.name);
        return null;
      }

      for (const slot of block) {
        assignSlot(slot, subject.name, subject.faculty, facultyBookings);
      }

      placed = true;
    }

    // Major / Minor / Honors theory toward end of day.
    else if (subject.isMajorMinor || isMajorMinorSubject(subject)) {
      const slot = findEndOfDaySlot(timetable, subject, facultyBookings);

      if (!slot) {
        console.log("MECH ERROR: Could not place major/minor/honors subject", subject.name);
        return null;
      }

      assignSlot(slot, subject.name, subject.faculty, facultyBookings);
      placed = true;
    }

    // Normal theory/tutorial.
    else {
      const slot = findNormalSlot(timetable, subject, facultyBookings);

      if (!slot) {
        console.log("MECH ERROR: Could not place theory/tutorial", subject.name);
        return null;
      }

      assignSlot(slot, subject.name, subject.faculty, facultyBookings);
      placed = true;
    }

    if (!placed) {
      console.log("MECH ERROR: Could not place", subject.name);
      return null;
    }
  }

  return timetable;
}

module.exports = {
  generateMechTimetable
};