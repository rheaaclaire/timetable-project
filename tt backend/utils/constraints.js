// utils/constraints.js

const checkTeacherClash = (db, teacher, day, slot) => {
  return new Promise((resolve, reject) => {
    db.query(
      "SELECT * FROM timetable WHERE teacher=? AND day=? AND slot=?",
      [teacher, day, slot],
      (err, result) => {
        if (err) return reject(err);
        resolve(result.length > 0);
      }
    );
  });
};

const checkRoomAvailability = (db, room, day, slot) => {
  return new Promise((resolve, reject) => {
    db.query(
      "SELECT * FROM timetable WHERE room=? AND day=? AND slot=?",
      [room, day, slot],
      (err, result) => {
        if (err) return reject(err);
        resolve(result.length > 0);
      }
    );
  });
};

const checkBreakSlot = (slot) => {
  return slot === 4; // example: slot 4 is break
};

module.exports = {
  checkTeacherClash,
  checkRoomAvailability,
  checkBreakSlot
};