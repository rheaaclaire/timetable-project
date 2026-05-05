const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT"];
const PERIODS = [
  { time: "09:00-10:00", type: "CLASS", classIndex: 0 },
  { time: "10:00-11:00", type: "CLASS", classIndex: 1 },
  { time: "11:00-11:15", type: "BREAK", classIndex: null },
  { time: "11:15-12:15", type: "CLASS", classIndex: 2 },
  { time: "12:15-13:15", type: "CLASS", classIndex: 3 },
  { time: "13:15-14:00", type: "LUNCH", classIndex: null },
  { time: "14:00-15:00", type: "CLASS", classIndex: 4 },
  { time: "15:00-16:00", type: "CLASS", classIndex: 5 },
  { time: "16:00-17:00", type: "CLASS", classIndex: 6 }
];
const FOURTH_YEAR_PROJECT_PERIODS = [
  { time: "09:00-10:00", type: "CLASS", classIndex: 0 },
  { time: "10:00-11:00", type: "CLASS", classIndex: 1 },
  { time: "11:00-12:00", type: "CLASS", classIndex: 2 },
  { time: "12:00-13:00", type: "LUNCH", classIndex: null },
  { time: "13:00-14:00", type: "CLASS", classIndex: 3 },
  { time: "14:00-15:00", type: "CLASS", classIndex: 4 },
  { time: "15:00-16:00", type: "CLASS", classIndex: 5 },
  { time: "16:00-17:00", type: "CLASS", classIndex: 6 }
];
const LAB_START_TIMES_BY_DURATION = {
  2: new Set(["10:00-11:00", "11:15-12:15", "13:00-14:00", "14:00-15:00", "15:00-16:00"]),
  3: new Set(["13:00-14:00", "14:00-15:00"])
};

function generateEmptySlots() {
  const slots = [];

  for (const day of DAYS) {
    for (const period of PERIODS) {
      if (day === "SAT") continue;

      slots.push({
        day,
        time: period.time,
        type: period.type,
        classIndex: period.classIndex,
        subject: period.type === "BREAK" ? "BREAK" : period.type === "LUNCH" ? "LUNCH" : null,
        faculty: null
      });
    }
  }

  return slots;
}

function generateSlotsFromPeriods(periods) {
  const slots = [];

  for (const day of DAYS) {
    for (const period of periods) {
      if (day === "SAT") continue;

      slots.push({
        day,
        time: period.time,
        type: period.type,
        classIndex: period.classIndex,
        subject: period.type === "BREAK" ? "BREAK" : period.type === "LUNCH" ? "LUNCH" : null,
        faculty: null
      });
    }
  }

  return slots;
}

function generateFourthYearSlots() {
  return generateSlotsFromPeriods(FOURTH_YEAR_PROJECT_PERIODS);
}

function normalizeType(type, name) {
  const typeValue = String(type || "").trim().toUpperCase();
  const nameValue = String(name || "").trim().toUpperCase();

  if (typeValue.includes("PROJECT") || nameValue.includes("PROJECT")) return "PROJECT";
  if (typeValue.includes("LAB") || typeValue.includes("PRACTICAL") || nameValue.includes("LAB")) return "LAB";
  if (typeValue.includes("TUTORIAL") || nameValue.includes("TUTORIAL")) return "TUTORIAL";
  if (typeValue.includes("MAJOR") || typeValue.includes("MINOR") || nameValue.includes("MAJOR") || nameValue.includes("MINOR")) return "MAJOR_MINOR";

  return "THEORY";
}

function normalizeSubjects(subjects) {
  return subjects
    .map((subject, index) => {
      const type = normalizeType(subject.type, subject.name);
      const nameValue = String(subject.name || "").toLowerCase();

      return {
        key: `${subject.name}::${subject.faculty || "NA"}::${index}`,
        name: subject.name,
        faculty: subject.faculty || null,
        hoursPerWeek: Number(subject.hoursPerWeek) || 0,
        type,
        isLab: type === "LAB",
        isProject: type === "PROJECT",
        isMajorMinor: Boolean(subject.is_major_minor) || type === "MAJOR_MINOR" || nameValue.includes("major") || nameValue.includes("minor"),
        closesDay: Boolean(subject.closes_day) || nameValue.includes("major") || nameValue.includes("minor")
      };
    })
    .filter((subject) => subject.hoursPerWeek > 0);
}

function buildClassSlotsByDay(slots) {
  return DAYS.reduce((result, day) => {
    result[day] = slots
      .filter((slot) => slot.day === day && slot.type === "CLASS")
      .sort((left, right) => left.classIndex - right.classIndex);
    return result;
  }, {});
}

function createState(options = {}) {
  const facultyBookings = new Set(options.lockedFacultyBookings || []);

  return {
    assignments: new Map(),
    weeklyLabSubjects: new Set(),
    facultyBookings,
    subjectDayCounts: new Map(),
    firstSlotCounts: new Map(),
    dayState: DAYS.reduce((result, day) => {
      result[day] = {
        teachingCount: 0,
        usedClassIndices: new Set(),
        hasLab: false,
        labStartIndex: null,
        labEndIndex: null,
        allowClosingMajorMinorAfterLab: false,
        closingSubjectKey: null,
        closingIsMajorMinor: false,
        closingStartIndex: null
      };
      return result;
    }, {})
  };
}

function getSubjectCountForDay(state, subjectKey, day) {
  return state.subjectDayCounts.get(subjectKey)?.get(day) || 0;
}

function incrementSubjectCount(state, subjectKey, day, delta) {
  const dayCounts = state.subjectDayCounts.get(subjectKey) || new Map();
  const nextValue = (dayCounts.get(day) || 0) + delta;

  if (nextValue <= 0) {
    dayCounts.delete(day);
  } else {
    dayCounts.set(day, nextValue);
  }

  if (dayCounts.size === 0) {
    state.subjectDayCounts.delete(subjectKey);
  } else {
    state.subjectDayCounts.set(subjectKey, dayCounts);
  }
}

function countGaps(indices) {
  if (!indices.length) return 0;
  const sorted = [...indices].sort((left, right) => left - right);
  return (sorted[sorted.length - 1] - sorted[0] + 1) - sorted.length;
}

function canUseFaculty(task, affectedSlots, state) {
  if (!task.faculty) return true;

  return affectedSlots.every((slot) => {
    return !state.facultyBookings.has(`${task.faculty}__${slot.day}__${slot.time}`);
  });
}

function canPlaceLab(task, startSlot, state, classSlotsByDay) {
  const daySlots = classSlotsByDay[startSlot.day];
  const dayState = state.dayState[startSlot.day];
  const startIndex = daySlots.findIndex((slot) => slot.time === startSlot.time);
  const duration = task.labSlots || 2;
  const validStarts = LAB_START_TIMES_BY_DURATION[duration];

  if (!validStarts || !validStarts.has(startSlot.time)) return null;
  if (startSlot.day === "SAT") return null;
  if (task.closesDay && !["14:00-15:00", "15:00-16:00"].includes(startSlot.time)) return null;
  if (
    dayState.closingSubjectKey &&
    dayState.closingSubjectKey !== task.subjectKey &&
    !(dayState.closingIsMajorMinor && task.isMajorMinor)
  ) return null;
  if (state.weeklyLabSubjects.has(task.subjectKey)) return null;
  if (getSubjectCountForDay(state, task.subjectKey, startSlot.day) > 0) return null;
  if (dayState.hasLab) return null;
  const affectedSlots = daySlots.slice(startIndex, startIndex + duration);

  if (affectedSlots.length !== duration) return null;
  if (affectedSlots.some((slot, index) => slot.classIndex !== affectedSlots[0].classIndex + index)) return null;
  if (affectedSlots.some((slot) => state.assignments.has(`${slot.day}__${slot.time}`))) return null;

  const laterAssignments = [...state.assignments.entries()].filter(([key]) => {
    const [day, time] = key.split("__");
    if (day !== startSlot.day) return false;
    const period = PERIODS.find((item) => item.time === time);
    return period && period.classIndex > affectedSlots[affectedSlots.length - 1].classIndex;
  });

  if (startSlot.time === "10:00-11:00" && laterAssignments.length) return null;
  if (startSlot.time === "11:15-12:15" && laterAssignments.length) return null;
  if (startSlot.time === "15:00-16:00" && laterAssignments.length) return null;
  if (duration === 3 && laterAssignments.length) return null;

  if (startSlot.time === "13:00-14:00" || startSlot.time === "14:00-15:00") {
    const laterNonClosingAssignment = laterAssignments.some(([, assignment]) => {
      return !String(assignment.subject || "").toLowerCase().includes("major")
        && !String(assignment.subject || "").toLowerCase().includes("minor");
    });

    if (laterNonClosingAssignment) return null;
    if (laterAssignments.length > 1) return null;
  }

  if (!canUseFaculty(task, affectedSlots, state)) return null;

  return affectedSlots;
}

function isClosingMajorMinorAllowedAfterLab(dayState, task, slot) {
  return dayState.allowClosingMajorMinorAfterLab
    && task.isMajorMinor
    && !task.isLab
    && slot.classIndex === dayState.labEndIndex + 1;
}

function canPlaceSingle(task, slot, state) {
  const dayState = state.dayState[slot.day];
  if (slot.day === "SAT") return false;
  if (state.assignments.has(`${slot.day}__${slot.time}`)) return false;

  if (dayState.hasLab && dayState.labEndIndex !== null && slot.classIndex > dayState.labEndIndex) {
    const canFollowLab = isClosingMajorMinorAllowedAfterLab(dayState, task, slot);

    if (!canFollowLab) return false;
  }

  if (task.isMajorMinor && !task.isLab) {
    const canBeAtStart = slot.classIndex <= 1;
    const canBeAtEnd = slot.classIndex >= 4;

    if (!canBeAtStart && !canBeAtEnd) return false;

    if (canBeAtStart) {
      const hasEarlierTeaching = [...dayState.usedClassIndices].some((classIndex) => classIndex < slot.classIndex);
      if (hasEarlierTeaching) return false;
    }
  }

  if (task.closesDay) {
    const isEndPlacement = slot.classIndex >= 4;
    if (!task.isMajorMinor || isEndPlacement) {
      if (slot.classIndex < 4) return false;
      if (
        dayState.closingSubjectKey &&
        dayState.closingSubjectKey !== task.subjectKey &&
        !(dayState.closingIsMajorMinor && task.isMajorMinor)
      ) return false;

      if (dayState.hasLab && slot.classIndex > dayState.labEndIndex) {
        const canFollowLab = isClosingMajorMinorAllowedAfterLab(dayState, task, slot);
        if (!canFollowLab) return false;
      }

      const laterFilledWithOtherSubject = [...state.assignments.entries()].some(([key, assignment]) => {
        const [day, time] = key.split("__");
        if (day !== slot.day) return false;
        const period = PERIODS.find((item) => item.time === time);
        return period && period.classIndex > slot.classIndex && assignment.subject !== task.subjectName;
      });

      if (laterFilledWithOtherSubject) return false;
    }
  } else if (
    dayState.closingSubjectKey &&
    dayState.closingStartIndex !== null &&
    slot.classIndex >= dayState.closingStartIndex
  ) {
    return false;
  }

  return canUseFaculty(task, [slot], state);
}

function getDayCapacity(day) {
  return day === "SAT" ? 0 : 7;
}

function isFourthYearClassSlots(classSlotsByDay) {
  return classSlotsByDay.MON?.some((slot) => slot.time === "11:00-12:00");
}

function placeTask(task, affectedSlots, state) {
  const day = affectedSlots[0].day;
  const dayState = state.dayState[day];

  for (const slot of affectedSlots) {
    state.assignments.set(`${slot.day}__${slot.time}`, {
      subject: task.subjectName,
      faculty: task.faculty,
      type: task.type
    });
    dayState.usedClassIndices.add(slot.classIndex);

    if (task.faculty) {
      state.facultyBookings.add(`${task.faculty}__${slot.day}__${slot.time}`);
    }
  }

  dayState.teachingCount += affectedSlots.length;
  incrementSubjectCount(state, task.subjectKey, day, affectedSlots.length);

  if (!task.isLab && affectedSlots.length === 1 && affectedSlots[0].classIndex === 0) {
    state.firstSlotCounts.set(
      task.subjectKey,
      (state.firstSlotCounts.get(task.subjectKey) || 0) + 1
    );
  }

  if (task.isLab) {
    dayState.hasLab = true;
    dayState.labStartIndex = affectedSlots[0].classIndex;
    dayState.labEndIndex = affectedSlots[affectedSlots.length - 1].classIndex;
    dayState.allowClosingMajorMinorAfterLab =
      !task.isMajorMinor && affectedSlots[0].classIndex === 4;
    state.weeklyLabSubjects.add(task.subjectKey);
  }

  if (task.closesDay && affectedSlots[0].classIndex >= 4) {
    dayState.closingSubjectKey = task.subjectKey;
    dayState.closingIsMajorMinor = task.isMajorMinor;
    dayState.closingStartIndex =
      dayState.closingStartIndex === null
        ? affectedSlots[0].classIndex
        : Math.min(dayState.closingStartIndex, affectedSlots[0].classIndex);
  }
}

function unplaceTask(task, affectedSlots, state) {
  const day = affectedSlots[0].day;
  const dayState = state.dayState[day];

  for (const slot of affectedSlots) {
    state.assignments.delete(`${slot.day}__${slot.time}`);
    dayState.usedClassIndices.delete(slot.classIndex);

    if (task.faculty) {
      state.facultyBookings.delete(`${task.faculty}__${slot.day}__${slot.time}`);
    }
  }

  dayState.teachingCount -= affectedSlots.length;
  incrementSubjectCount(state, task.subjectKey, day, -affectedSlots.length);

  if (!task.isLab && affectedSlots.length === 1 && affectedSlots[0].classIndex === 0) {
    const nextCount = (state.firstSlotCounts.get(task.subjectKey) || 0) - 1;
    if (nextCount <= 0) {
      state.firstSlotCounts.delete(task.subjectKey);
    } else {
      state.firstSlotCounts.set(task.subjectKey, nextCount);
    }
  }

  if (task.isLab) {
    dayState.hasLab = false;
    dayState.labStartIndex = null;
    dayState.labEndIndex = null;
    dayState.allowClosingMajorMinorAfterLab = false;
    state.weeklyLabSubjects.delete(task.subjectKey);
  }

  if (task.closesDay) {
    const remainingClosingAssignments = [...state.assignments.entries()]
      .filter(([key, assignment]) => {
        const [assignedDay] = key.split("__");
        return assignedDay === day && assignment.subject === task.subjectName;
      })
      .map(([key]) => {
        const [, time] = key.split("__");
        return PERIODS.find((period) => period.time === time)?.classIndex;
      })
      .filter((classIndex) => classIndex !== undefined && classIndex !== null);

    if (!remainingClosingAssignments.length) {
      dayState.closingSubjectKey = null;
      dayState.closingIsMajorMinor = false;
      dayState.closingStartIndex = null;
    } else {
      dayState.closingIsMajorMinor = task.isMajorMinor;
      dayState.closingStartIndex = Math.min(...remainingClosingAssignments);
    }
  }
}

function getLabScore(task, day, affectedSlots, state) {
  const dayState = state.dayState[day];
  const loadRatio = dayState.teachingCount / getDayCapacity(day);
  let score = 0;

  score += affectedSlots[0].time === "14:00-15:00" ? 18 : 12;
  score += dayState.teachingCount > 0 ? 6 : 0;
  score += task.isMajorMinor || task.closesDay ? 14 : 0;
  score -= affectedSlots[0].classIndex >= 4 && dayState.teachingCount === 0 ? 8 : 0;
  score -= loadRatio * 20;

  return score;
}

function placeLabs(tasks, state, classSlotsByDay, taskIndex = 0, afterLabs = null) {
  if (taskIndex >= tasks.length) {
    return afterLabs ? afterLabs() : true;
  }

  const task = tasks[taskIndex];
  const candidates = [];

  for (const day of DAYS) {
    for (const slot of classSlotsByDay[day]) {
      const affectedSlots = canPlaceLab(task, slot, state, classSlotsByDay);
      if (!affectedSlots) continue;
      candidates.push({
        affectedSlots,
        score: getLabScore(task, day, affectedSlots, state)
      });
    }
  }

  candidates.sort((left, right) => right.score - left.score);

  for (const candidate of candidates) {
    placeTask(task, candidate.affectedSlots, state);
    if (placeLabs(tasks, state, classSlotsByDay, taskIndex + 1, afterLabs)) {
      return true;
    }
    unplaceTask(task, candidate.affectedSlots, state);
  }

  return false;
}

function getSingleScore(task, slot, state, classSlotsByDay) {
  const dayState = state.dayState[slot.day];
  const currentIndices = [...dayState.usedClassIndices];
  const nextIndices = [...currentIndices, slot.classIndex];
  const sameSubjectCount = getSubjectCountForDay(state, task.subjectKey, slot.day);
  const touchesExistingClass = currentIndices.includes(slot.classIndex - 1) || currentIndices.includes(slot.classIndex + 1);
  const loadRatio = dayState.teachingCount / getDayCapacity(slot.day);
  const firstSlotCount = state.firstSlotCounts.get(task.subjectKey) || 0;
  const isFourthYear = isFourthYearClassSlots(classSlotsByDay);
  const earlierEmptySlots = classSlotsByDay[slot.day].filter((classSlot) => {
    return classSlot.classIndex < slot.classIndex
      && !state.assignments.has(`${classSlot.day}__${classSlot.time}`);
  }).length;
  let score = 0;

  score -= countGaps(nextIndices) * 12;
  score -= slot.classIndex * (task.isMajorMinor || task.closesDay ? -6 : 3);
  score += currentIndices.length > 0 && touchesExistingClass ? 8 : 0;
  score += currentIndices.length === 0 && slot.classIndex <= 1 ? 5 : 0;
  score -= currentIndices.length === 0 && slot.classIndex >= 4 ? 8 : 0;
  score += sameSubjectCount === 0 ? 3 : -5;
  score -= loadRatio * 18;
  score -= dayState.teachingCount * 0.5;
  score += task.closesDay ? slot.classIndex * 10 : 0;
  score -= slot.classIndex === 0 ? firstSlotCount * 14 : 0;

  if (isFourthYear && !task.isMajorMinor && !task.closesDay) {
    score += (6 - slot.classIndex) * 7;
    score -= earlierEmptySlots * 16;
    score += slot.classIndex <= 2 ? 12 : -8;
    score -= sameSubjectCount * 40;
  }

  return score;
}

function getProjectScore(task, slot, state) {
  const dayState = state.dayState[slot.day];
  const currentIndices = [...dayState.usedClassIndices];
  const nextIndices = [...currentIndices, slot.classIndex];
  const touchesExistingClass = currentIndices.includes(slot.classIndex - 1) || currentIndices.includes(slot.classIndex + 1);
  const loadRatio = dayState.teachingCount / getDayCapacity(slot.day);
  let score = 0;

  score -= countGaps(nextIndices) * 10;
  score += slot.classIndex * 8;
  score += currentIndices.length > 0 && touchesExistingClass ? 10 : 0;
  score += dayState.teachingCount > 0 ? 4 : -12;
  score -= loadRatio * 12;

  return score;
}

function fillSingles(tasks, state, classSlotsByDay) {
  const orderedTasks = [...tasks].sort((left, right) => {
    if (left.closesDay !== right.closesDay) {
      return Number(right.closesDay) - Number(left.closesDay);
    }
    if (left.isMajorMinor !== right.isMajorMinor) {
      return Number(right.isMajorMinor) - Number(left.isMajorMinor);
    }
    return left.subjectName.localeCompare(right.subjectName);
  });
  const placed = [];

  for (const task of orderedTasks) {
    const candidates = [];

    for (const day of DAYS) {
      for (const slot of classSlotsByDay[day]) {
        if (!canPlaceSingle(task, slot, state)) continue;

        candidates.push({
          slot,
          score: getSingleScore(task, slot, state, classSlotsByDay)
        });
      }
    }

    candidates.sort((left, right) => right.score - left.score);

    if (!candidates.length) {
      if (process.env.DEBUG_SCHEDULER === "1") {
        console.log("NO_SINGLE_CANDIDATE", task.subjectName, task.type, task.isMajorMinor, task.closesDay);
        console.log([...state.assignments.entries()].map(([key, value]) => `${key}:${value.subject}`).join("\n"));
      }
      for (let index = placed.length - 1; index >= 0; index -= 1) {
        unplaceTask(placed[index].task, placed[index].slots, state);
      }
      return false;
    }

    const slots = [candidates[0].slot];
    placeTask(task, slots, state);
    placed.push({ task, slots });
  }

  return true;
}

function fillProjects(tasks, state, classSlotsByDay) {
  const orderedTasks = [...tasks];
  const placed = [];

  for (const task of orderedTasks) {
    const candidates = [];

    for (const day of DAYS) {
      for (const slot of classSlotsByDay[day]) {
        if (!canPlaceSingle(task, slot, state)) continue;

        candidates.push({
          slot,
          score: getProjectScore(task, slot, state)
        });
      }
    }

    candidates.sort((left, right) => right.score - left.score);

    if (!candidates.length) {
      for (let index = placed.length - 1; index >= 0; index -= 1) {
        unplaceTask(placed[index].task, placed[index].slots, state);
      }
      return false;
    }

    const slots = [candidates[0].slot];
    placeTask(task, slots, state);
    placed.push({ task, slots });
  }

  return true;
}

function canPlaceProjectModeTheory(task, slot, state) {
  if (slot.day === "SAT") return false;
  if (slot.classIndex > 2) return false;
  if (state.assignments.has(`${slot.day}__${slot.time}`)) return false;
  if (getSubjectCountForDay(state, task.subjectKey, slot.day) > 0) return false;

  return canUseFaculty(task, [slot], state);
}

function getProjectModeTheoryScore(task, slot, state) {
  const dayState = state.dayState[slot.day];
  const firstSlotCount = state.firstSlotCounts.get(task.subjectKey) || 0;
  let score = 0;

  score += slot.classIndex === 0 ? 18 : 0;
  score += slot.classIndex === 1 ? 12 : 0;
  score += slot.classIndex === 2 ? 6 : 0;
  score -= dayState.teachingCount * 4;
  score -= firstSlotCount * 8;

  return score;
}

function fillProjectModeTheory(tasks, state, classSlotsByDay) {
  const orderedTasks = [...tasks].sort((left, right) => {
    if (left.isMajorMinor !== right.isMajorMinor) {
      return Number(left.isMajorMinor) - Number(right.isMajorMinor);
    }
    return left.subjectName.localeCompare(right.subjectName);
  });

  for (const task of orderedTasks) {
    const candidates = [];

    for (const day of DAYS) {
      for (const slot of classSlotsByDay[day]) {
        if (!canPlaceProjectModeTheory(task, slot, state)) continue;

        candidates.push({
          slot,
          score: getProjectModeTheoryScore(task, slot, state)
        });
      }
    }

    candidates.sort((left, right) => right.score - left.score);

    if (!candidates.length) {
      return false;
    }

    placeTask(task, [candidates[0].slot], state);
  }

  return true;
}

function canPlaceProjectBlock(task, slot, state) {
  if (slot.day === "SAT") return false;
  if (state.assignments.has(`${slot.day}__${slot.time}`)) return false;
  return canUseFaculty(task, [slot], state);
}

function getProjectBlockScore(slot, state) {
  const dayState = state.dayState[slot.day];
  const currentIndices = [...dayState.usedClassIndices];
  const nextIndices = [...currentIndices, slot.classIndex];
  const touchesExistingClass = currentIndices.includes(slot.classIndex - 1) || currentIndices.includes(slot.classIndex + 1);
  let score = 0;

  score += slot.classIndex >= 3 ? 20 : 0;
  score += slot.classIndex >= 4 ? 10 : 0;
  score += touchesExistingClass ? 8 : 0;
  score -= countGaps(nextIndices) * 14;
  score -= dayState.teachingCount * 1.5;

  return score;
}

function fillProjectModeProjects(tasks, state, classSlotsByDay) {
  const placed = [];

  for (const task of tasks) {
    const candidates = [];

    for (const day of DAYS) {
      for (const slot of classSlotsByDay[day]) {
        if (!canPlaceProjectBlock(task, slot, state)) continue;

        candidates.push({
          slot,
          score: getProjectBlockScore(slot, state)
        });
      }
    }

    candidates.sort((left, right) => right.score - left.score);

    if (!candidates.length) {
      for (let index = placed.length - 1; index >= 0; index -= 1) {
        unplaceTask(placed[index].task, placed[index].slots, state);
      }
      return false;
    }

    const slots = [candidates[0].slot];
    placeTask(task, slots, state);
    placed.push({ task, slots });
  }

  return true;
}

function generateProjectModeTimetable(tasks, options) {
  const projectSlots = generateSlotsFromPeriods(FOURTH_YEAR_PROJECT_PERIODS);
  const classSlotsByDay = buildClassSlotsByDay(projectSlots);
  const state = createState(options);

  const theoryPlaced = fillProjectModeTheory(tasks.singles, state, classSlotsByDay);
  if (!theoryPlaced) return null;

  const projectsPlaced = fillProjectModeProjects(tasks.projects, state, classSlotsByDay);
  if (!projectsPlaced) return null;

  return mergeAssignmentsIntoSlots(projectSlots, state);
}

function mergeAssignmentsIntoSlots(slots, state) {
  return slots.map((slot) => {
    const assignment = state.assignments.get(`${slot.day}__${slot.time}`);

    if (!assignment) {
      return slot;
    }

    return {
      ...slot,
      type: assignment.type,
      subject: assignment.subject,
      faculty: assignment.faculty
    };
  });
}

function buildTasks(subjects) {
  const labs = [];
  const singles = [];
  const projects = [];

  for (const subject of subjects) {
    if (subject.isProject) {
      for (let index = 0; index < subject.hoursPerWeek; index += 1) {
        projects.push({
          subjectKey: subject.key,
          subjectName: subject.name,
          faculty: subject.faculty,
          type: subject.type,
          isLab: false,
          isProject: true,
          isMajorMinor: false,
          closesDay: false
        });
      }
      continue;
    }

    if (subject.isLab) {
      if (subject.hoursPerWeek < 1) {
  return null;
}

      labs.push({
        subjectKey: subject.key,
        subjectName: subject.name,
        faculty: subject.faculty,
        type: subject.type,
        isLab: true,
        labSlots: subject.hoursPerWeek,
        isMajorMinor: subject.isMajorMinor,
        closesDay: subject.closesDay
      });
      continue;
    }

    for (let index = 0; index < subject.hoursPerWeek; index += 1) {
      singles.push({
        subjectKey: subject.key,
        subjectName: subject.name,
        faculty: subject.faculty,
        type: subject.type,
        isLab: false,
        isProject: false,
        isMajorMinor: subject.isMajorMinor,
        closesDay: subject.closesDay
      });
    }
  }

  return { labs, singles, projects };
}

function generateTimetable(subjects, slots, options = {}) {
  const normalizedSubjects = normalizeSubjects(subjects);
  const tasks = buildTasks(normalizedSubjects);

  if (!tasks) {
    return null;
  }

  const classSlotsByDay = buildClassSlotsByDay(slots);
  const state = createState(options);

  if (tasks.projects.length && !tasks.labs.length) {
    return generateProjectModeTimetable(tasks, options);
  }

  const labsPlaced = placeLabs(tasks.labs, state, classSlotsByDay, 0, () => {
    return fillSingles(tasks.singles, state, classSlotsByDay)
      && fillProjects(tasks.projects, state, classSlotsByDay);
  });

  if (!labsPlaced) {
    return null;
  }

  return mergeAssignmentsIntoSlots(slots, state);
}

module.exports = {
  generateEmptySlots,
  generateFourthYearSlots,
  generateTimetable
};
