CREATE DATABASE IF NOT EXISTS timetable_db;
USE timetable_db;

CREATE TABLE IF NOT EXISTS subjects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  department VARCHAR(64) NOT NULL,
  year INT NOT NULL,
  semester INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  hours_per_week INT NOT NULL,
  type VARCHAR(32) NOT NULL DEFAULT 'THEORY',
  faculty VARCHAR(255) NULL,
  is_major_minor TINYINT(1) NOT NULL DEFAULT 0,
  closes_day VARCHAR(16) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_subjects_context (department, year, semester)
);

CREATE TABLE IF NOT EXISTS timetable_slots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  department VARCHAR(64) NOT NULL,
  year INT NOT NULL,
  semester INT NOT NULL,
  day VARCHAR(16) NOT NULL,
  time VARCHAR(32) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  faculty VARCHAR(255) NULL,
  room VARCHAR(64) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_slot_context (department, year, semester, day, time, subject),
  INDEX idx_timetable_context (department, year, semester)
);

CREATE TABLE IF NOT EXISTS faculty (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  department VARCHAR(64) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS faculty_slots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  faculty_id INT NOT NULL,
  year INT NOT NULL,
  semester INT NOT NULL,
  day VARCHAR(16) NOT NULL,
  time VARCHAR(32) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_faculty_slot (faculty_id, year, semester, day, time),
  CONSTRAINT fk_faculty_slots_faculty
    FOREIGN KEY (faculty_id) REFERENCES faculty(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS faculty_subjects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  faculty_id INT NOT NULL,
  subject_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_faculty_subjects_faculty
    FOREIGN KEY (faculty_id) REFERENCES faculty(id)
    ON DELETE CASCADE
);
