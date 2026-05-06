require("dotenv").config();

const express = require("express");
const cors = require("cors");

console.log("🔥 SERVER FILE LOADED 🔥");
console.log("ENV HOST:", process.env.MYSQLHOST);

const app = express();

app.use(cors());
app.use(express.json());

// ✅ Routes
const academicRoutes = require("./routes/academicRoutes");
const timetableRoutes = require("./routes/timetableRoutes");
const exportRoutes = require("./routes/exportRoutes"); // ONLY ONCE

// ✅ Use routes
app.use("/api", academicRoutes);
app.use("/api/timetable", timetableRoutes);
app.use("/api", exportRoutes); // for /api/export-timetable

// ✅ Start server
app.listen(5001, () => {
  console.log("🔥 SERVER RUNNING ON 5001 🔥");
});