const bcrypt = require("bcryptjs");
const db = require("../config/db");

function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, result) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(result);
    });
  });
}

async function ensureUserColumns() {
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

async function ensureSeedUsers() {
  await ensureUserColumns();

  const [{ count }] = await query("SELECT COUNT(*) AS count FROM users");
  if (Number(count) > 0) {
    return;
  }

  const users = [
    {
      name: "Admin",
      email: "admin@tt.local",
      password: "admin123",
      role: "admin",
      department: "ECS",
      faculty_name: null
    },
    {
      name: "Teacher",
      email: "teacher@tt.local",
      password: "teacher123",
      role: "teacher",
      department: "ECS",
      faculty_name: "Prof. Yeshudas Muttu"
    },
    {
      name: "Student",
      email: "student@tt.local",
      password: "student123",
      role: "student",
      department: "ECS",
      faculty_name: null
    }
  ];

  for (const user of users) {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    await query(
      `INSERT INTO users (name, email, password, role, department, faculty_name)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [user.name, user.email, hashedPassword, user.role, user.department, user.faculty_name]
    );
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

module.exports = {
  loginController,
  seedUsersController,
  ensureSeedUsers
};
