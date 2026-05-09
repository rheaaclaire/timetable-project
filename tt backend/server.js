require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5003;

// IMPORTANT: middleware BEFORE routes
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ROUTES
const academicRoutes = require("./routes/academicRoutes");
const authRoutes = require("./routes/authRoutes");
const exportRoutes = require("./routes/exportRoutes");
const calendarRoutes = require("./routes/calendarRoutes");

// API ROUTES
app.use("/api", academicRoutes);
app.use("/api/auth", authRoutes);
app.use("/api", exportRoutes);
app.use("/api/calendar", calendarRoutes);

// START SERVER
app.listen(PORT, () => {
  console.log(`SERVER RUNNING ON ${PORT}`);
});