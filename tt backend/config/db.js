const path = require("path");

require("dotenv").config({
  path: path.join(__dirname, "..", ".env")
});

const mysql = require("mysql2");

const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "timetable_db",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const db = mysql.createPool(dbConfig);

console.log(
  `MySQL pool configured for ${dbConfig.user}@${dbConfig.host}/${dbConfig.database}`
);

db.getConnection((err, connection) => {
  if (err) {
    console.error("MySQL connection failed:", err.message);
    console.error(
      "Check tt backend/.env or grant this MySQL user access to the database."
    );
    return;
  }

  console.log("MySQL connection verified");
  connection.release();
});

module.exports = db;
