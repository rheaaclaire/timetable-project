import { useState } from "react";
import API from "../services/api";

export default function Generate({ department, year, semester, onGenerated }) {
  const [msg, setMsg] = useState("");
  const [previewReady, setPreviewReady] = useState(false);
  const [previewCount, setPreviewCount] = useState(0);

  const generatePreview = async () => {
    try {
      const res = await API.post("/preview-timetable", {
        department,
        year: Number(year),
        semester: Number(semester)
      });

      const count = res.data.inserted !== undefined ? res.data.inserted : 0;
      setPreviewReady(true);
      setPreviewCount(count);
      setMsg(`Preview ready with ${count} slots. Save to store this timetable in the database.`);
    } catch (err) {
      setPreviewReady(false);
      setPreviewCount(0);
      setMsg(err.response?.data?.message || "Generation failed");
    }
  };

  const saveTimetable = async () => {
    try {
      const res = await API.post("/save-timetable", {
        department,
        year: Number(year),
        semester: Number(semester)
      });

      setMsg(
        res.data.inserted !== undefined
          ? `Saved ${res.data.inserted} timetable slots`
          : "Timetable saved"
      );
      onGenerated?.();
    } catch (err) {
      setMsg(err.response?.data?.message || "Save failed");
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
        <button className="primary-button" onClick={generatePreview}>
          Generate Timetable
        </button>
        {previewReady && (
          <button className="secondary-button" onClick={saveTimetable}>
            Save Timetable
          </button>
        )}
      </div>

      {previewReady && <p className="section-copy">Preview slot count: {previewCount}</p>}
      {msg && <p className="status-message">{msg}</p>}
    </div>
  );
}
