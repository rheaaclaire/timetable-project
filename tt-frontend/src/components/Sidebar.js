import React from "react";

function Sidebar({ setPage, user, onLogout }) {
  const role = user?.role || "student";

  const items =
    role === "admin"
      ? [
          { id: "home", label: "Dashboard" },
          { id: "upload", label: "Upload" },
          { id: "generate", label: "Generate" },
          { id: "view", label: "View Timetable" },
          { id: "calendar", label: "Academic Calendar" }
        ]
      : role === "teacher"
      ? [
          { id: "teacher", label: "My Timetable" },
          { id: "calendar", label: "Academic Calendar" }
        ]
      : [
          { id: "view", label: "View Timetable" },
          { id: "calendar", label: "Academic Calendar" }
        ];

  return (
    <div className="sidebar">
      <div className="sidebar-brand">
        <p className="sidebar-kicker">DBCE ECS</p>

        <h2>Timetable Hub</h2>

        <p className="sidebar-copy">
          Manage saved schedules with role-based access for admins,
          teachers, and students.
        </p>
      </div>

      <div className="user-chip">
        <strong>{user?.name}</strong>

        <span>{role}</span>
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

        <button
          className="sidebar-button sidebar-button-muted"
          onClick={onLogout}
        >
          Logout
        </button>
      </div>
    </div>
  );
}

export default Sidebar;