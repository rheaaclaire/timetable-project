require("dotenv").config();

const express = require("express");
const cors = require("cors");

console.log("SERVER FILE LOADED");

const app = express();
const port = Number(process.env.PORT) || 5001;

app.use(cors());
app.use(express.json());

const academicRoutes = require("./routes/academicRoutes");
const exportRoutes = require("./routes/exportRoutes");
const facultyRoutes = require("./routes/facultyRoutes");

app.use("/api", academicRoutes);
app.use("/api", exportRoutes);
app.use("/api", facultyRoutes);

app.use((err, req, res, next) => {
  if (err) {
    console.error("REQUEST ERROR:", err);
    return res.status(400).json({
      message: err.message || "Request failed"
    });
  }

  next();
});

app.listen(port, () => {
  console.log(`SERVER RUNNING ON ${port}`);
});
