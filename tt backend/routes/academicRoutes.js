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
  getSavedTimetablesController,
  getTeacherTimetableController,
  swapSlotsController,
  getFacultyAvailabilityController,
  createFacultyRequestController,
  getFacultyRequestsController,
  acceptFacultyRequestController,
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
router.get("/saved-timetables", getSavedTimetablesController);
router.get("/teacher-timetable", getTeacherTimetableController);
router.post("/swap-slots", swapSlotsController);
router.get("/faculty-availability", getFacultyAvailabilityController);
router.post("/faculty-requests", createFacultyRequestController);
router.get("/faculty-requests", getFacultyRequestsController);
router.patch("/faculty-requests/:id/accept", acceptFacultyRequestController);

module.exports = router;
