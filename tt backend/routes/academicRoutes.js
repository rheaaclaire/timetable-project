const express = require("express");
const router = express.Router();
const upload = require("../middlewares/upload");

const {
  uploadSubjectsController,
  getSubjectsController,
  generateTimetableController,
  getTimetableController,
} = require("../controllers/academicController");

router.post(
  "/upload-subjects",
  upload.single("file"), // 🔥 THIS WAS MISSING OR WRONG
  uploadSubjectsController
);

router.get("/subjects", getSubjectsController);
router.post("/generate-timetable", generateTimetableController);
router.get("/timetable", getTimetableController);

module.exports = router;