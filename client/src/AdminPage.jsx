import { useEffect, useState } from "react";
import { api, daysText, greeting, resizeImage, showDate, showTime, statusClass, today, todayLong } from "./api";
import { deptStyle, DoctorAvatar, EmptyState, Icon, Initials, Layout, Loading, PhotoPicker, RefreshButton, Toast } from "./components";

const NAV = [
  { id: "appointments", label: "Appointments", icon: "clipboard" },
  { id: "doctors", label: "Doctors", icon: "stethoscope" },
  { id: "patients", label: "Patients", icon: "users" },
];

const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const EMPTY_DOCTOR = {
  name: "", gender: "Female", specialization: "", qualification: "", experience: "", fee: "",
  availableDays: [...WEEK], email: "", password: "", about: "", photo: "",
};

export default function AdminPage({ user, onSignOut }) {
  const [tab, setTab] = useState("appointments");
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [newDoctor, setNewDoctor] = useState(EMPTY_DOCTOR);
  const [loaded, setLoaded] = useState({ appointments: false, doctors: false, patients: false });
  const [toast, setToast] = useState(null);

  const showError = (err) => setToast({ type: "error", text: err.message });
  const done = (name) => setLoaded((l) => ({ ...l, [name]: true }));

  // Admin reads everything: all appointments, all doctors, all patients
  function loadAll() {
    api("/appointments").then((list) => { setAppointments(list); done("appointments"); }).catch(showError);
    api("/doctors").then((list) => { setDoctors(list); done("doctors"); }).catch(showError);
    api("/patients").then((list) => { setPatients(list); done("patients"); }).catch(showError);
  }

  // Appointments do not carry the doctor's photo, so it is taken from the doctors list
  const doctorOf = (doc) => (doc && doctors.find((d) => d._id === doc._id)) || doc || {};

  useEffect(loadAll, [tab]);

  function navigate(id) {
    setTab(id);
    setSearch("");
    setStatus("All");
    setShowForm(false);
  }

  async function deleteAppointment(a) {
    if (!window.confirm(`Delete the appointment of ${a.patient?.name || "this patient"} with ${a.doctor?.name || "this doctor"}?`)) return;
    await api(`/appointments/${a._id}?by=admin`, "DELETE");
    setToast({ type: "success", text: "Appointment deleted. The doctor, the patient and anyone waiting for that time have been notified." });
    loadAll();
  }

  async function deleteUser(person) {
    if (!window.confirm(`Delete ${person.name}? Their appointments will also be deleted.`)) return;
    await api("/users/" + person._id, "DELETE");
    setToast({ type: "success", text: `${person.name} deleted.` });
    loadAll();
  }

  async function addDoctor(e) {
    e.preventDefault();
    if (newDoctor.availableDays.length === 0) return showError({ message: "Select at least one working day." });
    try {
      await api("/doctors", "POST", newDoctor);
      setToast({ type: "success", text: `${newDoctor.name} added. They can now sign in as a doctor.` });
      setNewDoctor(EMPTY_DOCTOR);
      setShowForm(false);
      loadAll();
    } catch (err) {
      showError(err);
    }
  }

  const updateDoctor = (e) => setNewDoctor({ ...newDoctor, [e.target.name]: e.target.value });

  // Optional photo in the "Add a doctor" form
  async function choosePhoto(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      setNewDoctor({ ...newDoctor, photo: await resizeImage(file) });
    } catch (err) {
      showError(err);
      e.target.value = "";
    }
  }

  function toggleDay(day) {
    const days = newDoctor.availableDays.includes(day)
      ? newDoctor.availableDays.filter((d) => d !== day)
      : [...newDoctor.availableDays, day];
    setNewDoctor({ ...newDoctor, availableDays: WEEK.filter((d) => days.includes(d)) });
  }

  // Search box and status filter
  const q = search.trim().toLowerCase();
  const matches = (...values) => values.join(" ").toLowerCase().includes(q);
  const shownAppointments = appointments.filter((a) =>
    (status === "All" || a.status === status) &&
    matches(a.patient?.name, a.doctor?.name, a.doctor?.specialization, a.reason)
  );
  const shownDoctors = doctors.filter((d) => matches(d.name, d.specialization, d.email));
  const shownPatients = patients.filter((p) => matches(p.name, p.email, p.phone));
  const countFor = (field, id) => appointments.filter((a) => a[field]?._id === id).length;

  const pendingCount = appointments.filter((a) => a.status === "Pending").length;
  const todayCount = appointments.filter((a) => a.date === today() && (a.status === "Pending" || a.status === "Confirmed")).length;
  const onLeaveToday = doctors.filter((d) => (d.leaveDates || []).includes(today()));
  const allLoaded = loaded.appointments && loaded.doctors && loaded.patients;
  const stats = [
    { id: "patients", label: "Patients", value: patients.length, icon: "users", tone: "tone-1" },
    { id: "doctors", label: "Doctors", value: doctors.length, icon: "stethoscope", tone: "tone-4" },
    { id: "appointments", label: "Appointments", value: appointments.length, icon: "clipboard", tone: "tone-5" },
    { id: "pending", label: "To confirm", value: pendingCount, icon: "hourglass", tone: "tone-2" },
  ];

  function openStat(id) {
    if (id === "pending") {
      navigate("appointments");
      setStatus("Pending");
    } else {
      navigate(id);
    }
  }

  const isActiveStat = (id) =>
    id === "pending" ? tab === "appointments" && status === "Pending" : id === tab && !(id === "appointments" && status === "Pending");

  return (
    <Layout user={user} nav={NAV} tab={tab} onNavigate={navigate} onSignOut={onSignOut}>
      <section className="hero single">
        <div className="hero-main">
          <small>{greeting()},</small>
          <h1>Clinic dashboard</h1>
          <p>Today is {todayLong()}.</p>
          <div className="quick-tags static">
            <span>{allLoaded ? todayCount : "-"} appointments today</span>
            <span>{allLoaded ? pendingCount : "-"} waiting to be confirmed</span>
            {onLeaveToday.length > 0 && (
              <span><Icon name="umbrella" size={13} /> On leave today: {onLeaveToday.map((d) => d.name).join(", ")}</span>
            )}
          </div>
          <span className="hero-action"><RefreshButton onClick={loadAll} /></span>
        </div>
      </section>

      <div className="stat-cards">
        {stats.map((s) => (
          <button key={s.id} className={"stat-card " + s.tone + (isActiveStat(s.id) ? " active" : "")} onClick={() => openStat(s.id)}>
            <span className="icon-box"><Icon name={s.icon} size={20} /></span>
            <span><b>{allLoaded ? s.value : "-"}</b><small>{s.label}</small></span>
          </button>
        ))}
      </div>

      <div className="toolbar">
        <div className="search-box">
          <Icon name="search" size={18} />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === "appointments" ? "Search patient, doctor or reason" : tab === "doctors" ? "Search doctors" : "Search patients"} />
        </div>
        {tab === "appointments" && (
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
            <option value="All">All statuses</option>
            <option>Pending</option>
            <option>Confirmed</option>
            <option>Completed</option>
            <option>Cancelled</option>
          </select>
        )}
        {tab === "doctors" && (
          <button className="btn primary" onClick={() => setShowForm(!showForm)}>
            <Icon name={showForm ? "x" : "plus"} size={18} /> {showForm ? "Close" : "Add doctor"}
          </button>
        )}
      </div>

      {/* ---------- Appointments ---------- */}
      {tab === "appointments" && (
        !loaded.appointments ? (
          <Loading kind="list" count={4} />
        ) : shownAppointments.length === 0 ? (
          <EmptyState icon="clipboard" title="No appointments found" text="Change the search or status filter." />
        ) : (
          <div className="table-card">
            <table>
              <thead>
                <tr><th>Patient</th><th>Doctor</th><th>Date and time</th><th>Reason</th><th>Status</th><th>Booked on</th><th></th></tr>
              </thead>
              <tbody>
                {shownAppointments.map((a) => (
                  <tr key={a._id}>
                    <td>
                      <div className="person">
                        <Initials name={a.patient?.name || "?"} size={34} />
                        <div><b>{a.patient?.name || "Patient removed"}</b><small>{a.patient?.phone}</small></div>
                      </div>
                    </td>
                    <td>
                      <div className="person">
                        <DoctorAvatar doctor={doctorOf(a.doctor)} size={34} />
                        <div><b>{a.doctor?.name || "Doctor removed"}</b><small>{a.doctor?.specialization}</small></div>
                      </div>
                    </td>
                    <td>{showDate(a.date)}<small>{showTime(a.time)}</small></td>
                    <td className="wrap">{a.reason || "-"}</td>
                    <td><span className={statusClass(a.status)}>{a.status}</span>{a.cancelReason && <small>{a.cancelReason}</small>}</td>
                    <td>{a.createdAt ? showDate(a.createdAt) : "-"}</td>
                    <td className="actions">
                      <button className="icon-btn danger" onClick={() => deleteAppointment(a)} title="Delete appointment" aria-label="Delete appointment">
                        <Icon name="trash" size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ---------- Doctors ---------- */}
      {tab === "doctors" && (
        <>
          {showForm && (
            <form className="card form-card fade-in" onSubmit={addDoctor}>
              <h2>Add a doctor</h2>
              <p className="muted">The doctor can sign in with this email and password.</p>
              <div className="form-grid">
                <label>Full name<input name="name" value={newDoctor.name} onChange={updateDoctor} placeholder="Dr. Sanjay Kumar" required /></label>
                <label>Gender
                  <select name="gender" value={newDoctor.gender} onChange={updateDoctor}>
                    <option>Female</option>
                    <option>Male</option>
                  </select>
                </label>
                <label>Department<input name="specialization" value={newDoctor.specialization} onChange={updateDoctor} placeholder="ENT" required /></label>
                <label>Qualification<input name="qualification" value={newDoctor.qualification} onChange={updateDoctor} placeholder="MBBS, MS (ENT)" /></label>
                <label>Experience (years)<input type="number" min="0" name="experience" value={newDoctor.experience} onChange={updateDoctor} required /></label>
                <label>Consultation fee (₹)<input type="number" min="0" name="fee" value={newDoctor.fee} onChange={updateDoctor} required /></label>
                <label>Login email<input type="email" name="email" value={newDoctor.email} onChange={updateDoctor} required /></label>
                <label>Password<input type="password" minLength={6} name="password" value={newDoctor.password} onChange={updateDoctor} required /></label>
              </div>
              <div className="field">
                <span className="field-title">Working days</span>
                <div className="choice-row">
                  {WEEK.map((d) => (
                    <button type="button" key={d} className={"choice" + (newDoctor.availableDays.includes(d) ? " selected" : "")} onClick={() => toggleDay(d)}>{d}</button>
                  ))}
                </div>
              </div>
              <label>About the doctor
                <textarea name="about" rows="2" value={newDoctor.about} onChange={updateDoctor} placeholder="What the doctor treats" />
              </label>
              <div className="field">
                <span className="field-title">Photo (optional)</span>
                <div className="photo-row">
                  <DoctorAvatar doctor={newDoctor} size={64} />
                  <input type="file" accept="image/*" onChange={choosePhoto} aria-label="Doctor photo" />
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancel</button>
                <button className="btn primary">Save doctor</button>
              </div>
            </form>
          )}

          {!loaded.doctors ? (
            <Loading kind="cards" count={6} />
          ) : shownDoctors.length === 0 ? (
            <EmptyState icon="stethoscope" title="No doctors found" />
          ) : (
            <div className="doctor-grid">
              {shownDoctors.map((d) => (
                <div className="doc-card static" key={d._id}>
                  <span className="doc-top">
                    <DoctorAvatar doctor={d} size={64} />
                    <span className="doc-name">
                      <b>{d.name}</b>
                      <small>{d.qualification || d.specialization}</small>
                      <span className={"dept-tag " + deptStyle(d.specialization).tone}>{d.specialization}</span>
                    </span>
                    <span className="card-actions">
                      <PhotoPicker
                        doctor={d}
                        iconOnly
                        onSaved={() => { setToast({ type: "success", text: `Photo updated for ${d.name}.` }); loadAll(); }}
                        onError={showError}
                      />
                      <button className="icon-btn danger" onClick={() => deleteUser(d)} title={`Delete ${d.name}`} aria-label={`Delete ${d.name}`}>
                        <Icon name="trash" size={16} />
                      </button>
                    </span>
                  </span>
                  <span className="facts">
                    <span><b>{d.experience ?? "-"} yrs</b><small>Experience</small></span>
                    <span><b>{d.patientCount || 0}</b><small>Patients</small></span>
                    <span><b>₹{d.fee ?? "-"}</b><small>Fee</small></span>
                  </span>
                  <span className="doc-foot stacked">
                    <span className="meta"><Icon name="calendar" size={14} /> {daysText(d)}</span>
                    <span className="meta"><Icon name="mail" size={14} /> <span className="truncate" title={d.email}>{d.email}</span></span>
                    {d.leaveDates?.length > 0 && (
                      <span className="meta leave-meta"><Icon name="umbrella" size={14} /> On leave: {d.leaveDates.slice(0, 3).map((x) => showDate(x).slice(0, 6)).join(", ")}{d.leaveDates.length > 3 ? "..." : ""}</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ---------- Patients ---------- */}
      {tab === "patients" && (
        !loaded.patients ? (
          <Loading kind="list" count={4} />
        ) : shownPatients.length === 0 ? (
          <EmptyState icon="users" title="No patients found" />
        ) : (
          <div className="table-card">
            <table>
              <thead>
                <tr><th>Patient</th><th>Age</th><th>Gender</th><th>Mobile</th><th>Registered on</th><th>Appointments</th><th></th></tr>
              </thead>
              <tbody>
                {shownPatients.map((p) => (
                  <tr key={p._id}>
                    <td>
                      <div className="person">
                        <Initials name={p.name} size={34} />
                        <div><b>{p.name}</b><small>{p.email}</small></div>
                      </div>
                    </td>
                    <td>{p.age ?? "-"}</td>
                    <td>{p.gender || "-"}</td>
                    <td>{p.phone || "-"}</td>
                    <td>{p.createdAt ? showDate(p.createdAt) : "-"}</td>
                    <td>{countFor("patient", p._id)}</td>
                    <td className="actions">
                      <button className="icon-btn danger" onClick={() => deleteUser(p)} title={`Delete ${p.name}`} aria-label={`Delete ${p.name}`}>
                        <Icon name="trash" size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      <Toast toast={toast} onDone={() => setToast(null)} />
    </Layout>
  );
}
