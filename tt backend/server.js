const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5003;

app.use(cors());
app.use(express.json());

const academicRoutes = require("./routes/academicRoutes");
const authRoutes = require("./routes/authRoutes");
const exportRoutes = require("./routes/exportRoutes");

app.use("/api", academicRoutes);
app.use("/api/auth", authRoutes);
app.use("/api", exportRoutes);

app.listen(PORT, () => {
  console.log(`SERVER RUNNING ON ${PORT}`);
});
