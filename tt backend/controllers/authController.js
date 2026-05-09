const bcrypt = require("bcryptjs");
const db = require("../config/db");

async function query(sql, params = []) {
  const [rows] = await db.query(sql, params);
  return rows;
}

function isPlaceholderFaculty(name) {
  const value = String(name || "").trim().toLowerCase();
  return !value
    || value === "none"
    || value === "-"
    || value === "tba"
    || value === "faculty tba"
    || value === "elective faculty"
    || value === "open elective faculty"
    || value === "honor faculty"
    || value === "honors faculty"
    || value === "major/minor faculty";
}

function splitFacultyNames(faculty) {
  if (isPlaceholderFaculty(faculty)) {
    return [];
  }

  return String(faculty || "")
    .split(/\s*(?:\/|,|&|\band\b)\s*/i)
    .map((name) => name.trim())
    .filter((name) => !isPlaceholderFaculty(name));
}

function normalizeDepartment(value) {
  const rawValue = String(value || "ECS").trim().toUpperCase();
  const compactValue = rawValue.replace(/[\s&/-]+/g, "_");

  if (compactValue === "SCIENCE_HUMANITIES" || compactValue === "SCIENCE_AND_HUMANITIES") {
    return "SCIENCE_HUMANITIES";
  }

  return compactValue || "ECS";
}

function slugifyEmailName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/^(prof|dr|mrs|mr|ms)\.?\s+/i, "")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

function facultyEmail(name) {
  return `${slugifyEmailName(name) || "teacher"}@dbce.com`;
}

async function ensureUsersTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      user_id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100),
      email VARCHAR(100) UNIQUE,
      password VARCHAR(255),
      role VARCHAR(20),
      department VARCHAR(40) NULL,
      faculty_name VARCHAR(100) NULL
    )
  `);

  const statements = [
    "ALTER TABLE users ADD COLUMN department VARCHAR(40) NULL",
    "ALTER TABLE users ADD COLUMN faculty_name VARCHAR(100) NULL"
  ];

  for (const sql of statements) {
    try {
      await query(sql);
    } catch (err) {
      if (err.code !== "ER_DUP_FIELDNAME") {
        throw err;
      }
    }
  }
}

async function getFacultySeedUsers() {
  let rows = [];

  try {
    rows = await query(`
      SELECT faculty, department
      FROM subjects
      WHERE faculty IS NOT NULL AND faculty <> ''
      UNION
      SELECT faculty, department
      FROM timetable_slots
      WHERE faculty IS NOT NULL AND faculty <> ''
    `);
  } catch (err) {
    if (
      err.code === "ER_NO_SUCH_TABLE" ||
      String(err.message || "").includes("doesn't exist")
    ) {
      rows = [];
    } else {
      throw err;
    }
  }

  const facultyMap = new Map();

  rows.forEach((row) => {
    splitFacultyNames(row.faculty).forEach((name) => {
      const key = name.toLowerCase();
      if (!facultyMap.has(key)) {
        facultyMap.set(key, {
          name,
          email: facultyEmail(name),
          password: "teacher123",
          role: "teacher",
          department: normalizeDepartment(row.department),
          faculty_name: name
        });
      }
    });
  });

  if (!facultyMap.size) {
    facultyMap.set("demo teacher", {
      name: "Teacher",
      email: "teacher@dbce.com",
      password: "teacher123",
      role: "teacher",
      department: "ECS",
      faculty_name: "Prof. Yeshudas Muttu"
    });
  }

  return [...facultyMap.values()];
}

async function upsertUser(user) {
  const existingUsers = await query(
    `SELECT user_id FROM users WHERE email = ?`,
    [user.email]
  );

  if (existingUsers.length) {
    await query(
      `UPDATE users
       SET name = ?, role = ?, department = ?, faculty_name = ?
       WHERE email = ?`,
      [
        user.name,
        user.role,
        user.department || null,
        user.faculty_name || null,
        user.email
      ]
    );
    return;
  }

  const hashedPassword = await bcrypt.hash(user.password, 10);

  await query(
    `INSERT INTO users (name, email, password, role, department, faculty_name)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       password = VALUES(password),
       role = VALUES(role),
       department = VALUES(department),
       faculty_name = VALUES(faculty_name)`,
    [
      user.name,
      user.email,
      hashedPassword,
      user.role,
      user.department || null,
      user.faculty_name || null
    ]
  );
}

async function ensureSeedUsers() {
  await ensureUsersTable();

  const fixedUsers = [
    {
      name: "Admin",
      email: "admin@dbce.com",
      password: "admin123",
      role: "admin",
      department: "ECS",
      faculty_name: null
    },
    {
      name: "Student",
      email: "student@dbce.com",
      password: "student123",
      role: "student",
      department: "ECS",
      faculty_name: null
    }
  ];

  const users = [...fixedUsers, ...(await getFacultySeedUsers())];

  for (const user of users) {
    await upsertUser(user);
  }
}

const loginController = async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!email || !password) {
      return res.status(400).json({ message: "email & password required" });
    }

    await ensureSeedUsers();

    const rows = await query(
      `SELECT user_id, name, email, password, role, department, faculty_name
       FROM users
       WHERE email = ?`,
      [email]
    );

    if (!rows.length) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = rows[0];
    const passwordOk = await bcrypt.compare(password, user.password || "");

    if (!passwordOk) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    res.json({
      success: true,
      user: {
        id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department || "ECS",
        facultyName: user.faculty_name || null
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Login failed" });
  }
};

const seedUsersController = async (_req, res) => {
  try {
    await ensureSeedUsers();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Seed failed" });
  }
};

const getCredentialsController = async (_req, res) => {
  try {
    await ensureSeedUsers();

    const users = await query(
      `SELECT name, email, role, department, faculty_name AS facultyName
       FROM users
       ORDER BY FIELD(role, 'admin', 'teacher', 'student'), name`
    );

    res.json({
      success: true,
      credentials: users.map((user) => ({
        ...user,
        password: user.role === "admin"
          ? "admin123"
          : user.role === "student"
          ? "student123"
          : "teacher123"
      }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Could not load credentials" });
  }
};

module.exports = {
  loginController,
  seedUsersController,
  getCredentialsController,
  ensureSeedUsers
};
