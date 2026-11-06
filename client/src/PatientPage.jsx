import { useEffect, useRef, useState } from "react";
import { api, dayLabel, greeting, isOpenOn, isPastSlot, nextAvailable, nextDays, showDate, showTime, statusClass, today, TIME_SLOTS } from "./api";
import { askDesktopAlerts, DateBlock, DoctorAvatar, DoctorProfile, EmptyState, Icon, Initials, Layout, Loading, RefreshButton, Toast, deptStyle } from "./components";

const NAV = [
  { id: "home", label: "Home", icon: "home" },
  { id: "appointments", label: "Appointments", icon: "calendar" },
  { id: "profile", label: "Profile", icon: "user" },
];

// Shortcuts under the search bar: a common problem and the department that treats it
const QUICK_TAGS = [
  { label: "Fever", match: "general" },
  { label: "Child health", match: "paed" },
  { label: "Knee pain", match: "ortho" },
  { label: "Skin allergy", match: "derma" },
  { label: "Heart check-up", match: "cardio" },
];

const isUpcoming = (a) => a.date >= today() && a.status !== "Completed" && a.status !== "Cancelled";

export default function PatientPage({ user, onSignOut }) {
  const [tab, setTab] = useState("home");
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [waitlist, setWaitlist] = useState([]);
  const [loaded, setLoaded] = useState({ doctors: false, appointments: false });
  const [loadError, setLoadError] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [preset, setPreset] = useState(null); // date and time chosen from a notification
  const [toast, setToast] = useState(null);

  // Data is read again from MongoDB every time a page is opened
  function loadData() {
    setLoadError("");
    api("/doctors")
      .then((list) => { setDoctors(list); setLoaded((l) => ({ ...l, doctors: true })); })
      .catch((err) => setLoadError(err.message));
    api("/appointments?patient=" + user._id)
      .then((list) => { setAppointments(list); setLoaded((l) => ({ ...l, appointments: true })); })
      .catch(() => {});
    api("/waitlist?patient=" + user._id).then(setWaitlist).catch(() => {});
  }

  useEffect(loadData, [tab]);

  // Appointments do not carry the doctor's photo (to keep them small),
  // so the full doctor details are taken from the doctors list
  const doctorOf = (doc) => (doc && doctors.find((d) => d._id === doc._id)) || doc || {};

  function navigate(id) {
    setTab(id);
    setSelectedDoctor(null);
    setPreset(null);
    window.scrollTo(0, 0);
  }

  function openDoctor(doctor, slot = null) {
    setTab("home");
    setSelectedDoctor(doctor);
    setPreset(slot);
    window.scrollTo(0, 0);
  }

  // "Book this slot" button inside a notification
  function bookFromNotification(n) {
    const doctor = doctors.find((d) => d._id === n.doctor);
    if (!doctor) return setToast({ type: "error", text: "This doctor is no longer available." });
    openDoctor(doctor, { date: n.date, time: n.time });
  }

  function handleBooked(message) {
    setToast({ type: "success", text: message });
    navigate("appointments");
  }

  async function cancelAppointment(appointment) {
    if (!window.confirm(`Cancel your appointment with ${appointment.doctor?.name || "the doctor"}?`)) return;
    await api(`/appointments/${appointment._id}?by=patient`, "DELETE");
    setToast({ type: "success", text: "Appointment cancelled. Anyone waiting for this time has been notified." });
    loadData();
  }

  async function removeWaiting(entry) {
    await api("/waitlist/" + entry._id, "DELETE");
    setToast({ type: "success", text: "Removed from your waiting list." });
    loadData();
  }

  return (
    <Layout user={user} nav={NAV} tab={tab} onNavigate={navigate} onSignOut={onSignOut}
      onNotificationAction={bookFromNotification} onNewNotification={loadData}>
      {tab === "home" && !selectedDoctor && (
        <Home user={user} doctors={doctors} appointments={appointments} loaded={loaded} loadError={loadError}
          onRetry={loadData} doctorOf={doctorOf} onOpenDoctor={(d) => openDoctor(d)}
          onCancel={cancelAppointment} onSeeAppointments={() => navigate("appointments")} />
      )}
      {tab === "home" && selectedDoctor && (
        <DoctorDetail key={selectedDoctor._id + JSON.stringify(preset)} doctor={selectedDoctor} preset={preset} user={user}
          onBack={() => { setSelectedDoctor(null); setPreset(null); }} onBooked={handleBooked} />
      )}
      {tab === "appointments" && (
        <MyAppointments appointments={appointments} waitlist={waitlist} loaded={loaded.appointments} doctorOf={doctorOf}
          onCancel={cancelAppointment} onRemoveWaiting={removeWaiting} onRefresh={loadData} onFindDoctor={() => navigate("home")} />
      )}
      {tab === "profile" && <Profile user={user} appointments={appointments} onSignOut={onSignOut} />}
      <Toast toast={toast} onDone={() => setToast(null)} />
    </Layout>
  );
}

// ---------------- Home: search, next appointment, departments and doctors ----------------
function Home({ user, doctors, appointments, loaded, loadError, onRetry, doctorOf, onOpenDoctor, onCancel, onSeeAppointments }) {
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("All");
  const [day, setDay] = useState(""); // "" means any day
  const listRef = useRef(null);

  const week = nextDays(7).filter((d) => d.day !== "Sun");
  const chosenDay = week.find((d) => d.value === day);
  const departments = ["All", ...new Set(doctors.map((d) => d.specialization).filter(Boolean))];
  const quickTags = QUICK_TAGS
    .map((t) => ({ ...t, department: departments.find((name) => name !== "All" && name.toLowerCase().includes(t.match)) }))
    .filter((t) => t.department);

  const text = search.trim().toLowerCase();
  const shown = doctors.filter((d) =>
    (department === "All" || d.specialization === department) &&
    `${d.name} ${d.specialization}`.toLowerCase().includes(text) &&
    (!chosenDay || isOpenOn(d, chosenDay))
  );
  const next = appointments.find(isUpcoming);
  const nextDoctor = next ? doctorOf(next.doctor) : null;

  const scrollToList = () => listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  function pickDepartment(name) {
    setDepartment(name);
    scrollToList();
  }

  return (
    <>
      <section className="hero">
        <div className="hero-main">
          <small>{greeting()}, {user.name.split(" ")[0]}</small>
          <h1>Which doctor would you like to see?</h1>
          <form className="search-bar" onSubmit={(e) => { e.preventDefault(); scrollToList(); }}>
            <label className="search-field">
              <Icon name="search" size={18} />
              <input placeholder="Doctor name or department" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search doctors" />
              {search && (
                <button type="button" className="clear" onClick={() => setSearch("")} aria-label="Clear search"><Icon name="x" size={14} /></button>
              )}
            </label>
            <span className="search-sep" />
            <label className="search-field day-field">
              <Icon name="calendar" size={18} />
              <select value={day} onChange={(e) => setDay(e.target.value)} aria-label="Day">
                <option value="">Any day this week</option>
                {week.map((d) => <option key={d.value} value={d.value}>{dayLabel(d)}</option>)}
              </select>
            </label>
            <button className="search-go">Search</button>
          </form>
          {quickTags.length > 0 && (
            <div className="quick-tags">
              {quickTags.map((t) => (
                <button key={t.label} className={department === t.department ? "on" : ""} onClick={() => pickDepartment(t.department)}>{t.label}</button>
              ))}
            </div>
          )}
        </div>

        <div className="card next-card">
          <div className="next-head">
            <b>Your next appointment</b>
            {next && <span className={statusClass(next.status)}>{next.status}</span>}
          </div>
          {!loaded.appointments ? (
            <div className="ticket"><span className="sk sk-date" /><span className="sk-lines"><span className="sk w70" /><span className="sk w45" /></span></div>
          ) : next ? (
            <>
              <div className="ticket">
                <DateBlock date={next.date} />
                <DoctorAvatar doctor={nextDoctor} size={54} />
                <div className="ticket-who">
                  <b>{next.doctor?.name || "Doctor removed"}</b>
                  <small>{next.doctor?.specialization}</small>
                  <span className="meta">
                    <Icon name="clock" size={14} /> {showTime(next.time)}
                    {nextDoctor.fee != null && <><Icon name="rupee" size={14} /> {nextDoctor.fee}</>}
                  </span>
                </div>
              </div>
              <p className="meta"><Icon name="bell" size={14} /> Any change to this booking will show under the bell.</p>
              <div className="btn-row">
                <button className="btn" onClick={() => onCancel(next)}>Cancel</button>
                <button className="btn primary" onClick={onSeeAppointments}>View details</button>
              </div>
            </>
          ) : (
            <div className="next-empty">
              <span className="empty-icon"><Icon name="calendar" size={22} /></span>
              <b>No upcoming appointments</b>
              <p className="muted">Choose a doctor below and pick a time that suits you.</p>
            </div>
          )}
        </div>
      </section>

      <section className="section">
        <div className="section-head"><h2>Departments</h2></div>
        <div className="dept-row">
          {departments.map((name) => {
            const style = name === "All" ? { icon: "grid", tone: "tone-all" } : deptStyle(name);
            return (
              <button key={name} className={"dept-chip " + style.tone + (department === name ? " active" : "")} onClick={() => setDepartment(name)}>
                <span className="dept-icon"><Icon name={style.icon} size={17} /></span>
                {name === "All" ? "All doctors" : name}
              </button>
            );
          })}
        </div>
      </section>

      <section className="section" ref={listRef}>
        <div className="section-head">
          <h2>{department === "All" ? "Our doctors" : department}</h2>
          {loaded.doctors && (
            <span className="count">
              {shown.length} {shown.length === 1 ? "doctor" : "doctors"}
              {chosenDay && ` available ${["Today", "Tomorrow"].includes(dayLabel(chosenDay)) ? dayLabel(chosenDay).toLowerCase() : "on " + dayLabel(chosenDay)}`}
            </span>
          )}
        </div>

        {!loaded.doctors ? (
          loadError ? (
            <EmptyState icon="info" title="Could not load the doctors" text={loadError}>
              <button className="btn primary" onClick={onRetry}><Icon name="refresh" size={16} /> Try again</button>
            </EmptyState>
          ) : (
            <Loading kind="cards" count={6} />
          )
        ) : shown.length === 0 ? (
          <EmptyState icon="search" title="No doctors found"
            text={chosenDay ? "No doctor matches on this day. Try another day or department." : "Try another name or department."}>
            {(search || department !== "All" || day) && (
              <button className="btn" onClick={() => { setSearch(""); setDepartment("All"); setDay(""); }}>Show all doctors</button>
            )}
          </EmptyState>
        ) : (
          <div className="doctor-grid">
            {shown.map((d) => <DoctorCard key={d._id} doctor={d} onOpen={() => onOpenDoctor(d)} />)}
          </div>
        )}
      </section>
    </>
  );
}

function DoctorCard({ doctor, onOpen }) {
  const dept = deptStyle(doctor.specialization);
  const nextDay = nextAvailable(doctor);
  const onLeaveToday = (doctor.leaveDates || []).includes(today());
  return (
    <button className="doc-card" onClick={onOpen}>
      <span className="doc-top">
        <DoctorAvatar doctor={doctor} size={72} />
        <span className="doc-name">
          <b>{doctor.name}</b>
          <small>{doctor.qualification || doctor.specialization}</small>
          <span className={"dept-tag " + dept.tone}>{doctor.specialization}</span>
        </span>
      </span>
      <span className="facts">
        <span><b>{doctor.experience ?? "-"} yrs</b><small>Experience</small></span>
        <span><b>{doctor.patientCount || 0}</b><small>Patients</small></span>
        <span><b>₹{doctor.fee ?? "-"}</b><small>Fee</small></span>
      </span>
      <span className="doc-foot">
        <span className={"avail" + (onLeaveToday || !nextDay ? " off" : "")}>
          <Icon name={onLeaveToday ? "umbrella" : "calendar"} size={15} />
          {onLeaveToday ? "On leave today"
            : !nextDay ? "Not available"
            : nextDay.value === today() ? "Available today"
            : `Next: ${dayLabel(nextDay)}`}
        </span>
        <span className="book">Book</span>
      </span>
    </button>
  );
}

// ---------------- Doctor details and booking ----------------
function DoctorDetail({ doctor, preset, user, onBack, onBooked }) {
  const days = nextDays(14);
  const leaveDates = doctor.leaveDates || [];
  // today is "over" once the last appointment time has passed
  const dayOver = (d) => d.value === today() && isPastSlot(d.value, TIME_SLOTS[TIME_SLOTS.length - 1]);

  const [date, setDate] = useState(() => preset?.date || days.find((d) => isOpenOn(doctor, d))?.value || "");
  const [time, setTime] = useState("");
  const [reason, setReason] = useState("");
  const [avail, setAvail] = useState({ booked: [], mine: [], waiting: [], onLeave: false });
  const [availLoading, setAvailLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function loadAvailability() {
    if (!date) return setAvailLoading(false);
    return api(`/availability?doctor=${doctor._id}&date=${date}&patient=${user._id}`)
      .then(setAvail)
      .catch(() => {})
      .finally(() => setAvailLoading(false));
  }

  // When the date changes, ask the server which times are taken
  useEffect(() => {
    setTime(preset && preset.date === date ? preset.time : "");
    setMessage("");
    setError("");
    setAvailLoading(true);
    loadAvailability();
  }, [date]);

  // If the chosen time got booked meanwhile, clear it
  useEffect(() => {
    if (time && avail.booked.includes(time)) setTime("");
  }, [avail]);

  // t is one time like "10:30", or "any" for any time on this day
  async function toggleWaitlist(t, waiting) {
    setError("");
    const what = t === "any" ? `any time on ${showDate(date)}` : `${showTime(t)} on ${showDate(date)}`;
    try {
      if (waiting) {
        await api(`/waitlist?patient=${user._id}&doctor=${doctor._id}&date=${date}&time=${t}`, "DELETE");
        setMessage(`You will no longer be notified about ${what}.`);
      } else {
        askDesktopAlerts();
        await api("/waitlist", "POST", { patient: user._id, doctor: doctor._id, date, time: t });
        setMessage(`Done. We will notify you if ${what} becomes free.`);
      }
      loadAvailability();
    } catch (err) {
      setError(err.message);
    }
  }

  async function confirmBooking(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api("/appointments", "POST", { patient: user._id, doctor: doctor._id, date, time, reason });
      onBooked(`Appointment booked with ${doctor.name} on ${showDate(date)} at ${showTime(time)}.`);
    } catch (err) {
      setError(err.message);
      setSaving(false);
      loadAvailability();
    }
  }

  function slotButton(t) {
    const past = isPastSlot(date, t);
    if (avail.mine.includes(t)) {
      return (
        <button type="button" key={t} className="slot mine" disabled>
          <span>{showTime(t)}</span>
          <span className="slot-note">Your booking</span>
        </button>
      );
    }
    if (avail.booked.includes(t) && !past) {
      const waiting = avail.waiting.includes(t);
      return (
        <button type="button" key={t} className={"slot booked" + (waiting ? " waiting" : "")} onClick={() => toggleWaitlist(t, waiting)}
          title={waiting ? "Click to stop this notification" : "Booked. Click to be notified if it becomes free"}>
          <span className="slot-time">{showTime(t)}</span>
          <span className="slot-note"><Icon name={waiting ? "check" : "bell"} size={11} /> {waiting ? "Notify on" : "Notify me"}</span>
        </button>
      );
    }
    return (
      <button type="button" key={t} className={"slot" + (time === t ? " selected" : "")} disabled={past}
        onClick={() => setTime(t)} title={past ? "This time has already passed" : undefined}>
        {showTime(t)}
      </button>
    );
  }

  // Times booked by other patients (not yet passed) and times still free
  const takenByOthers = avail.booked.filter((t) => !avail.mine.includes(t) && !isPastSlot(date, t));
  const freeCount = TIME_SLOTS.filter((t) => !avail.booked.includes(t) && !isPastSlot(date, t)).length;
  const waitingAny = avail.waiting.includes("any");
  // "Notify me for any time" is offered only when every time on the day is booked
  const fullyBooked = freeCount === 0 && takenByOthers.length > 0;

  return (
    <>
      <button className="back-link" onClick={onBack}><Icon name="back" size={18} /> All doctors</button>

      <div className="detail-layout">
        <DoctorProfile doctor={doctor} />

        <form className="card booking-card" onSubmit={confirmBooking}>
          <h2>Book an appointment</h2>
          <p className="muted">Consultation fee ₹{doctor.fee}, paid at the reception.</p>

          <h3>Choose a date</h3>
          <div className="date-strip">
            {days.map((d) => {
              const onLeave = leaveDates.includes(d.value);
              return (
                <button type="button" key={d.value} disabled={!isOpenOn(doctor, d)} title={onLeave ? "Doctor on leave" : undefined}
                  className={"date-chip" + (date === d.value ? " selected" : "") + (onLeave ? " leave" : "")}
                  onClick={() => setDate(d.value)}>
                  <small>{d.day}</small>
                  <b>{d.date}</b>
                  <small>{onLeave ? "Leave" : dayOver(d) ? "Closed" : d.month}</small>
                </button>
              );
            })}
          </div>

          <h3>Available time</h3>
          {availLoading ? (
            <Loading kind="slots" count={13} />
          ) : avail.onLeave ? (
            <p className="alert error">{doctor.name} is on leave on this day. Please choose another date.</p>
          ) : (
            <>
              {(fullyBooked || waitingAny) && (
                <div className={"any-box" + (waitingAny ? " on" : "")}>
                  <span className="any-icon"><Icon name={waitingAny ? "check" : "bell"} size={18} /></span>
                  <span className="any-text">
                    <b>{fullyBooked ? "All times on this day are booked" : "You are waiting for any free time"}</b>
                    <small>{waitingAny
                      ? "You will be notified as soon as any time on this day becomes free."
                      : "Get a notification if any time on this day becomes free."}</small>
                  </span>
                  <button type="button" className={"btn small" + (waitingAny ? "" : " primary")} onClick={() => toggleWaitlist("any", waitingAny)}>
                    {waitingAny ? "Stop" : "Notify me"}
                  </button>
                </div>
              )}
              {takenByOthers.length > 0 && (
                <p className="slot-hint"><Icon name="info" size={14} />
                  {fullyBooked
                    ? "Or tap one crossed-out time to wait for that time only."
                    : "Crossed-out times are booked. Tap one to be notified if it becomes free."}
                </p>
              )}
              <p className="slot-label">Morning</p>
              <div className="slot-grid">{TIME_SLOTS.filter((t) => t < "13:00").map(slotButton)}</div>
              <p className="slot-label">Afternoon</p>
              <div className="slot-grid">{TIME_SLOTS.filter((t) => t >= "13:00").map(slotButton)}</div>
            </>
          )}
          {message && <p className="slot-msg"><Icon name="check" size={14} /> {message}</p>}

          <label className="reason-field">Reason for visit
            <textarea rows="3" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="For example: knee pain for two weeks" />
          </label>

          {error && <p className="alert error">{error}</p>}

          <div className="booking-summary">
            {date && time ? (
              <><Icon name="calendar" size={16} /> {showDate(date)} at {showTime(time)}</>
            ) : (
              <span className="muted">Select a date and a free time</span>
            )}
          </div>
          <button className="btn primary full" disabled={!date || !time || saving || avail.onLeave}>
            {saving ? "Booking..." : "Confirm appointment"}
          </button>
        </form>
      </div>
    </>
  );
}

// ---------------- My appointments and waiting list ----------------
function MyAppointments({ appointments, waitlist, loaded, doctorOf, onCancel, onRemoveWaiting, onRefresh, onFindDoctor }) {
  const [view, setView] = useState("upcoming");
  const upcoming = appointments.filter(isUpcoming);
  const past = appointments.filter((a) => !isUpcoming(a)).reverse();
  const list = view === "upcoming" ? upcoming : past;

  return (
    <>
      <header className="page-head">
        <div>
          <h1>My appointments</h1>
          <p className="muted">Your bookings and the times you are waiting for.</p>
        </div>
        <RefreshButton onClick={onRefresh} />
      </header>

      <div className="segmented">
        <button className={view === "upcoming" ? "active" : ""} onClick={() => setView("upcoming")}>Upcoming ({upcoming.length})</button>
        <button className={view === "past" ? "active" : ""} onClick={() => setView("past")}>Past ({past.length})</button>
        <button className={view === "waiting" ? "active" : ""} onClick={() => setView("waiting")}>Waiting list ({waitlist.length})</button>
      </div>

      {!loaded ? (
        <Loading kind="list" count={3} />
      ) : view === "waiting" ? (
        waitlist.length === 0 ? (
          <EmptyState icon="bell" title="You are not waiting for any time"
            text="If the time you want is already booked, tap it on the booking page and choose Notify me." />
        ) : (
          <div className="appt-list">
            {waitlist.map((w) => (
              <div className="appt-card" key={w._id}>
                <DateBlock date={w.date} />
                <DoctorAvatar doctor={doctorOf(w.doctor)} size={48} />
                <div className="appt-info">
                  <b>{w.doctor?.name || "Doctor removed"}</b>
                  <span className="muted">{w.doctor?.specialization}</span>
                  <span className="meta"><Icon name="clock" size={14} /> {w.time === "any" ? "Any free time" : showTime(w.time)}</span>
                  <p className="reason">{w.time === "any"
                    ? "You will get a notification if any time on this day becomes free."
                    : "You will get a notification if this time becomes free."}</p>
                </div>
                <div className="appt-side">
                  <span className="status waiting">Waiting</span>
                  <button className="btn small" onClick={() => onRemoveWaiting(w)}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : list.length === 0 ? (
        <EmptyState icon="calendar"
          title={view === "upcoming" ? "No upcoming appointments" : "No past appointments"}
          text={view === "upcoming" ? "Find a doctor and book a time that suits you." : undefined}>
          {view === "upcoming" && <button className="btn primary" onClick={onFindDoctor}>Find a doctor</button>}
        </EmptyState>
      ) : (
        <div className="appt-list">
          {list.map((a) => (
            <div className={"appt-card" + (a.status === "Cancelled" ? " is-cancelled" : "")} key={a._id}>
              <DateBlock date={a.date} />
              <DoctorAvatar doctor={doctorOf(a.doctor)} size={48} />
              <div className="appt-info">
                <b>{a.doctor?.name || "Doctor removed"}</b>
                <span className="muted">{a.doctor?.specialization}</span>
                <span className="meta"><Icon name="clock" size={14} /> {showTime(a.time)}</span>
                {a.reason && <p className="reason">{a.reason}</p>}
                {a.cancelReason && <p className="cancel-note"><Icon name="umbrella" size={12} /> {a.cancelReason}</p>}
              </div>
              <div className="appt-side">
                <span className={statusClass(a.status)}>{a.status}</span>
                {view === "upcoming" && <button className="btn danger small" onClick={() => onCancel(a)}>Cancel</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ---------------- Profile ----------------
function Profile({ user, appointments, onSignOut }) {
  const details = [
    ["clock", "Age", user.age ? `${user.age} years` : "-"],
    ["user", "Gender", user.gender || "-"],
    ["phone", "Mobile", user.phone || "-"],
    ["mail", "Email", user.email],
    ["calendar", "Patient since", user.createdAt ? showDate(user.createdAt) : "-"],
  ];

  return (
    <>
      <header className="page-head"><h1>My profile</h1></header>
      <div className="card profile-simple">
        <div className="profile-top">
          <Initials name={user.name} size={72} />
          <div>
            <h2>{user.name}</h2>
            <p className="muted">{appointments.length} {appointments.length === 1 ? "appointment" : "appointments"} booked</p>
          </div>
        </div>
        <ul className="info-list">
          {details.map(([icon, label, value]) => (
            <li key={label}>
              <span className="info-icon"><Icon name={icon} size={16} /></span>
              <span className="muted">{label}</span>
              <b>{value}</b>
            </li>
          ))}
        </ul>
        <button className="btn danger full" onClick={onSignOut}><Icon name="logout" size={18} /> Sign out</button>
      </div>
    </>
  );
}
