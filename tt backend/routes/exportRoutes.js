const express = require("express");
const router = express.Router();

const { exportTimetable } = require("../controllers/exportController");

router.get("/export-timetable", exportTimetable);

module.exports = router;