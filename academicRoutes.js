const express = require("express");
const router = express.Router();
const upload = require("../middlewares/upload");

const {
  uploadSubjectsController,
  getSubjectsController,
  generateTimetableController,
  getTimetableController,
  getTeacherTimetableController
} = require("../controllers/academicController");

router.post(
  "/upload-subjects",
  upload.single("file"), // 🔥 THIS WAS MISSING OR WRONG
  uploadSubjectsController
);


router.get("/subjects", getSubjectsController);
router.post("/generate-timetable", generateTimetableController);
router.get("/timetable", getTimetableController);
router.get("/teacher-timetable", getTeacherTimetableController);

module.exports = router;