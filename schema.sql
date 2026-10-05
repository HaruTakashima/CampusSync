CREATE TABLE attendance (
id INTEGER PRIMARY KEY AUTOINCREMENT,
student_id TEXT NOT NULL,
fullname TEXT NOT NULL,
course TEXT,
attendance_date TEXT NOT NULL,
time_in TEXT,
time_out TEXT,
total_hours REAL
);