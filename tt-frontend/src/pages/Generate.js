import { useState } from "react";
import API from "../services/api";

export default function Generate({ department, year, semester, onGenerated }) {
  const [msg, setMsg] = useState("");

  const generate = async () => {
    try {
      const res = await API.post("/generate-timetable", {
        department,
        year: Number(year),
        semester: Number(semester)
      });

      setMsg(
        res.data.inserted !== undefined
          ? `Generated ${res.data.inserted} slots`
          : "Generated but count unavailable"
      );
      onGenerated?.();
    } catch (err) {
      setMsg(err.response?.data?.message || "Generation failed");
    }
  };

  return (
    <div className="page-section">
      <div className="section-heading">
        <p className="section-kicker">Scheduler</p>
        <h2>Generate Timetable</h2>
        <p className="section-copy">
          Build a timetable for {department}, Year {year}, Semester {semester} using the current constraints and uploaded load sheet.
        </p>
      </div>

      <div className="action-panel">
        <button className="primary-button" onClick={generate}>
          Generate Timetable
        </button>
      </div>

      {msg && <p className="status-message">{msg}</p>}
    </div>
  );
}
