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

module.exports = { assignRoom };