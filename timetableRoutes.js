const express = require("express");
const router = express.Router();

const { addLecture } = require("../controllers/timetableController");

router.post("/add-lecture", addLecture);

module.exports = router;