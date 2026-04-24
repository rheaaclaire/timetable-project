const express = require('express');
const {
  assignFacultyController
} = require('../controllers/facultyController');

const router = express.Router();

router.post('/assign-faculty', assignFacultyController);

module.exports = router;