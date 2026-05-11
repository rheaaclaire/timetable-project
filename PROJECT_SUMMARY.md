# Timetable Project Summary

## Overview

This project is an academic timetable studio with a React frontend and an Express/MySQL backend. Users select a department, year, and semester, upload an Excel load sheet, generate a weekly timetable, and view the saved timetable grid.

The frontend runs on `http://localhost:3000` through Create React App. The backend runs on `http://localhost:5001` and exposes JSON/Excel APIs under `/api`.

## Frontend

The frontend lives in `tt-frontend`.

- `src/App.js` owns the selected department/year/semester and switches between pages.
- `src/pages/Upload.js` uploads an Excel file to `/api/upload-subjects`.
- `src/pages/Generate.js` calls `/api/generate-timetable`.
- `src/pages/ViewTimetable.js` fetches `/api/timetable` and renders the grid.
- `src/components/TimetableTable.js` and `src/components/TimetableCell.js` render timetable rows.
- `src/services/api.js` configures Axios with `http://localhost:5001/api`.

## Backend

The backend lives in `tt backend`.

- `server.js` creates the Express app, enables CORS/JSON, and mounts API routes.
- `config/db.js` creates the MySQL pool from `.env` values.
- `routes/academicRoutes.js` exposes upload, subject fetch, generation, and timetable fetch endpoints.
- `controllers/academicController.js` parses uploaded Excel rows, stores subjects, generates timetable rows, and reads saved data.
- `services/slotEngine.js` contains the generic scheduling engine.
- `services/compSlotEngine.js` contains COMP-specific scheduling behavior.
- `controllers/exportController.js` exports timetable rows to `.xlsx`.
- `controllers/facultyController.js` supports faculty slot locking.

## API Endpoints

- `POST /api/upload-subjects`
  - Multipart form field: `file`
  - Body fields: `department`, `year`, `semester`
  - Replaces subjects and old timetable rows for that selected context.

- `GET /api/subjects?department=ECS&year=2&semester=3`
  - Returns uploaded subjects for the selected context.

- `POST /api/generate-timetable`
  - JSON body: `{ "department": "ECS", "year": 2, "semester": 3 }`
  - Generates and saves timetable slots.

- `GET /api/timetable?department=ECS&year=2&semester=3`
  - Returns saved timetable slots.

- `GET /api/export-timetable?department=ECS&year=2&semester=3`
  - Downloads the saved timetable as an Excel file.

- `POST /api/assign-faculty`
  - Locks a faculty member for a specific year/semester/day/time.

## Database

MySQL is required. Copy `tt backend/.env.example` to `tt backend/.env` and set the actual local credentials:

```env
PORT=5001
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=timetable_db
```

Create the required tables with:

```bash
mysql -u root < "tt backend/db/schema.sql"
```

The key tables are:

- `subjects`: uploaded course/load-sheet rows.
- `timetable_slots`: generated timetable cells.
- `faculty`, `faculty_slots`, `faculty_subjects`: faculty locking/support data.

## Excel Upload Format

The upload parser accepts common column names. A sheet should include:

- Subject name: `subject`, `course`, `course name`, `name`, or `subject name`
- Hours: `hours`, `hours per week`, `hours_per_week`, or `hrs`
- Optional split hours: `L`, `T`, `P`
- Optional type: `type`
- Optional faculty: `faculty`, `faculty name`, or `teacher`

If `hours` is missing, the backend can calculate hours from `L + T + P`. Rows without a subject name or usable hours are skipped. If no valid rows remain, upload returns a `400` response.

## Run Instructions

Backend:

```bash
cd "tt backend"
npm install
copy .env.example .env
node server.js
```

Frontend:

```bash
cd tt-frontend
npm install
npm start
```

## Troubleshooting

### Upload returns 500 with `ER_ACCESS_DENIED_ERROR`

This means MySQL rejected the configured database login, for example:

```text
Access denied for user 'root'@'localhost' (using password: YES)
```

Fix `tt backend/.env` so `DB_USER` and `DB_PASSWORD` match your real MySQL account, or grant that user access to `timetable_db`. If your MySQL user has no password, leave `DB_PASSWORD=` blank. The backend now verifies the connection at startup and logs a clearer message when credentials fail.

### Upload says columns did not match

Check that the Excel sheet has a subject/course-name column and either an hours column or `L`, `T`, and `P` columns.

### Generate says no subjects found

Upload subjects for the exact selected department, year, and semester first. The app stores each load sheet by that context.
