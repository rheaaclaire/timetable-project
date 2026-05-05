function canPlaceLecture(slots, slot, subject) {
  if (slot.type !== 'CLASS') return false;

  const prev = slots.find(
    s => s.day === slot.day && s.index === slot.index - 1
  );

  if (prev && prev.subject === subject.name) return false;

  return true;
}

function canPlaceLab(slots, index, subject, state) {
  const slot = slots[index];
  const next = slots[index + 1];

  if (!next) return false;
  if (slot.type !== 'CLASS' || next.type !== 'CLASS') return false;
  if (state.labsUsedOnDay[slot.day]) return false;

  return true;
}

module.exports = {
  canPlaceLecture,
  canPlaceLab
};