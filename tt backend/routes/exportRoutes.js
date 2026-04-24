const express = require('express');
const { exportTimetableController } = require('../controllers/exportController');

const router = express.Router();

router.get('/export-timetable', exportTimetableController);

module.exports = router;