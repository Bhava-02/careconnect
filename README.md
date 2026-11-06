# CareConnect – Healthcare Appointment Management System

MERN stack: MongoDB, Express.js, React, Node.js

## Users and what they can do

| Role | How they get an account | Can do |
|---|---|---|
| Patient | Creates an account on the website | Search doctors by name or department, view a doctor's profile, book a date and time, view and cancel appointments, view profile |
| Doctor | Added by the admin (or sample data) | Sign in with the stored email, see only their own patients and appointments, confirm and complete appointments, view their profile |
| Admin | Sample data | See all appointments, doctors and patients; add doctors; delete doctors, patients and appointments |

Only patients can create an account. Doctors and admins can sign in only with an email that is already stored in the database.

## Files

```
careconnect/
├── server/
│   ├── package.json
│   └── server.js          MongoDB connection, models, API routes, sample data
└── client/
    ├── package.json
    ├── vite.config.js     sends /api requests to the backend (port 5000)
    ├── index.html
    └── src/
        ├── main.jsx           starts React
        ├── App.jsx            shows the login page or the page for the user's role
        ├── api.js             fetch helper, date and time helpers
        ├── components.jsx     icons, doctor avatars, layout (sidebar / bottom bar), toast
        ├── Login.jsx          sign in (patient / doctor / admin) and create account (patients only)
        ├── PatientPage.jsx    home, doctor profile and booking, my appointments, profile
        ├── DoctorPage.jsx     schedule, my patients, profile
        ├── AdminPage.jsx      appointments, doctors, patients
        └── style.css          all styles, including phone layout
```

## Database

Database name: **careconnect_portal** (MongoDB on `mongodb://127.0.0.1:27017`)

| Collection | Fields |
|---|---|
| users | name, email, password (bcrypt hash), role (patient / doctor / admin), phone, age, gender; for doctors also specialization, qualification, experience, fee, availableDays, about |
| appointments | patient (ObjectId of user), doctor (ObjectId of user), date, time, reason, status (Pending / Confirmed / Completed) |

Sample doctors, patients and appointments are added automatically the first time the server starts.

## API

| Method | URL | Purpose |
|---|---|---|
| POST | /api/register | Create a patient account |
| POST | /api/login | Sign in (email, password, role) |
| GET | /api/doctors | All doctors with their patient count |
| POST | /api/doctors | Admin adds a doctor |
| GET | /api/patients | All patients (admin) |
| DELETE | /api/users/:id | Admin deletes a doctor or patient |
| GET | /api/appointments | All appointments, or `?patient=ID` / `?doctor=ID` |
| GET | /api/booked-times?doctor=ID&date=YYYY-MM-DD | Times already booked (those slots are disabled) |
| POST | /api/appointments | Book an appointment |
| PUT | /api/appointments/:id | Change status |
| DELETE | /api/appointments/:id | Cancel or delete an appointment |

## How to run

MongoDB must be running. Keep the project outside OneDrive if possible (for example `C:\Projects`).

Open the `careconnect` folder in VS Code (File > Open Folder).

Terminal 1 (backend)
```
cd server
npm install
npm start
```
Wait for `MongoDB connected (database: careconnect_portal)`.

Terminal 2 (frontend)
```
cd client
npm install
npm run dev
```
Open http://localhost:3000. Keep both terminals running.

## Login accounts

| Role | Email | Password |
|---|---|---|
| Admin | admin@careconnect.com | admin123 |
| Doctor | priya@careconnect.com (also arjun, kavya, rahul, meena @careconnect.com) | doctor123 |
| Patient | divya@example.com or karthik@example.com | patient123 |

## Showing database changes during the review

Every page reads fresh data from MongoDB. After changing the database, click the **refresh** button (circular arrow) or switch pages.

In MongoDB Compass, open the **MONGOSH** panel at the bottom and run:

```
use careconnect_portal

db.appointments.find()
db.users.find({ role: "doctor" })

// change a status -> shows for the patient, the doctor and the admin
db.appointments.updateOne({ reason: "BP follow-up" }, { $set: { status: "Confirmed" } })

// change a doctor's fee or working days -> shows on the doctor's profile and booking page
db.users.updateOne({ email: "priya@careconnect.com" }, { $set: { fee: 750, availableDays: ["Mon", "Tue", "Fri"] } })

// delete an appointment -> disappears from the website, and the time becomes free again
db.appointments.deleteOne({ reason: "Itchy rash on both hands" })

// add a doctor directly -> appears in the department list and doctor list
db.users.insertOne({ name: "Dr. Lakshmi Iyer", email: "lakshmi@careconnect.com", role: "doctor", gender: "Female", specialization: "ENT", experience: 9, fee: 450, availableDays: ["Tue", "Thu", "Sat"] })
```

A doctor added directly in the database has no password, so they cannot sign in. Use **Admin > Doctors > Add doctor** for doctors who need to log in.

To start again with fresh sample data: in Compass, delete the `careconnect_portal` database and restart the backend.

The Poppins font loads from Google Fonts when there is internet; without internet the app uses Segoe UI.
## Team
   - Bhavanitha Velusamy
   - Madhumitha Saravanan