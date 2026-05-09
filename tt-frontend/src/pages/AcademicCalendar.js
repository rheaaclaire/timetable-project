import React, { useEffect, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import API from "../services/api";

function AcademicCalendar() {
  const user = JSON.parse(localStorage.getItem("tt-user"));
  const isAdmin = user?.role === "admin";

  const [events, setEvents] = useState([]);
  const [rawEvents, setRawEvents] = useState([]);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [type, setType] = useState("EVENT");

  const formatDateOnly = (value) => {
    if (!value) return "";
    return String(value).split("T")[0];
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const res = await API.get("/calendar");

      setRawEvents(res.data);

      const formattedEvents = res.data.map((event) => ({
        id: event.id,
        title: event.title,
        date: formatDateOnly(event.event_date),
        allDay: true,
        extendedProps: {
          description: event.description,
          event_type: event.event_type,
        },
      }));

      setEvents(formattedEvents);
    } catch (err) {
      console.error("Fetch calendar events error:", err);
      alert("Could not load calendar events");
    }
  };

  const addEvent = async () => {
    if (!title || !date || !type) {
      alert("Please enter event title, date, and type.");
      return;
    }

    try {
      await API.post("/calendar", {
        title: title,
        description: "",
        event_date: date,
        event_type: type,
        created_by: "admin",
      });

      alert("Event added successfully");

      setTitle("");
      setDate("");
      setType("EVENT");

      fetchEvents();
    } catch (err) {
      console.log("Add event error:", err);
      alert("Could not add event");
    }
  };

  const deleteEvent = async (id) => {
    const confirmDelete = window.confirm("Delete this event?");
    if (!confirmDelete) return;

    try {
      await API.delete(`/calendar/${id}`);
      fetchEvents();
    } catch (err) {
      console.log("Delete event error:", err);
      alert("Could not delete event");
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Academic Calendar</h2>

      {isAdmin && (
        <div
          style={{
            marginBottom: "20px",
            padding: "15px",
            border: "1px solid #ddd",
            borderRadius: "12px",
          }}
        >
          <h3>Add Calendar Event</h3>

          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
              marginBottom: "10px",
            }}
          >
            <input
              placeholder="Event Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />

            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="EVENT">EVENT</option>
              <option value="PUBLIC_HOLIDAY">PUBLIC HOLIDAY</option>
              <option value="IT_EXAM">IT EXAM</option>
              <option value="SEMESTER_START">SEMESTER START</option>
              <option value="SEMESTER_END">SEMESTER END</option>
            </select>

            <button onClick={addEvent}>Add Event</button>
          </div>

          <h3>Delete Event</h3>

          {rawEvents.length === 0 ? (
            <p>No events added yet.</p>
          ) : (
            rawEvents.map((event) => (
              <div
                key={event.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottom: "1px solid #eee",
                  padding: "8px 0",
                }}
              >
                <span>
                  {formatDateOnly(event.event_date)} — {event.event_type}:{" "}
                  {event.title}
                </span>

                <button onClick={() => deleteEvent(event.id)}>
                  Delete Event
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {!isAdmin && (
        <p style={{ marginBottom: "15px" }}>
          View-only academic calendar.
        </p>
      )}

      <FullCalendar
        plugins={[dayGridPlugin]}
        initialView="dayGridMonth"
        events={events}
        height="80vh"
        displayEventTime={false}
      />
    </div>
  );
}

export default AcademicCalendar;