const express = require('express');
const router = express.Router();
const courseController = require('../controllers/courseController');

router.post('/upload', courseController.uploadCourses);

module.exports = router;
