const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT"];
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

function getClassSlots(slots) {
  return slots.filter((slot) => slot.type === "CLASS");
}

function canPlace(slot, faculty, timetable, facultyBookings) {
  if (slot.subject) return false;

  if (faculty) {
    const key = `${faculty}__${slot.day}__${slot.time}`;
    if (facultyBookings.has(key)) return false;
  }

  return true;
}

function assignSlot(slot, subject, faculty, facultyBookings) {
  slot.subject = subject;
  slot.faculty = faculty || null;

  if (faculty) {
    facultyBookings.add(`${faculty}__${slot.day}__${slot.time}`);
  }
}

function generateMechTimetable(subjects, lockedFacultyBookings = []) {
  const timetable = generateMechEmptySlots();
  const classSlots = getClassSlots(timetable);
  const facultyBookings = new Set(lockedFacultyBookings);

  const expandedSubjects = [];

  for (const subject of subjects) {
    const type = normalizeType(subject.type, subject.name);
    const hours = Number(subject.hoursPerWeek) || 0;

    if (hours <= 0) continue;

    if (type === "LAB" || type === "WORKSHOP") {
  for (let batch = 1; batch <= 3; batch++) {
    expandedSubjects.push({
      name: `${subject.name} Batch ${batch}`,
      faculty: subject.faculty,
      type,
      duration: 2
    });
  }
} else {
  for (let i = 0; i < hours; i++) {
    expandedSubjects.push({
      name: subject.name,
      faculty: subject.faculty,
      type,
      duration: 1
    });
  }
}
  }

  if (expandedSubjects.length > classSlots.length) {
    console.log("MECH ERROR: Too many hours", expandedSubjects.length, "available", classSlots.length);
    return null;
  }

  // Put practical/workshop first because they are harder to place
  expandedSubjects.sort((a, b) => {
    const priority = {
      WORKSHOP: 1,
      LAB: 2,
      TUTORIAL: 3,
      THEORY: 4
    };

    return priority[a.type] - priority[b.type];
  });

  for (const subject of expandedSubjects) {
    let placed = false;

    for (const slot of classSlots) {
      if (canPlace(slot, subject.faculty, timetable, facultyBookings)) {
        assignSlot(slot, subject.name, subject.faculty, facultyBookings);
        placed = true;
        break;
      }
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