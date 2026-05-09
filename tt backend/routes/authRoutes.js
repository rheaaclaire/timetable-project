const express = require("express");
const router = express.Router();

const {
  loginController,
  seedUsersController,
  getCredentialsController
} = require("../controllers/authController");

router.post("/login", loginController);
router.post("/seed-users", seedUsersController);
router.get("/credentials", getCredentialsController);

module.exports = router;
