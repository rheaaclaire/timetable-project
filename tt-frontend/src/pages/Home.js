import React, { useEffect, useState } from "react";
import API from "../services/api";
import "../styles/home.css";

function Home({ user, setPage }) {
  const [saved, setSaved] = useState([]);
  const [credentials, setCredentials] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    API.get("/saved-timetables")
      .then((res) => setSaved(res.data.timetables || []))
      .catch(() => setMessage("Could not load saved timetable summary."));

    if (user?.role === "admin") {
      API.get("/auth/credentials")
        .then((res) => setCredentials(res.data.credentials || []))
        .catch(() => {});
    }
  }, [user]);

  return (
    <div className="home-container">
      <h1 className="welcome-text">Welcome, {user?.name}</h1>

      <div className="highlight-box">
        <h2>Academic Timetable Generation</h2>
        <p>& Management</p>
      </div>

      {message && <p className="status-message">{message}</p>}

      <div className="dashboard-grid">
        <button className="dashboard-card" onClick={() => setPage("upload")}>
          <span>01</span>
          <strong>Upload Loadsheet</strong>
          <p>Add Excel subject loads department-wise.</p>
        </button>
        <button className="dashboard-card" onClick={() => setPage("generate")}>
          <span>02</span>
          <strong>Generate & Save</strong>
          <p>Preview the timetable, then save only when approved.</p>
        </button>
        <button className="dashboard-card" onClick={() => setPage("view")}>
          <span>03</span>
          <strong>View & Export</strong>
          <p>Review saved grids and export them to Excel.</p>
        </button>
      </div>

      <div className="page-section">
        <div className="section-heading">
          <p className="section-kicker">Saved Timetables</p>
          <h2>Saved Schedule Summary</h2>
        </div>

        <div className="summary-list">
          {saved.length ? saved.map((item) => (
            <div className="summary-row" key={`${item.department}-${item.year}-${item.semester}`}>
              <strong>{item.department}</strong>
              <span>Year {item.year}, Semester {item.semester}</span>
              <span>{item.slotCount} saved slots</span>
            </div>
          )) : <p className="status-message">No saved timetables yet.</p>}
        </div>
      </div>

      {user?.role === "admin" && (
        <div className="page-section">
          <div className="section-heading">
            <p className="section-kicker">Login IDs</p>
            <h2>Demo User Accounts</h2>
            <p className="section-copy">
              Teacher accounts are created automatically from faculty names already present in the database.
            </p>
          </div>

          <div className="summary-list">
            {credentials.slice(0, 12).map((account) => (
              <div className="summary-row" key={account.email}>
                <strong>{account.name}</strong>
                <span>{account.role}</span>
                <span>{account.email}</span>
                <span>{account.password}</span>
              </div>
            ))}
            {credentials.length > 12 && (
              <p className="section-copy">Showing first 12 accounts. All teacher passwords are teacher123.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;
