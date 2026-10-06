const express = require("express");
const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const XLSX = require("xlsx");

const app = express();
const PORT = 3000;

const rootDir = __dirname;
const frontEndDir = path.join(rootDir, "FrontEnd");
const databaseDir = path.join(rootDir, "Database");
const databaseFile = path.join(databaseDir, "attendance.db");
const exportFilePath = path.join(rootDir, "Attendance_Report.xlsx");

fs.mkdirSync(databaseDir, { recursive: true });

app.use(cors());
app.use(express.json());
app.use(express.static(frontEndDir));

app.get("/", (req, res) => {
  res.sendFile(path.join(frontEndDir, "HTML+CSS+JS.html"));
});

const db = new sqlite3.Database(databaseFile);

const initializeDatabase = () => {
  db.run(`
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id TEXT NOT NULL,
      fullname TEXT NOT NULL,
      course TEXT,
      attendance_date TEXT NOT NULL,
      time_in TEXT,
      time_out TEXT,
      total_hours REAL
    )
  `);
};

const getCurrentDate = () => new Date().toISOString().split("T")[0];
const getCurrentTime = () => new Date().toLocaleTimeString("en-GB");

const parseTimeValue = (timeString) => {
  if (!timeString) {
    return null;
  }

  const [hours, minutes, seconds = "0"] = timeString.split(":");
  return new Date(1970, 0, 1, Number(hours), Number(minutes), Number(seconds));
};

initializeDatabase();

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});

app.get("/api/export", (req, res) => {
  db.all("SELECT * FROM attendance ORDER BY id DESC", (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance");
    XLSX.writeFile(workbook, exportFilePath);

    return res.download(exportFilePath);
  });
});

app.post("/api/timein", (req, res) => {
  const { student_id, fullname, course } = req.body;

  if (!student_id || !fullname) {
    return res.status(400).json({ message: "student_id and fullname are required." });
  }

  db.get(
    "SELECT * FROM attendance WHERE student_id = ? AND time_out IS NULL",
    [student_id],
    (err, existing) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (existing) {
        return res.status(400).json({ message: "Student already timed in." });
      }

      const date = getCurrentDate();
      const time = getCurrentTime();

      db.run(
        `
          INSERT INTO attendance (
            student_id,
            fullname,
            course,
            attendance_date,
            time_in
          ) VALUES (?, ?, ?, ?, ?)
        `,
        [student_id, fullname, course, date, time],
        (runErr) => {
          if (runErr) {
            return res.status(500).json({ error: runErr.message });
          }

          return res.json({ message: "Time In Recorded" });
        }
      );
    }
  );
});

app.post("/api/timeout", (req, res) => {
  const { student_id } = req.body;

  if (!student_id) {
    return res.status(400).json({ message: "student_id is required." });
  }

  db.get(
    `
      SELECT *
      FROM attendance
      WHERE student_id = ?
      AND time_out IS NULL
      ORDER BY id DESC
      LIMIT 1
    `,
    [student_id],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (!row) {
        return res.status(404).json({ message: "No active time-in found" });
      }

      const currentTime = getCurrentTime();
      const startTime = parseTimeValue(row.time_in);
      const endTime = parseTimeValue(currentTime);
      const hours = (((endTime - startTime) / 1000 / 60 / 60) || 0).toFixed(2);

      db.run(
        `
          UPDATE attendance
          SET time_out = ?, total_hours = ?
          WHERE id = ?
        `,
        [currentTime, hours, row.id],
        (runErr) => {
          if (runErr) {
            return res.status(500).json({ error: runErr.message });
          }

          return res.json({ message: "Time Out Recorded" });
        }
      );
    }
  );
});

app.get("/api/attendance", (req, res) => {
  db.all("SELECT * FROM attendance ORDER BY id DESC", (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    return res.json(rows);
  });
});
