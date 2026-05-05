ALTER USER 'root'@'localhost' IDENTIFIED BY 'NewPassword123!';
FLUSH PRIVILEGES;


CREATE DATABASE IF NOT EXISTS timetable_db;
USE timetable;

CREATE TABLE IF NOT EXISTS subjects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  subject_name VARCHAR(255),
  subject_code VARCHAR(100),
  faculty VARCHAR(255),
  department VARCHAR(50),
  year INT,
  semester INT,
  hours INT,
  type VARCHAR(20)
);

CREATE TABLE notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  message TEXT NOT NULL,
  receiver VARCHAR(255) NOT NULL,
  type VARCHAR(50), -- swap, cancel, assign
  reference_id INT, -- optional (link to timetable or request)
  status ENUM('unread', 'read') DEFAULT 'unread',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE swap_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  requester VARCHAR(255),
  target VARCHAR(255),
  message TEXT,
  status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);