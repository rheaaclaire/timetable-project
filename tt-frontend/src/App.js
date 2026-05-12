import React, { useEffect, useState } from "react";

import Sidebar from "./components/Sidebar";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Upload from "./pages/Upload";
import Generate from "./pages/Generate";
import ViewTimetable from "./pages/ViewTimetable";
import TeacherTimetable from "./pages/TeacherTimetable";
import AcademicCalendar from "./pages/AcademicCalendar";

import "./styles/layout.css";

function App() {
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem("tt-user");
    return storedUser ? JSON.parse(storedUser) : null;
  });

  const [page, setPage] = useState("home");

  const [department, setDepartment] = useState("ECS");
  const [year, setYear] = useState("2");
  const [semester, setSemester] = useState("3");

  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    if (!user) return;

    if (user.role === "teacher") {
      setPage("teacher");
      return;
    }

    if (user.role === "student") {
      setPage("view");
    }
  }, [user]);

  useEffect(() => {
    if (department === "SCIENCE_HUMANITIES") {
      setDepartment("ECS");
    }
  }, [department]);

  const login = (nextUser) => {
  localStorage.setItem("tt-user", JSON.stringify(nextUser));

  setUser(nextUser);

  setDepartment(nextUser.department || "ECS");

  if (nextUser.role === "student") {
    setPage("view");
  }
};

  const logout = () => {
    localStorage.removeItem("tt-user");

    setUser(null);

    setPage("home");
  };

  if (!user) {
    return <Login onLogin={login} />;
  }

  const role = user.role;

  const renderPage = () => {
    if (role === "teacher" && page === "teacher") {
      return <TeacherTimetable user={user} />;
    }

    if (page === "calendar") {
      return <AcademicCalendar />;
    }

    if (page === "home") {
      return <Home user={user} setPage={setPage} />;
    }

    if (role === "admin" && page === "upload") {
      return (
        <Upload
          department={department}
          year={year}
          semester={semester}
        />
      );
    }

    if (role === "admin" && page === "generate") {
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
          canEdit={role === "admin"}
          canExport={role === "admin"}
        />
      );
    }

    return <Home user={user} setPage={setPage} />;
  };

  return (
    <div className="app-layout">
      <Sidebar
        setPage={setPage}
        user={user}
        onLogout={logout}
      />

      <div className="main-content">
        <div className="page-shell">
          <div className="topbar">
            <div>
              <p className="eyebrow">
                {role} dashboard
              </p>

              <h1 className="page-title">
                Academic Timetable Studio
              </h1>
            </div>

            {role !== "teacher" && (
              <div className="selection-panel">
                <label className="selection-field">
                  <span>Department</span>

                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                  >
                    <option value="ECS">ECS</option>
                    <option value="COMP">COMP</option>
                    <option value="MECH">MECH</option>
                    <option value="CIVIL">CIVIL</option>
                  </select>
                </label>

                <label className="selection-field">
                  <span>Year</span>

                  <select
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                  >
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                  </select>
                </label>

                <label className="selection-field">
                  <span>Semester</span>

                  <select
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                  >
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
            )}
          </div>

          <div className="content-card">
            {renderPage()}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;