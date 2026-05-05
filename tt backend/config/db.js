const mysql = require("mysql2");

console.log("🔥 USING CONFIG DB FILE");

const db = mysql.createPool({
  host: process.env.MYSQLHOST,
  user: "root",                     // ✅ FIXED
  password: "kEDGnyWUrnCwTWzqGLnOfFyVTXDyXbmc", // ✅ FIXED
  database: "railway",              // ✅ FIXED
  port: 10432
});

db.getConnection((err, conn) => {
  if (err) {
    console.error("❌ DB ERROR:", err);
  } else {
    console.log("✅ Railway MySQL Connected");
    conn.release();
  }
});
const department = "ECS";
module.exports = db;