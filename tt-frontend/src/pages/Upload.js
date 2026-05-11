import React, { useState } from "react";
import api from "../services/api";

function Upload({ department, year, semester }) {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setMessage("");
  };

  const uploadFile = async () => {
    if (!file) {
      alert("Please select an Excel file");
      return;
    }

    try {
      const formData = new FormData();

      formData.append("file", file);
      formData.append("department", department);
      formData.append("year", year);
      formData.append("semester", semester);

      const res = await api.post("/upload-subjects", formData);

      setMessage(
        `Uploaded ${res.data.uploaded} subjects for ${department}, Year ${year}, Semester ${semester}`
      );
    } catch (err) {
      console.error("UPLOAD ERROR:", err);
      setMessage(err.response?.data?.message || "Upload failed");
    }
  };

  return (
    <div className="page-section">
      <div className="section-heading">
        <p className="section-kicker">Data Import</p>
        <h2>Upload Subjects</h2>
        <p className="section-copy">
          Selected target: {department}, Year {year}, Semester {semester}.
          Upload the sheet that matches this department and semester.
        </p>
      </div>

      <div className="action-panel">
        <input
          className="file-input"
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
        />

        <button className="primary-button" onClick={uploadFile}>
          Upload Excel
        </button>
      </div>

      <p className="section-copy">
        Accepted columns: subject/course name, hours or L/T/P, type, and faculty.
      </p>

      {message && <p className="status-message">{message}</p>}
    </div>
  );
}

export default Upload;
