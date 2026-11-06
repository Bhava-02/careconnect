// CareConnect - Backend (Node.js + Express + MongoDB)
require("dotenv").config(); // reads the database address from server/.env (not uploaded to GitHub)
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const dns = require("dns");
const path = require("path");
dns.setServers(["8.8.8.8", "1.1.1.1"]); // use Google/Cloudflare DNS so the Atlas address can be found

// Database address: MongoDB Atlas (cloud).
// To use the database on this laptop instead, use: "mongodb://127.0.0.1:27017/careconnect_portal"
const MONGO_URI = process.env.MONGO_URI;
const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" })); // larger limit so doctor photos can be uploaded

// ---------------- 1. CONNECT TO MONGODB ----------------
mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("MongoDB connected (database: careconnect_portal)");
    addSampleData();
  })
  .catch((err) => console.log("MongoDB connection error:", err.message));

// ---------------- 2. SCHEMAS AND MODELS ----------------
const ObjectId = mongoose.Schema.Types.ObjectId;

// One "users" collection stores patients, doctors and the admin.
// The "role" field decides what each user can see.
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["patient", "doctor", "admin"], default: "patient" },
    phone: String,
    age: Number,
    gender: String,
    // doctor details
    specialization: String,
    qualification: String,
    experience: Number,
    fee: Number,
    availableDays: [String], // e.g. ["Mon", "Wed", "Fri"]
    about: String,
    photo: String, // image link, e.g. "/doctors/priya.jpg", or an uploaded picture
  },
  { timestamps: true }
);

const appointmentSchema = new mongoose.Schema(
  {
    patient: { type: ObjectId, ref: "User", required: true },
    doctor: { type: ObjectId, ref: "User", required: true },
    date: { type: String, required: true }, // e.g. "2026-11-05"
    time: { type: String, required: true }, // e.g. "10:30"
    reason: String,
    status: { type: String, default: "Pending" }, // Pending, Confirmed, Completed, Cancelled
    cancelReason: String, // e.g. "Doctor on leave"
  },
  { timestamps: true }
);

// Days on which a doctor is on leave (no bookings allowed)
const leaveSchema = new mongoose.Schema(
  {
    doctor: { type: ObjectId, ref: "User", required: true },
    date: { type: String, required: true },
    reason: String,
  },
  { timestamps: true }
);

// Patients waiting for a booked time to become free ("Notify me")
// time is one slot (e.g. "10:30") or "any" for any time on that day
const waitlistSchema = new mongoose.Schema(
  {
    patient: { type: ObjectId, ref: "User", required: true },
    doctor: { type: ObjectId, ref: "User", required: true },
    date: { type: String, required: true },
    time: { type: String, required: true },
  },
  { timestamps: true }
);

// Messages shown under the bell icon
const notificationSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: "User", required: true }, // who receives it
    title: String,
    message: String,
    type: String, // booking, status, cancelled, slot-free, leave
    doctor: { type: ObjectId, ref: "User" }, // for "slot-free": the slot that can be booked
    date: String,
    time: String,
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Indexes make the common searches fast (MongoDB creates them once)
appointmentSchema.index({ doctor: 1, date: 1 });
appointmentSchema.index({ patient: 1 });
leaveSchema.index({ doctor: 1, date: 1 });
waitlistSchema.index({ doctor: 1, date: 1 });
notificationSchema.index({ user: 1, createdAt: -1 });

const User = mongoose.model("User", userSchema);
const Appointment = mongoose.model("Appointment", appointmentSchema);
const Leave = mongoose.model("Leave", leaveSchema);
const Waitlist = mongoose.model("Waitlist", waitlistSchema);
const Notification = mongoose.model("Notification", notificationSchema);

// ---------------- HELPERS ----------------
// Never send the password back to the browser
function withoutPassword(user) {
  const { password, ...details } = user.toObject();
  return details;
}

const todayDate = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD

// "2026-11-05" -> "Thu, 05 Nov"
function dayText(date) {
  return new Date(date + "T00:00").toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" });
}

// "14:30" -> "2:30 PM"
function timeText(time) {
  const [h, m] = String(time).split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

// Save a notification for one user
async function notify(user, title, message, extra = {}) {
  if (user) await Notification.create({ user, title, message, ...extra });
}

// A booked time became free: tell every patient waiting for that time
// or for any time on that day
async function notifySlotFree(doctor, date, time) {
  if (date < todayDate()) return;
  const doctorUser = await User.findById(doctor);
  const doctorName = doctorUser?.name || "The doctor";
  const waiting = await Waitlist.find({ doctor, date, time: { $in: [time, "any"] } });
  const notified = new Set(); // a patient waiting for both gets only one message
  for (const entry of waiting) {
    const id = String(entry.patient);
    if (notified.has(id)) continue;
    notified.add(id);
    const message = entry.time === "any"
      ? `A time is free on ${dayText(date)} with ${doctorName}: ${timeText(time)}. Book it before someone else does.`
      : `${doctorName}'s slot on ${dayText(date)} at ${timeText(time)} is free again. Book it before someone else does.`;
    await notify(entry.patient, "A booked time is free now", message, { type: "slot-free", doctor, date, time });
  }
  await Waitlist.deleteMany({ doctor, date, time: { $in: [time, "any"] } });
}

// ---------------- 3. CREATE ACCOUNT AND SIGN IN ----------------
// Only patients can create an account. Doctor and admin accounts are created by the clinic.
app.post("/api/register", async (req, res) => {
  const { name, email, phone, age, gender, password } = req.body;

  if (await User.findOne({ email })) {
    return res.status(400).json({ message: "This email is already registered. Please sign in." });
  }

  const user = await User.create({
    name, email, phone, age, gender,
    role: "patient",
    password: await bcrypt.hash(password, 10),
  });
  res.json(withoutPassword(user));
});

app.post("/api/login", async (req, res) => {
  const { email, password, role } = req.body;

  // The email must already be stored in the database with the selected role
  const user = await User.findOne({ email, role });
  if (!user) {
    const hint = role === "patient" ? "Please create an account first." : "Only accounts created by the clinic can sign in.";
    return res.status(400).json({ message: `No ${role} account found with this email. ${hint}` });
  }

  // A password typed directly into the database (with a query) is plain text.
  // It is checked once as plain text and then saved in hashed form.
  const isHashed = String(user.password).startsWith("$2");
  const correct = isHashed ? await bcrypt.compare(password, user.password) : password === user.password;
  if (!correct) {
    return res.status(400).json({ message: "Incorrect password. Please try again." });
  }
  if (!isHashed) {
    user.password = await bcrypt.hash(password, 10);
    await user.save();
  }
  res.json(withoutPassword(user));
});

// ---------------- 4. DOCTORS AND PATIENTS ----------------
app.get("/api/doctors", async (req, res) => {
  // Three queries run at the same time (instead of two queries for every doctor),
  // so the list loads quickly even from MongoDB Atlas
  const [doctors, patientCounts, leaves] = await Promise.all([
    User.find({ role: "doctor" }).select("-password").sort({ name: 1 }).lean(),
    // how many different patients booked with each doctor
    Appointment.aggregate([
      { $group: { _id: { doctor: "$doctor", patient: "$patient" } } },
      { $group: { _id: "$_id.doctor", count: { $sum: 1 } } },
    ]),
    // upcoming leave days of all doctors (these days cannot be booked)
    Leave.find({ date: { $gte: todayDate() } }).select("doctor date").sort({ date: 1 }).lean(),
  ]);

  for (const doctor of doctors) {
    const found = patientCounts.find((c) => String(c._id) === String(doctor._id));
    doctor.patientCount = found ? found.count : 0;
    doctor.leaveDates = leaves.filter((l) => String(l.doctor) === String(doctor._id)).map((l) => l.date);
  }
  res.json(doctors);
});

app.get("/api/patients", async (req, res) => {
  const patients = await User.find({ role: "patient" }).select("-password").sort({ createdAt: -1 });
  res.json(patients);
});

// Admin adds a new doctor
app.post("/api/doctors", async (req, res) => {
  if (await User.findOne({ email: req.body.email })) {
    return res.status(400).json({ message: "A user with this email already exists." });
  }
  const doctor = await User.create({
    ...req.body,
    role: "doctor",
    password: await bcrypt.hash(req.body.password, 10),
  });
  res.json(withoutPassword(doctor));
});

// Admin or the doctor changes the doctor's photo (send an empty photo to remove it)
app.put("/api/doctors/:id/photo", async (req, res) => {
  await User.updateOne({ _id: req.params.id }, { photo: req.body.photo });
  const doctor = await User.findById(req.params.id).select("-password");
  res.json(doctor);
});

// Admin deletes a doctor or patient (everything linked to them is deleted too)
app.delete("/api/users/:id", async (req, res) => {
  const id = req.params.id;
  await User.findByIdAndDelete(id);
  await Appointment.deleteMany({ $or: [{ patient: id }, { doctor: id }] });
  await Waitlist.deleteMany({ $or: [{ patient: id }, { doctor: id }] });
  await Leave.deleteMany({ doctor: id });
  await Notification.deleteMany({ user: id });
  res.json({ message: "User deleted" });
});

// ---------------- 5. APPOINTMENTS ----------------
// /api/appointments              -> all appointments (admin)
// /api/appointments?patient=ID   -> appointments of one patient
// /api/appointments?doctor=ID    -> appointments of one doctor
app.get("/api/appointments", async (req, res) => {
  const filter = {};
  if (req.query.patient) filter.patient = req.query.patient;
  if (req.query.doctor) filter.doctor = req.query.doctor;

  const appointments = await Appointment.find(filter)
    .populate("patient", "name phone age gender")
    .populate("doctor", "name specialization gender")
    .sort({ date: 1, time: 1 });
  res.json(appointments);
});

// What the booking page needs for one doctor on one date
app.get("/api/availability", async (req, res) => {
  const { doctor, date, patient } = req.query;
  const onLeave = await Leave.findOne({ doctor, date });
  const booked = await Appointment.find({ doctor, date, status: { $ne: "Cancelled" } }).select("time patient");
  const waiting = patient ? await Waitlist.find({ doctor, date, patient }).select("time") : [];
  res.json({
    onLeave: Boolean(onLeave),
    booked: booked.map((a) => a.time), // taken times
    mine: booked.filter((a) => String(a.patient) === patient).map((a) => a.time), // this patient's own bookings
    waiting: waiting.map((w) => w.time), // times this patient is waiting for ("any" = any time that day)
  });
});

// Patient books an appointment
app.post("/api/appointments", async (req, res) => {
  const { patient, doctor, date, time, reason } = req.body;

  if (await Leave.findOne({ doctor, date })) {
    return res.status(400).json({ message: "The doctor is on leave on this day. Please choose another date." });
  }
  // The same doctor cannot have two appointments at the same date and time
  if (await Appointment.findOne({ doctor, date, time, status: { $ne: "Cancelled" } })) {
    return res.status(400).json({ message: "This time was just booked by someone else. Tap it to get notified if it becomes free." });
  }

  const appointment = await Appointment.create({ patient, doctor, date, time, reason });
  // The patient got a time on this day, so they no longer need to wait for it
  await Waitlist.deleteMany({ patient, doctor, date, time: { $in: [time, "any"] } });

  const patientUser = await User.findById(patient);
  await notify(doctor, "New appointment request",
    `${patientUser?.name || "A patient"} booked ${dayText(date)} at ${timeText(time)}.`, { type: "booking" });
  res.json(appointment);
});

// Doctor changes the status (Confirmed / Completed)
app.put("/api/appointments/:id", async (req, res) => {
  const { status } = req.body;
  await Appointment.updateOne({ _id: req.params.id }, { status });
  const appointment = await Appointment.findById(req.params.id);
  if (appointment) {
    const doctorUser = await User.findById(appointment.doctor);
    const when = `${dayText(appointment.date)} at ${timeText(appointment.time)}`;
    if (status === "Confirmed") {
      await notify(appointment.patient, "Appointment confirmed", `${doctorUser?.name} confirmed your appointment on ${when}.`, { type: "status" });
    } else if (status === "Completed") {
      await notify(appointment.patient, "Visit completed", `Your visit with ${doctorUser?.name} on ${when} is marked as completed.`, { type: "status" });
    }
  }
  res.json(appointment);
});

// Patient cancels (?by=patient) or admin deletes (?by=admin) an appointment
app.delete("/api/appointments/:id", async (req, res) => {
  const appointment = await Appointment.findById(req.params.id);
  if (!appointment) return res.json({ message: "Appointment already deleted" });
  await Appointment.deleteOne({ _id: appointment._id });

  // If the appointment was still active, tell the people involved and free the time
  if (appointment.status === "Pending" || appointment.status === "Confirmed") {
    const patientUser = await User.findById(appointment.patient);
    const doctorUser = await User.findById(appointment.doctor);
    const when = `${dayText(appointment.date)} at ${timeText(appointment.time)}`;
    const byClinic = req.query.by === "admin";

    await notify(appointment.doctor, "Appointment cancelled",
      `${patientUser?.name || "A patient"}'s appointment on ${when} was cancelled${byClinic ? " by the clinic" : ""}.`, { type: "cancelled" });
    if (byClinic) {
      await notify(appointment.patient, "Appointment cancelled by the clinic",
        `Your appointment with ${doctorUser?.name || "the doctor"} on ${when} was cancelled by the clinic.`, { type: "cancelled" });
    }
    await notifySlotFree(appointment.doctor, appointment.date, appointment.time);
  }
  res.json({ message: "Appointment deleted" });
});

// ---------------- 6. WAITING LIST ("NOTIFY ME") ----------------
app.get("/api/waitlist", async (req, res) => {
  const list = await Waitlist.find({ patient: req.query.patient })
    .populate("doctor", "name specialization gender")
    .sort({ date: 1, time: 1 });
  res.json(list);
});

app.post("/api/waitlist", async (req, res) => {
  const { patient, doctor, date, time } = req.body;
  const existing = await Waitlist.findOne({ patient, doctor, date, time });
  res.json(existing || (await Waitlist.create({ patient, doctor, date, time })));
});

// Remove by id (from the waiting list page)
app.delete("/api/waitlist/:id", async (req, res) => {
  await Waitlist.findByIdAndDelete(req.params.id);
  res.json({ message: "Removed from waiting list" });
});

// Remove by slot (from the booking page)
app.delete("/api/waitlist", async (req, res) => {
  const { patient, doctor, date, time } = req.query;
  await Waitlist.deleteMany({ patient, doctor, date, time });
  res.json({ message: "Removed from waiting list" });
});

// ---------------- 7. DOCTOR LEAVE ----------------
// /api/leaves?doctor=ID -> one doctor's leave days, /api/leaves -> all (admin)
app.get("/api/leaves", async (req, res) => {
  const filter = req.query.doctor ? { doctor: req.query.doctor } : {};
  const leaves = await Leave.find(filter).populate("doctor", "name specialization").sort({ date: 1 });
  res.json(leaves);
});

// Doctor applies for leave: the day is blocked and that day's bookings are cancelled
app.post("/api/leaves", async (req, res) => {
  const { doctor, date, reason } = req.body;
  if (await Leave.findOne({ doctor, date })) {
    return res.status(400).json({ message: "You are already on leave on this day." });
  }
  const leave = await Leave.create({ doctor, date, reason });
  const doctorUser = await User.findById(doctor);

  const affected = await Appointment.find({ doctor, date, status: { $in: ["Pending", "Confirmed"] } });
  for (const appointment of affected) {
    await Appointment.updateOne({ _id: appointment._id }, { status: "Cancelled", cancelReason: "Doctor on leave" });
    await notify(appointment.patient, "Appointment cancelled: doctor on leave",
      `${doctorUser?.name} is on leave on ${dayText(date)}, so your ${timeText(appointment.time)} appointment was cancelled. Please book another date.`,
      { type: "leave" });
  }
  await Waitlist.deleteMany({ doctor, date });

  // Let the clinic admin know
  const admins = await User.find({ role: "admin" });
  for (const admin of admins) {
    await notify(admin._id, "Doctor leave",
      `${doctorUser?.name} is on leave on ${dayText(date)}${reason ? ` (${reason})` : ""}. ${affected.length} appointment(s) cancelled.`,
      { type: "leave" });
  }
  res.json({ leave, cancelled: affected.length });
});

// Doctor cancels a leave day (the day can be booked again)
app.delete("/api/leaves/:id", async (req, res) => {
  await Leave.findByIdAndDelete(req.params.id);
  res.json({ message: "Leave cancelled" });
});

// ---------------- 8. NOTIFICATIONS ----------------
app.get("/api/notifications", async (req, res) => {
  const list = await Notification.find({ user: req.query.user }).sort({ createdAt: -1 }).limit(30);
  res.json(list);
});

app.put("/api/notifications/read", async (req, res) => {
  await Notification.updateMany({ user: req.body.user, read: false }, { read: true });
  res.json({ message: "Marked as read" });
});
// ---------------- WEBSITE PAGES (for hosting online) ----------------
// "npm run build" puts the React pages in client/dist. The server sends them too,
// so the whole app (pages + API) works from one link.
app.use(express.static(path.join(__dirname, "..", "client", "dist")));
// Any error inside a route is sent back as a JSON message
app.use((err, req, res, next) => {
  res.status(500).json({ message: err.message });
});

// ---------------- 9. SAMPLE DATA ----------------
// Runs only when the database is empty (first start)
async function addSampleData() {
  if ((await User.countDocuments()) > 0) return;

  await User.create({
    name: "Clinic Admin",
    email: "admin@careconnect.com",
    password: await bcrypt.hash("admin123", 10),
    role: "admin",
  });

  const doctorPassword = await bcrypt.hash("doctor123", 10);
  const [priya, arjun, kavya, rahul, meena] = await User.insertMany(
    [
      {
        name: "Dr. Priya Raman", gender: "Female", email: "priya@careconnect.com",
        specialization: "Cardiology", qualification: "MBBS, MD, DM (Cardiology)", experience: 12, fee: 600,
        availableDays: ["Mon", "Wed", "Fri"],
        about: "Treats chest pain, high blood pressure and heart rhythm problems. Runs the clinic's heart check-up programme.",
      },
      {
        name: "Dr. Arjun Mehta", gender: "Male", email: "arjun@careconnect.com",
        specialization: "Dermatology", qualification: "MBBS, MD (Dermatology)", experience: 8, fee: 400,
        availableDays: ["Tue", "Thu", "Sat"],
        about: "Treats skin allergies, acne, eczema and hair fall in adults and children.",
      },
      {
        name: "Dr. Kavya Srinivasan", gender: "Female", email: "kavya@careconnect.com",
        specialization: "Paediatrics", qualification: "MBBS, DCH, MD (Paediatrics)", experience: 10, fee: 500,
        availableDays: ["Mon", "Tue", "Thu", "Sat"],
        about: "Looks after newborns and children up to 16 years, including vaccinations and growth check-ups.",
      },
      {
        name: "Dr. Rahul Nair", gender: "Male", email: "rahul@careconnect.com",
        specialization: "Orthopaedics", qualification: "MBBS, MS (Orthopaedics)", experience: 15, fee: 700,
        availableDays: ["Mon", "Wed", "Fri", "Sat"],
        about: "Treats joint pain, fractures and sports injuries, with a special interest in knee and shoulder problems.",
      },
      {
        name: "Dr. Meena Krishnan", gender: "Female", email: "meena@careconnect.com",
        specialization: "General Medicine", qualification: "MBBS, MD (General Medicine)", experience: 6, fee: 300,
        availableDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
        about: "First point of contact for fever, diabetes, thyroid problems and routine health check-ups.",
      },
    ].map((d) => ({ ...d, role: "doctor", password: doctorPassword }))
  );

  const patientPassword = await bcrypt.hash("patient123", 10);
  const [karthik, divya] = await User.insertMany([
    { name: "Karthik S", email: "karthik@example.com", phone: "9876543210", age: 34, gender: "Male", role: "patient", password: patientPassword },
    { name: "Divya R", email: "divya@example.com", phone: "9123456780", age: 27, gender: "Female", role: "patient", password: patientPassword },
  ]);

  await Appointment.insertMany([
    { patient: karthik._id, doctor: priya._id, date: nextWorkingDay(priya, 1), time: "10:00", reason: "Chest pain while climbing stairs", status: "Confirmed" },
    { patient: divya._id, doctor: priya._id, date: nextWorkingDay(priya, 3), time: "15:00", reason: "BP follow-up" },
    { patient: divya._id, doctor: arjun._id, date: nextWorkingDay(arjun, 1), time: "11:30", reason: "Itchy rash on both hands" },
    { patient: karthik._id, doctor: meena._id, date: nextWorkingDay(meena, -6), time: "09:30", reason: "Fever and body pain", status: "Completed" },
    { patient: divya._id, doctor: kavya._id, date: nextWorkingDay(kavya, 2), time: "10:30", reason: "Vaccination for my son (2 years)" },
    { patient: karthik._id, doctor: rahul._id, date: nextWorkingDay(rahul, 4), time: "16:00", reason: "Lower back pain" },
  ]);

  await Leave.create({ doctor: meena._id, date: nextWorkingDay(meena, 5), reason: "Medical conference" });

  console.log("Sample doctors, patients, appointments and leave added");
}

// First date (starting n days from today) on which the doctor works
function nextWorkingDay(doctor, n) {
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const d = new Date();
  d.setDate(d.getDate() + n);
  while (!doctor.availableDays.includes(dayNames[d.getDay()])) d.setDate(d.getDate() + 1);
  return d.toLocaleDateString("en-CA"); // YYYY-MM-DD
}

const PORT = process.env.PORT || 5000; // Render gives its own port number
app.listen(PORT, () => console.log("Server running on port " + PORT));
