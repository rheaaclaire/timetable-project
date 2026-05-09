import { useEffect, useState } from "react";
import API from "../services/api";
import TimetableTable from "../components/TimetableTable";

export default function ViewTimetable({
  department,
  year,
  semester,
  refreshToken,
  onRefresh,
  canEdit = false,
  canExport = false
}) {
  const [slots, setSlots] = useState([]);
  const [message, setMessage] = useState("");
  const [swapMode, setSwapMode] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState([]);

  const refreshTimetable = () => {
    onRefresh?.();
  };

  const exportTimetable = () => {
    const params = new URLSearchParams({
      department,
      year: Number(year),
      semester: Number(semester)
    });

    window.open(`${API.defaults.baseURL}/export-timetable?${params.toString()}`, "_blank");
  };

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

  useEffect(() => {
    setSwapMode(false);
    setSelectedSlots([]);
  }, [department, semester, year]);

  const selectSwapSlot = async (slot) => {
    const exists = selectedSlots.some((selected) => selected.day === slot.day && selected.time === slot.time);
    const nextSelection = exists
      ? selectedSlots.filter((selected) => selected.day !== slot.day || selected.time !== slot.time)
      : [...selectedSlots, slot].slice(-2);

    setSelectedSlots(nextSelection);

    if (nextSelection.length !== 2) {
      setMessage("Select one more occupied slot to swap.");
      return;
    }

    try {
      await API.post("/swap-slots", {
        department,
        year: Number(year),
        semester: Number(semester),
        first: { day: nextSelection[0].day, time: nextSelection[0].time },
        second: { day: nextSelection[1].day, time: nextSelection[1].time }
      });

      setMessage("Slots swapped successfully.");
      setSelectedSlots([]);
      refreshTimetable();
    } catch (err) {
      setMessage(err.response?.data?.message || "Swap failed");
      setSelectedSlots([]);
    }
  };

  return (
    <div className="page-section">
      <div className="section-heading section-heading-row">
        <div>
          <p className="section-kicker">Weekly Grid</p>
          <h2>View Timetable</h2>
          <p className="section-copy">Viewing {department}, Year {year}, Semester {semester}</p>
        </div>
        <div className="action-panel">
          {canEdit && (
            <button
              className={swapMode ? "primary-button" : "secondary-button"}
              onClick={() => {
                setSwapMode((value) => !value);
                setSelectedSlots([]);
                setMessage(!swapMode ? "Swap mode on. Select two occupied slots." : "");
              }}
            >
              Swap Slots
            </button>
          )}
          {canExport && (
            <button className="secondary-button" onClick={exportTimetable}>
              Export Excel
            </button>
          )}
          <button className="secondary-button" onClick={refreshTimetable}>
            Refresh Timetable
          </button>
        </div>
      </div>

      {message && <p className="status-message">{message}</p>}
      <TimetableTable
        slots={slots}
        year={year}
        semester={semester}
        swapMode={swapMode}
        selectedSlots={selectedSlots}
        onCellSelect={selectSwapSlot}
      />
    </div>
  );
}
