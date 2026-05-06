import React from "react";

function Sidebar({ setPage }) {
  const items = [
  { id: "home", label: "Home" },
  { id: "upload", label: "Upload" },
  { id: "generate", label: "Generate" },
  { id: "view", label: "View Timetable" },
  { id: "faculty", label: "Faculty Timetable" }
];

  return (
    <div className="sidebar">
      <div className="sidebar-brand">
        <p className="sidebar-kicker">DBCE ECS</p>
        <h2>Timetable Hub</h2>
        <p className="sidebar-copy">
          Manage uploads, generate semester schedules, and review the weekly grid in one place.
        </p>
      </div>

      <div className="sidebar-nav">
        {items.map((item) => (
          <button
            key={item.id}
            className="sidebar-button"
            onClick={() => setPage(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default Sidebar;
