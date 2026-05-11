require("dotenv").config();

const express = require("express");
const cors = require("cors");

console.log("🔥 SERVER FILE LOADED 🔥");

const app = express();
const PORT = Number(process.env.PORT) || 5001;

app.use(cors());
app.use(express.json());

const academicRoutes = require("./routes/academicRoutes");
const authRoutes = require("./routes/authRoutes");
const exportRoutes = require("./routes/exportRoutes");
const facultyRoutes = require("./routes/facultyRoutes");

app.use("/api", academicRoutes);
app.use("/api/auth", authRoutes);
app.use("/api", exportRoutes);
app.use("/api", facultyRoutes);

app.use((err, req, res, next) => {
  console.error("REQUEST ERROR:", err);

  return res.status(400).json({
    message: err.message || "Request failed"
  });
});

app.listen(PORT, () => {
  console.log(`🔥 SERVER RUNNING ON ${PORT} 🔥`);
});
