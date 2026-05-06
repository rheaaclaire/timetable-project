import { useState } from "react";
import API from "../services/api";
import TimetableTable from "../components/TimetableTable";

export default function FacultyTimetable() {
  const [faculty, setFaculty] = useState("");
  const [slots, setSlots] = useState([]);
  const [message, setMessage] = useState("");

  const fetchFacultyTimetable = async () => {
    if (!faculty.trim()) {
      setMessage("Please enter faculty name.");
      return;
    }

    try {
      const res = await API.get("/timetable/teacher-timetable", {
  params: { faculty }
});

      const nextSlots = res.data.slots || res.data || [];

      setSlots(nextSlots);
      setMessage(
        nextSlots.length
          ? ""
          : "No timetable found for this faculty."
      );
    } catch (err) {
      setSlots([]);
      setMessage(err.response?.data?.message || "Failed to load faculty timetable");
    }
  };

  return (
    <div className="page-section">
      <div className="section-heading">
        <p className="section-kicker">Faculty View</p>
        <h2>Individual Faculty Timetable</h2>
        <p className="section-copy">
          Search a teacher and view all generated slots assigned to them.
        </p>
      </div>

      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <input
          type="text"
          value={faculty}
          placeholder="Enter faculty name"
          onChange={(e) => setFaculty(e.target.value)}
        />

        <button className="primary-button" onClick={fetchFacultyTimetable}>
          View Faculty Timetable
        </button>
      </div>

      {message && <p className="status-message">{message}</p>}

      {slots.length > 0 && (
        <>
          <h3>{faculty}'s Timetable</h3>
          <TimetableTable slots={slots} />
        </>
      )}
    </div>
  );
}