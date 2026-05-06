import React, { useState } from "react";
import API from "../services/api";
import "../styles/home.css";

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT"];
const REGULAR_TIMES = [
  "09:00-10:00",
  "10:00-11:00",
  "11:15-12:15",
  "12:15-13:15",
  "14:00-15:00",
  "15:00-16:00",
  "16:00-17:00"
];
const FOURTH_YEAR_TIMES = [
  "09:00-10:00",
  "10:00-11:00",
  "11:00-12:00",
  "13:00-14:00",
  "14:00-15:00",
  "15:00-16:00",
  "16:00-17:00"
];

function Home({ department, year, semester }) {
  const [day, setDay] = useState("MON");
  const [time, setTime] = useState("09:00-10:00");
  const [facultyList, setFacultyList] = useState([]);
  const [message, setMessage] = useState("");
  const times = Number(year) === 4 ? FOURTH_YEAR_TIMES : REGULAR_TIMES;

  const checkAvailability = async () => {
    try {
      const res = await API.get("/faculty-availability", {
        params: { department, year: Number(year), semester: Number(semester), day, time }
      });
      const nextList = res.data.availableFaculty || [];
      setFacultyList(nextList);
      setMessage(nextList.length ? "" : "No free faculty found for this slot.");
    } catch (err) {
      setFacultyList([]);
      setMessage(err.response?.data?.message || "Could not check faculty availability.");
    }
  };

  return (
    <div className="home-container">
      <h1 className="welcome-text">
        Welcome, Admin
      </h1>

      <div className="highlight-box">
        <h2>Academic Timetable Generation</h2>
        <p>& Management</p>
      </div>

      <div className="page-section">
        <div className="section-heading">
          <p className="section-kicker">Faculty Lookup</p>
          <h2>Check Faculty Availability</h2>
          <p className="section-copy">
            Find faculty who are free for {department}, Year {year}, Semester {semester} at a selected day and time.
          </p>
        </div>

        <div className="action-panel">
          <label className="selection-field">
            <span>Day</span>
            <select value={day} onChange={(e) => setDay(e.target.value)}>
              {DAYS.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>

          <label className="selection-field">
            <span>Time</span>
            <select value={time} onChange={(e) => setTime(e.target.value)}>
              {times.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>

          <button className="primary-button" onClick={checkAvailability}>
            Check Availability
          </button>
        </div>

        {message && <p className="status-message">{message}</p>}

        {!!facultyList.length && (
          <div className="status-message">
            <strong>Available Faculty:</strong> {facultyList.join(", ")}
          </div>
        )}
      </div>

    </div>
  );
}

export default Home;
