import React, { useState } from "react";
import FacultyTimetable from "./pages/FacultyTimetable";

import Sidebar from "./components/Sidebar";
import Home from "./pages/Home";
import Upload from "./pages/Upload";
import Generate from "./pages/Generate";
import ViewTimetable from "./pages/ViewTimetable";

import "./styles/layout.css";

function App() {
  const [page, setPage] = useState("home");
  const [department, setDepartment] = useState("ECS");
  const [year, setYear] = useState("2");
  const [semester, setSemester] = useState("3");
  const [refreshToken, setRefreshToken] = useState(0);

  const renderPage = () => {
    if (page === "home") return <Home />;

    if (page === "upload")
      return <Upload department={department} year={year} semester={semester} />;

    if (page === "generate") {
      return (
        <Generate
          department={department}
          year={year}
          semester={semester}
          onGenerated={() => {
            setRefreshToken((value) => value + 1);
            setPage("view");
          }}
        />
      );
    }

    if (page === "view") {
      return (
        <ViewTimetable
          department={department}
          year={year}
          semester={semester}
          refreshToken={refreshToken}
          onRefresh={() => setRefreshToken((value) => value + 1)}
        />
      );
    }

    if (page === "faculty") {
      return <FacultyTimetable />;
    }

    return <Home />;
  };

  return (
    <div className="app-layout">
      <Sidebar setPage={setPage} />

      <div className="main-content">
        <div className="page-shell">
          <div className="topbar">
            <div>
              <p className="eyebrow">Department Dashboard</p>
              <h1 className="page-title">Academic Timetable Studio</h1>
            </div>

            <div className="selection-panel">
              <label className="selection-field">
                <span>Department</span>
                <select value={department} onChange={(e) => setDepartment(e.target.value)}>
                  <option value="ECS">ECS</option>
                  <option value="COMP">COMP</option>
                  <option value="MECH">MECH</option>
                  <option value="CIVIL">CIVIL</option>
                  <option value="SCIENCE_HUMANITIES">Science & Humanities</option>
                </select>
              </label>

              <label className="selection-field">
                <span>Year</span>
                <select value={year} onChange={(e) => setYear(e.target.value)}>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                </select>
              </label>

              <label className="selection-field">
                <span>Semester</span>
                <select value={semester} onChange={(e) => setSemester(e.target.value)}>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="5">5</option>
                  <option value="6">6</option>
                  <option value="7">7</option>
                  <option value="8">8</option>
                </select>
              </label>
            </div>
          </div>

          <div className="content-card">{renderPage()}</div>
        </div>
      </div>
    </div>
  );
}

export default App;