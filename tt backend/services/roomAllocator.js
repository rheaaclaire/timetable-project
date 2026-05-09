function assignRoom(slot, year) {
  // LAB rooms
  if (slot.subject && slot.subject.toLowerCase().includes('lab')) {
    return 'ECE LAB';
  }

  // THEORY rooms
  if (year === 2) return 'C3';
  if (year === 3) return 'C7';

  return null;
}

const CLASSROOMS = [
  "C-1","C-2","C-3","C-4",
  "C-5","C-6","C-7","C-8",
  "C-9","C-10","C-11","C-12",
  "C-13","C-14","C-15","C-16"
];

const LABS = {
  ECS: ["E-1","E-2","E-3","E-4","E-5"],
  MECH: ["ME-1","ME-2","ME-3","ME-4"],
  CIVIL: ["CV-1","CV-2","CV-3"],
  COMP: ["CP-1","CP-2","CP-3","CP-4"]
};

module.exports = { CLASSROOMS, LABS };
module.exports = { assignRoom };