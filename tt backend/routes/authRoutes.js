const express = require("express");
const router = express.Router();

const {
  loginController,
  seedUsersController
} = require("../controllers/authController");

router.post("/login", loginController);
router.post("/seed-users", seedUsersController);

module.exports = router;
