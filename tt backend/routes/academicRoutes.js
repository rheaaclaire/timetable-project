const express = require("express");
const router = express.Router();
const upload = require("../middlewares/upload");

const {
  uploadSubjectsController,
  getSubjectsController,
  previewTimetableController,
  saveTimetableController,
  generateTimetableController,
  getTimetableController,
  getFacultyAvailabilityController,
} = require("../controllers/academicController");

router.post(
  "/upload-subjects",
  upload.single("file"), // 🔥 THIS WAS MISSING OR WRONG
  uploadSubjectsController
);

router.get("/subjects", getSubjectsController);
router.post("/preview-timetable", previewTimetableController);
router.post("/save-timetable", saveTimetableController);
router.post("/generate-timetable", generateTimetableController);
router.get("/timetable", getTimetableController);
router.get("/faculty-availability", getFacultyAvailabilityController);

module.exports = router;
