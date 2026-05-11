import { useEffect, useState } from "react";
import API from "../services/api";
import TimetableTable from "../components/TimetableTable";

export default function Generate({ department, year, semester, onGenerated }) {
  const [msg, setMsg] = useState("");
  const [previewReady, setPreviewReady] = useState(false);
  const [previewCount, setPreviewCount] = useState(0);
  const [previewSlots, setPreviewSlots] = useState([]);

  useEffect(() => {
    setMsg("");
    setPreviewReady(false);
    setPreviewCount(0);
    setPreviewSlots([]);
  }, [department, semester, year]);

  const getErrorMessage = (err, fallback) => {
    if (err.response?.status === 404) {
      return "Backend is running old code. Restart the backend from the tt backend folder, then try again.";
    }

    return err.response?.data?.message || fallback;
  };

  const generatePreview = async () => {
    try {
      const res = await API.post("/preview-timetable", {
        department,
        year: Number(year),
        semester: Number(semester)
      });

      const count = res.data.inserted !== undefined ? res.data.inserted : 0;
      const slots = res.data.slots || [];
      setPreviewReady(true);
      setPreviewCount(count);
      setPreviewSlots(slots);
      setMsg(`Preview ready with ${count} slots. Review it here, then save when you are happy with it.`);
    } catch (err) {
      setPreviewReady(false);
      setPreviewCount(0);
      setPreviewSlots([]);
      setMsg(getErrorMessage(err, "Generation failed"));
    }
  };

  const saveTimetable = async () => {
    try {
      const res = await API.post("/save-timetable", {
        department,
        year: Number(year),
        semester: Number(semester),
        slots: previewSlots
      });

      setMsg(
        res.data.inserted !== undefined
          ? `Saved ${res.data.inserted} timetable slots`
          : "Timetable saved"
      );
      onGenerated?.();
    } catch (err) {
      setMsg(getErrorMessage(err, "Save failed"));
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
        <button
          className="secondary-button"
          disabled={!previewReady}
          onClick={saveTimetable}
          title={previewReady ? "Save this preview" : "Generate a preview first"}
        >
          Save Timetable
        </button>
      </div>

      {previewReady && <p className="section-copy">Preview slot count: {previewCount}</p>}
      {msg && <p className="status-message">{msg}</p>}
      {previewReady && <TimetableTable slots={previewSlots} year={year} semester={semester} />}
    </div>
  );
}
