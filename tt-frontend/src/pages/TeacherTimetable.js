import { useCallback, useEffect, useRef, useState } from "react";
import API from "../services/api";

const DAY_ORDER = ["MON", "TUE", "WED", "THU", "FRI", "SAT"];
const REQUEST_TIMES = [
  "09:00-10:00",
  "10:00-11:00",
  "11:00-12:00",
  "11:15-12:15",
  "12:15-13:15",
  "13:00-14:00",
  "14:00-15:00",
  "15:00-16:00",
  "16:00-17:00"
];

function TeacherTimetable({ user }) {
  const [slots, setSlots] = useState([]);
  const [message, setMessage] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [availabilityMessage, setAvailabilityMessage] = useState("");
  const [availableFaculty, setAvailableFaculty] = useState([]);
  const [openRequests, setOpenRequests] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [notificationPermission, setNotificationPermission] = useState(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return "unsupported";
    }

    return window.Notification.permission;
  });
  const seenRequestIdsRef = useRef(new Set());
  const hasLoadedRequestsRef = useRef(false);
  const [requestForm, setRequestForm] = useState({
    department: user?.department || "ECS",
    year: "2",
    semester: "3",
    day: "MON",
    time: "09:00-10:00",
    subject: "",
    reason: ""
  });

  const loadTeacherTimetable = useCallback(() => {
    if (!user?.facultyName) {
      setSlots([]);
      setMessage("No faculty name is linked to this teacher account.");
      return;
    }

    API.get("/teacher-timetable", {
      params: { facultyName: user.facultyName }
    })
      .then((res) => {
        const nextSlots = res.data.slots || [];
        setSlots(nextSlots);
        setMessage(nextSlots.length ? "" : "No saved timetable slots found for this teacher yet.");
      })
      .catch((err) => {
        setSlots([]);
        setMessage(err.response?.data?.message || "Could not load teacher timetable.");
      });
  }, [user]);

  const showDesktopNotification = useCallback((request) => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return;
    }

    if (window.Notification.permission !== "granted") {
      return;
    }

    const requestSubject = request.subject || "Substitution request";
    const requestTime = [request.day, request.time].filter(Boolean).join(" ");

    try {
      new window.Notification("New faculty request", {
        body: `${request.requesterFaculty || "A faculty member"} needs cover for ${requestSubject}${requestTime ? ` on ${requestTime}` : ""}.`,
        tag: `faculty-request-${request.id}`,
        requireInteraction: true
      });
    } catch (error) {
      // Some browser settings can block notifications after permission changes.
    }
  }, []);

  const loadRequests = useCallback(() => {
    API.get("/faculty-requests", {
      params: { facultyName: user?.facultyName || "" }
    })
      .then((res) => {
        const nextOpenRequests = res.data.openRequests || [];
        const previousIds = seenRequestIdsRef.current;
        const isReadyToNotify = hasLoadedRequestsRef.current;

        if (isReadyToNotify) {
          nextOpenRequests
            .filter((request) => !previousIds.has(request.id))
            .forEach(showDesktopNotification);
        }

        seenRequestIdsRef.current = new Set(nextOpenRequests.map((request) => request.id));
        hasLoadedRequestsRef.current = true;
        setOpenRequests(nextOpenRequests);
        setMyRequests(res.data.myRequests || []);
      })
      .catch(() => {
        setOpenRequests([]);
        setMyRequests([]);
      });
  }, [showDesktopNotification, user]);

  useEffect(() => {
    loadTeacherTimetable();
    loadRequests();

    const requestRefresh = setInterval(loadRequests, 20000);
    return () => clearInterval(requestRefresh);
  }, [loadRequests, loadTeacherTimetable]);

  const updateRequestForm = (field, value) => {
    setRequestForm((current) => ({ ...current, [field]: value }));
  };

  const enableDesktopNotifications = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotificationPermission("unsupported");
      setRequestMessage("Desktop notifications are not supported in this browser.");
      return;
    }

    const permission = await window.Notification.requestPermission();
    setNotificationPermission(permission);

    if (permission === "granted") {
      setRequestMessage("Desktop notifications enabled. Keep this teacher page open to receive request alerts.");
      return;
    }

    if (permission === "denied") {
      setRequestMessage("Notifications are blocked in the browser. Allow notifications for localhost in browser settings to use this.");
      return;
    }

    setRequestMessage("Notifications were not enabled yet.");
  };

  const checkAvailability = async () => {
    try {
      const res = await API.get("/faculty-availability", {
        params: {
          department: requestForm.department,
          year: Number(requestForm.year),
          semester: Number(requestForm.semester),
          day: requestForm.day,
          time: requestForm.time
        }
      });
      const list = res.data.availableFaculty || [];
      setAvailableFaculty(list);
      setAvailabilityMessage(list.length ? "" : "No free faculty found for this slot.");
    } catch (err) {
      setAvailableFaculty([]);
      setAvailabilityMessage(err.response?.data?.message || "Could not check faculty availability.");
    }
  };

  const sendRequest = async () => {
    setRequestMessage("");

    try {
      await API.post("/faculty-requests", {
        ...requestForm,
        year: Number(requestForm.year),
        semester: Number(requestForm.semester),
        requesterName: user.name,
        requesterFaculty: user.facultyName
      });
      setRequestMessage("Request sent to all teacher dashboards.");
      setRequestForm((current) => ({ ...current, subject: "", reason: "" }));
      loadRequests();
    } catch (err) {
      setRequestMessage(err.response?.data?.message || "Could not send request.");
    }
  };

  const acceptRequest = async (requestId) => {
    try {
      await API.patch(`/faculty-requests/${requestId}/accept`, {
        responderName: user.name,
        responderFaculty: user.facultyName
      });
      setRequestMessage("Request accepted. The requester will see it on their dashboard.");
      loadRequests();
    } catch (err) {
      setRequestMessage(err.response?.data?.message || "Could not accept request.");
    }
  };

  const sortedSlots = [...slots].sort((left, right) => {
    return DAY_ORDER.indexOf(left.day) - DAY_ORDER.indexOf(right.day)
      || left.time.localeCompare(right.time)
      || String(left.department).localeCompare(String(right.department));
  });

  return (
    <div className="page-section">
      <div className="section-heading section-heading-row">
        <div>
          <p className="section-kicker">Teacher View</p>
          <h2>{user?.facultyName || user?.name}'s Timetable</h2>
          <p className="section-copy">
            View your saved classes, check free faculty, and send substitution requests.
          </p>
        </div>
        <button className="secondary-button" onClick={() => {
          loadTeacherTimetable();
          loadRequests();
        }}>
          Refresh
        </button>
      </div>

      {message && <p className="status-message">{message}</p>}

      <div className="timetable-wrap">
        <table className="timetable-table compact-table">
          <thead>
            <tr>
              <th>Day</th>
              <th>Time</th>
              <th>Department</th>
              <th>Year</th>
              <th>Semester</th>
              <th>Subject</th>
            </tr>
          </thead>
          <tbody>
            {sortedSlots.map((slot, index) => (
              <tr key={`${slot.department}-${slot.year}-${slot.semester}-${slot.day}-${slot.time}-${index}`}>
                <td className="day-label">{slot.day}</td>
                <td>{slot.time}</td>
                <td>{slot.department}</td>
                <td>{slot.year}</td>
                <td>{slot.semester}</td>
                <td>
                  <div className="slot-subject">{slot.subject}</div>
                  <div className="slot-faculty">{slot.faculty}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="page-section">
        <div className="section-heading">
          <p className="section-kicker">Availability</p>
          <h2>Find Free Faculty</h2>
          <p className="section-copy">
            Pick a day and slot to see who is not busy in saved timetables.
          </p>
        </div>

        <div className="action-panel">
          <label className="selection-field">
            <span>Department</span>
            <select value={requestForm.department} onChange={(event) => updateRequestForm("department", event.target.value)}>
              <option value="ECS">ECS</option>
              <option value="COMP">COMP</option>
              <option value="MECH">MECH</option>
              <option value="CIVIL">CIVIL</option>
              <option value="SCIENCE_HUMANITIES">Science & Humanities</option>
            </select>
          </label>
          <label className="selection-field">
            <span>Year</span>
            <select value={requestForm.year} onChange={(event) => updateRequestForm("year", event.target.value)}>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
            </select>
          </label>
          <label className="selection-field">
            <span>Semester</span>
            <select value={requestForm.semester} onChange={(event) => updateRequestForm("semester", event.target.value)}>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
              <option value="6">6</option>
              <option value="7">7</option>
              <option value="8">8</option>
            </select>
          </label>
          <label className="selection-field">
            <span>Day</span>
            <select value={requestForm.day} onChange={(event) => updateRequestForm("day", event.target.value)}>
              {DAY_ORDER.map((day) => <option key={day} value={day}>{day}</option>)}
            </select>
          </label>
          <label className="selection-field">
            <span>Time</span>
            <select value={requestForm.time} onChange={(event) => updateRequestForm("time", event.target.value)}>
              {REQUEST_TIMES.map((time) => <option key={time} value={time}>{time}</option>)}
            </select>
          </label>
          <button className="primary-button" onClick={checkAvailability}>Check Availability</button>
        </div>

        {availabilityMessage && <p className="status-message">{availabilityMessage}</p>}
        {!!availableFaculty.length && (
          <div className="status-message">
            <strong>Available Faculty:</strong> {availableFaculty.join(", ")}
          </div>
        )}
      </div>

      <div className="page-section">
        <div className="section-heading">
          <p className="section-kicker">Substitution Request</p>
          <h2>Ask Another Faculty To Cover</h2>
        </div>

        <div className="action-panel">
          <label className="selection-field request-field-wide">
            <span>Subject / Class</span>
            <input
              value={requestForm.subject}
              onChange={(event) => updateRequestForm("subject", event.target.value)}
              placeholder="Eg. Strength of Materials"
            />
          </label>
          <label className="selection-field request-field-wide">
            <span>Reason</span>
            <input
              value={requestForm.reason}
              onChange={(event) => updateRequestForm("reason", event.target.value)}
              placeholder="Eg. Not available for this hour"
            />
          </label>
          <button className="primary-button" onClick={sendRequest}>Send Request</button>
        </div>

        {requestMessage && <p className="status-message">{requestMessage}</p>}
      </div>

      <div className="page-section">
        <div className="section-heading">
          <p className="section-kicker">Notifications</p>
          <h2>Open Requests From Other Faculty</h2>
          <p className="section-copy">
            Enable desktop alerts to see new requests in your system notification bar while this page is open.
          </p>
        </div>

        <div className="notification-toolbar">
          <button
            className="secondary-button"
            onClick={enableDesktopNotifications}
            disabled={notificationPermission === "granted" || notificationPermission === "unsupported"}
          >
            {notificationPermission === "granted" ? "Desktop Notifications On" : "Enable Desktop Notifications"}
          </button>
          <span className={`notification-pill notification-${notificationPermission}`}>
            {notificationPermission === "unsupported" ? "Not supported" : notificationPermission}
          </span>
        </div>

        <div className="summary-list">
          {openRequests.length ? openRequests.map((request) => (
            <div className="summary-row request-row" key={request.id}>
              <strong>{request.subject}</strong>
              <span>{request.department} Y{request.year || "-"} S{request.semester || "-"}</span>
              <span>{request.day} {request.time}</span>
              <span>From {request.requesterFaculty}</span>
              <button className="secondary-button" onClick={() => acceptRequest(request.id)}>Accept</button>
            </div>
          )) : <p className="status-message">No open requests right now.</p>}
        </div>
      </div>

      <div className="page-section">
        <div className="section-heading">
          <p className="section-kicker">My Requests</p>
          <h2>Requests Sent By Me</h2>
        </div>

        <div className="summary-list">
          {myRequests.length ? myRequests.map((request) => (
            <div className="summary-row" key={request.id}>
              <strong>{request.subject}</strong>
              <span>{request.day} {request.time}</span>
              <span>{request.status}</span>
              <span>{request.responderFaculty ? `Accepted by ${request.responderFaculty}` : "Waiting"}</span>
            </div>
          )) : <p className="status-message">You have not sent any requests yet.</p>}
        </div>
      </div>
    </div>
  );
}

export default TeacherTimetable;
