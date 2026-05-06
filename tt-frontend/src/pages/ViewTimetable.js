import { useEffect, useState } from "react";
import API from "../services/api";
import TimetableTable from "../components/TimetableTable";

export default function ViewTimetable({ department, year, semester, refreshToken, onRefresh }) {
  const [slots, setSlots] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    API.get("/timetable", {
      params: { department, year: Number(year), semester: Number(semester) }
    })
      .then((res) => {
        const nextSlots = res.data.slots || [];
        setSlots(nextSlots);
        setMessage(
          nextSlots.length
            ? ""
            : "No timetable rows found for this department/year/semester yet. Upload and generate first."
        );
      })
      .catch((err) => {
        setSlots([]);
        setMessage(err.response?.data?.message || "Failed to load timetable");
      });
  }, [department, refreshToken, semester, year]);

  const downloadTimetable = async () => {
    try {
      const res = await API.get("/export-timetable", {
        params: {
          department,
          year: Number(year),
          semester: Number(semester)
        },
        responseType: "blob"
      });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");

      link.href = url;
      link.setAttribute(
        "download",
        `${department}_Y${year}_S${semester}_Timetable.xlsx`
      );

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);
      setMessage("Timetable downloaded successfully.");
    } catch (err) {
      setMessage(err.response?.data?.message || "Download failed");
    }
  };

  return (
    <div className="page-section">
      <div className="section-heading section-heading-row">
        <div>
          <p className="section-kicker">Weekly Grid</p>
          <h2>View Timetable</h2>
          <p className="section-copy">
            Viewing {department}, Year {year}, Semester {semester}
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button className="secondary-button" onClick={() => onRefresh?.()}>
            Refresh Timetable
          </button>

          <button className="secondary-button" onClick={downloadTimetable}>
            Download Excel
          </button>
        </div>
      </div>

      {message && <p className="status-message">{message}</p>}
      <TimetableTable slots={slots} year={year} semester={semester} />
    </div>
  );
}