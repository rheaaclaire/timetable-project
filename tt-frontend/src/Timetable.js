import { useState } from "react";

function Timetable() {
  const [year, setYear] = useState(2);
  const [semester, setSemester] = useState(3);
  const [rows, setRows] = useState([]);

  const loadTimetable = () => {
    fetch(`http://localhost:5001/api/timetable?year=2&semester=3`)
      .then(res => res.json())
      .then(data => {
        setRows(data.timetable || []);
      })
      .catch(err => console.error(err));
  };

  return (
    <div>
      <h2>My Timetable</h2>

      {/* Controls */}
      <div style={{ marginBottom: "10px" }}>
        <label>Year: </label>
        <select value={year} onChange={e => setYear(e.target.value)}>
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
          <option value="4">4</option>
        </select>

        <label style={{ marginLeft: "10px" }}>Semester: </label>
        <select value={semester} onChange={e => setSemester(e.target.value)}>
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
          <option value="4">4</option>
          <option value="5">5</option>
          <option value="6">6</option>
        </select>

        <button
          onClick={loadTimetable}
          style={{ marginLeft: "10px" }}
        >
          Load Timetable
        </button>
      </div>

      {/* Table */}
      <table border="1" cellPadding="8">
        <thead>
          <tr>
            <th>Day</th>
            <th>Time</th>
            <th>Subject</th>
            <th>Faculty</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{r.day}</td>
              <td>{r.time}</td>
              <td>{r.subject || "-"}</td>
              <td>{r.faculty || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Timetable;