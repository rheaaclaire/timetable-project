const mysql = require("mysql2");

const db = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "12345",
  database: "timetable_db"
});

console.log("✅ MySQL Pool Ready");

module.exports = db;
