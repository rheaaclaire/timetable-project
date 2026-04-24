const express = require("express");
const cors = require("cors");

console.log("🔥 SERVER FILE LOADED 🔥");

const app = express();

app.use(cors());
app.use(express.json());

const academicRoutes = require("./routes/academicRoutes");
app.use("/api", academicRoutes);

app.listen(5001, () => {
  console.log("🔥 SERVER RUNNING ON 5001 🔥");
});