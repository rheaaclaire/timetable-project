require("dotenv").config();
console.log("ENV HOST:", process.env.MYSQLHOST);


const express = require("express");
const cors = require("cors");

console.log("🔥 SERVER FILE LOADED 🔥");

const app = express();

app.use(cors());
app.use(express.json());

// existing routes
const academicRoutes = require("./routes/academicRoutes");
app.use("/api", academicRoutes);

// ✅ new timetable routes
const timetableRoutes = require("./routes/timetableRoutes");
app.use("/api/timetable", timetableRoutes);

app.listen(5001, () => {
  console.log("🔥 SERVER RUNNING ON 5001 🔥");
});