const { generateEmptySlots, generateFourthYearSlots, generateTimetable } = require("./slotEngine");

function generateCompTimetable(subjects, year, lockedFacultyBookings = []) {
  return generateTimetable(
    subjects,
    Number(year) === 4 ? generateFourthYearSlots() : generateEmptySlots(),
    {
      lockedFacultyBookings
    }
  );
}

module.exports = {
  generateCompTimetable
};