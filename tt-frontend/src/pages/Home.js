import React from "react";
import "../styles/home.css";

function Home() {
  return (
    <div className="home-container">
      
      {/* Welcome Text */}
      <h1 className="welcome-text">
        Welcome, Admin
      </h1>

      {/* Highlighted Purple Box */}
      <div className="highlight-box">
        <h2>Academic Timetable Generation</h2>
        <p>& Management</p>
      </div>

    </div>
  );
}

export default Home;