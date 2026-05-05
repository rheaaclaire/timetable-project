require("../config/db")
const {
  checkTeacherClash,
  checkRoomAvailability,
  checkBreakSlot
} = require("../utils/constraints");

const addLecture = async (req, res) => {
  const { teacher, room, day, slot, subject } = req.body;

  try {
    // 🚫 Break constraint
    if (checkBreakSlot(slot)) {
      return res.status(400).json({ message: "Cannot assign during break" });
    }

    // 🚫 Teacher clash
    const clash = await checkTeacherClash(db, teacher, day, slot);
    if (clash) {
      return res.status(400).json({ message: "Teacher already assigned" });
    }

    // 🚫 Room clash
    const roomBusy = await checkRoomAvailability(db, room, day, slot);
    if (roomBusy) {
      return res.status(400).json({ message: "Room already occupied" });
    }

    // ✅ Insert lecture
    db.query(
      "INSERT INTO timetable (teacher, room, day, slot, subject) VALUES (?, ?, ?, ?, ?)",
      [teacher, room, day, slot, subject],
      (err) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ message: "DB Error" });
        }

        res.json({ message: "Lecture added successfully" });
      }
    );

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { addLecture };