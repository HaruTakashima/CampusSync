const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const path = require("path");
const app = express();
const rootDir = __dirname;

app.use(cors());
app.use(express.json());
app.use(express.static(rootDir));

app.get("/", (req, res) => {
res.sendFile(path.join(rootDir, "index.html"));
});

//Creates a Database if there is none, with the Table
const db = new sqlite3.Database(
path.join(rootDir, "Database", "attendance.db")
);

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

// Find the use of this but its mostly Port or Liveserver 
app.listen(3000, "0.0.0.0", () => {
console.log("Server running on port 3000");
});

//dito nalang kesa taas ng const db = new sqlite3.d... from Csv to Xlsx lang naman to)
app.get("/api/export", (req, res) => {

db.all(
"SELECT * FROM attendance ORDER BY id DESC",
[],
(err, rows) => {

if(err){
return res.status(500).json({
error: err.message
});
}

const worksheet =
XLSX.utils.json_to_sheet(rows);

const workbook =
XLSX.utils.book_new();

XLSX.utils.book_append_sheet(
workbook,
worksheet,
"Attendance"
);

const filePath =
"./Attendance_Report.xlsx";

XLSX.writeFile(
workbook,
filePath
);

res.download(filePath);

}
);
});


// This is the Time-In API 
app.post("/api/timein", (req, res) => {

const {
student_id,
fullname,
course
} = req.body;

db.get(
`
SELECT *
FROM attendance
WHERE student_id = ?
AND time_out IS NULL
`,
[student_id],
(err, existing) => {

if(err){
return res.status(500).json({
error: err.message
});
}

if(existing){
return res.status(400).json({
message: "Student already timed in."
});
}

let now = new Date();
let date = now.toISOString().split("T")[0];
let time = now.toLocaleTimeString("en-GB");

db.run(
`
INSERT INTO attendance
(
student_id,
fullname,
course,
attendance_date,
time_in
)
VALUES
(
?,
?,
?,
?,
?
)
`,
[
student_id,
fullname,
course,
date,
time
],
function(err){

if(err){
return res.status(500).json({
error: err.message
});
}

res.json({
message:"Time In Recorded"
});
}
);
}
);
});

//Time out naman to
app.post("/api/timeout", (req, res) => {

const { student_id } = req.body;

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

if(err){
return res.status(500).json({
error: err.message
});
}

if(!row){
return res.status(404).json({
message: "No active time-in found"
});
}

let now = new Date();

let currentTime =
now.toTimeString().split(" ")[0];

let start =
new Date(
`1970-01-01T${row.time_in}`
);

let end =
new Date(
`1970-01-01T${currentTime}`
);

let hours =
((end - start) / 1000 / 60 / 60)
.toFixed(2);

db.run(
`
UPDATE attendance
SET
time_out = ?,
total_hours = ?
WHERE id = ?
`,
[
currentTime,
hours,
row.id
],
function(err){

if(err){
return res.status(500).json({
error: err.message
});
}

res.json({
message: "Time Out Recorded"
});

}
);

}
);
});

//Attendance API toh
app.get("/api/attendance", (req,res)=>{

db.all(
"SELECT * FROM attendance ORDER BY id DESC",
[],
(err, rows)=>{

if(err){
return res.status(500)
.json({error: err.message});
}

res.json(rows);
}
);
});

const XLSX = require("xlsx");