import React, { useState } from "react";
import API from "../services/api";

function Login({ onLogin }) {
  const [email, setEmail] = useState("admin@dbce.com");
  const [password, setPassword] = useState("admin123");
  const [message, setMessage] = useState("");

  const login = async (event) => {
    event.preventDefault();
    setMessage("");

    try {
      const res = await API.post("/auth/login", { email, password });
      onLogin(res.data.user);
    } catch (err) {
      setMessage(err.response?.data?.message || "Login failed");
    }
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={login}>
        <p className="section-kicker">Secure Access</p>
        <h1>Timetable Hub Login</h1>
        <p className="section-copy">
          Use an admin, teacher, or student account to open the correct dashboard.
        </p>

        <label className="selection-field">
          <span>Email</span>
          <input value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>

        <label className="selection-field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        <button className="primary-button" type="submit">Login</button>
        {message && <p className="status-message">{message}</p>}

        <div className="credential-box">
          <strong>Demo IDs</strong>
          <span>Admin: admin@dbce.com / admin123</span>
          <span>Student: student@dbce.com / student123</span>
          <span>Teachers: faculty email / teacher123</span>
        </div>
      </form>
    </div>
  );
}

export default Login;
