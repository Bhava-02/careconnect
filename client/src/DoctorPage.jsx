import { useEffect, useState } from "react";
import { api, DAY_NAMES, greeting, showDate, showTime, statusClass, today, todayLong, workingDays } from "./api";
import { DateBlock, DoctorProfile, EmptyState, Icon, Initials, Layout, Loading, PhotoPicker, RefreshButton, Toast } from "./components";

const NAV = [
  { id: "schedule", label: "Schedule", icon: "calendar" },
  { id: "patients", label: "My patients", icon: "users" },
  { id: "leave", label: "Leave", icon: "umbrella" },
  { id: "profile", label: "Profile", icon: "user" },
];

const isActive = (a) => a.status === "Pending" || a.status === "Confirmed";

// The four summary cards also work as filters
const FILTERS = [
  { id: "today", label: "Today", icon: "clock", tone: "tone-0", test: (a) => a.date === today() && isActive(a) },
  { id: "pending", label: "To confirm", icon: "hourglass", tone: "tone-2", test: (a) => a.status === "Pending" },
  { id: "upcoming", label: "Upcoming", icon: "calendar", tone: "tone-4", test: (a) => a.date >= today() && isActive(a) },
  { id: "completed", label: "Completed", icon: "check", tone: "tone-1", test: (a) => a.status === "Completed" },
];

export default function DoctorPage({ user, onSignOut }) {
  const [tab, setTab] = useState("schedule");
  const [appointments, setAppointments] = useState([]);
  const [profile, setProfile] = useState(user);
  const [filter, setFilter] = useState("upcoming");
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState(null);

  // Only this doctor's appointments are requested from the server
  function loadData() {
    api("/appointments?doctor=" + user._id)
      .then((list) => { setAppointments(list); setLoaded(true); })
      .catch((err) => setToast({ type: "error", text: err.message }));
    api("/doctors")
      .then((list) => setProfile(list.find((d) => d._id === user._id) || user))
      .catch(() => {});
  }

  useEffect(loadData, [tab]);

  async function changeStatus(appointment, status) {
    await api("/appointments/" + appointment._id, "PUT", { status });
    setToast({ type: "success", text: `Appointment with ${appointment.patient?.name || "patient"} marked as ${status.toLowerCase()}. The patient has been notified.` });
    loadData();
  }

  const active = FILTERS.find((f) => f.id === filter);
  const shown = active ? appointments.filter(active.test) : appointments;
  const showToast = (text, type = "success") => setToast({ type, text });
  const next = appointments.find((a) => a.date >= today() && isActive(a));
  const countOf = (id) => appointments.filter(FILTERS.find((f) => f.id === id).test).length;
  const nextLeave = (profile.leaveDates || [])[0];

  return (
    <Layout user={profile} nav={NAV} tab={tab} onNavigate={(id) => { setTab(id); window.scrollTo(0, 0); }}
      onSignOut={onSignOut} onNewNotification={loadData}>
      {tab === "schedule" && (
        <>
          <section className="hero">
            <div className="hero-main">
              <small>{greeting()},</small>
              <h1>{profile.name}</h1>
              <p>{profile.specialization} department. Today is {todayLong()}.</p>
              <div className="quick-tags static">
                <span>{loaded ? countOf("today") : "-"} appointments today</span>
                <span>{loaded ? countOf("pending") : "-"} to confirm</span>
                {nextLeave && <span><Icon name="umbrella" size={13} /> Next leave {showDate(nextLeave)}</span>}
              </div>
            </div>

            <div className="card next-card">
              <div className="next-head">
                <b>Next appointment</b>
                {next && <span className={statusClass(next.status)}>{next.status}</span>}
              </div>
              {!loaded ? (
                <div className="ticket"><span className="sk sk-date" /><span className="sk-lines"><span className="sk w70" /><span className="sk w45" /></span></div>
              ) : next ? (
                <>
                  <div className="ticket">
                    <DateBlock date={next.date} />
                    <Initials name={next.patient?.name || "?"} size={50} />
                    <div className="ticket-who">
                      <b>{next.patient?.name || "Patient removed"}</b>
                      <small>{[next.patient?.age && `${next.patient.age} yrs`, next.patient?.gender].filter(Boolean).join(", ")}</small>
                      <span className="meta"><Icon name="clock" size={14} /> {showTime(next.time)}</span>
                    </div>
                  </div>
                  <p className="meta"><Icon name="clipboard" size={14} /> <span className="truncate">{next.reason || "No reason given"}</span></p>
                  <div className="btn-row">
                    {next.status === "Pending" ? (
                      <button className="btn primary" onClick={() => changeStatus(next, "Confirmed")}><Icon name="check" size={16} /> Confirm</button>
                    ) : (
                      <button className="btn success" onClick={() => changeStatus(next, "Completed")}>Mark completed</button>
                    )}
                  </div>
                </>
              ) : (
                <div className="next-empty">
                  <span className="empty-icon"><Icon name="calendar" size={22} /></span>
                  <b>No upcoming appointments</b>
                  <p className="muted">New bookings from patients will appear here.</p>
                </div>
              )}
            </div>
          </section>

          <div className="stat-cards">
            {FILTERS.map((f) => (
              <button key={f.id} className={"stat-card " + f.tone + (filter === f.id ? " active" : "")}
                onClick={() => setFilter(filter === f.id ? "all" : f.id)}>
                <span className="icon-box"><Icon name={f.icon} size={20} /></span>
                <span>
                  <b>{loaded ? appointments.filter(f.test).length : "-"}</b>
                  <small>{f.label}</small>
                </span>
              </button>
            ))}
          </div>

          <div className="section-head">
            <h2>{active ? active.label : "All"} appointments</h2>
            <span className="head-actions">
              {filter !== "all" && (
                <button className="link" onClick={() => setFilter("all")}>Show all ({appointments.length})</button>
              )}
              <RefreshButton onClick={loadData} />
            </span>
          </div>

          {!loaded ? (
            <Loading kind="list" count={3} />
          ) : shown.length === 0 ? (
            <EmptyState icon="calendar" title="No appointments here"
              text={appointments.length ? "Try another filter above." : "Patients who book with you will appear here."} />
          ) : (
            <div className="appt-list">
              {shown.map((a) => (
                <div className={"appt-card" + (a.date === today() && isActive(a) ? " is-today" : "") + (a.status === "Cancelled" ? " is-cancelled" : "")} key={a._id}>
                  <DateBlock date={a.date} />
                  <Initials name={a.patient?.name || "?"} size={48} />
                  <div className="appt-info">
                    <b>{a.patient?.name || "Patient removed"}</b>
                    <span className="muted">{[a.patient?.age && `${a.patient.age} yrs`, a.patient?.gender].filter(Boolean).join(", ")}</span>
                    <span className="meta">
                      <Icon name="clock" size={14} /> {showTime(a.time)}
                      {a.patient?.phone && <><Icon name="phone" size={14} /> {a.patient.phone}</>}
                    </span>
                    {a.reason && <p className="reason">{a.reason}</p>}
                    {a.cancelReason && <p className="cancel-note"><Icon name="umbrella" size={12} /> {a.cancelReason}</p>}
                  </div>
                  <div className="appt-side">
                    <span className={statusClass(a.status)}>{a.status}</span>
                    {a.status === "Pending" && (
                      <button className="btn primary small" onClick={() => changeStatus(a, "Confirmed")}><Icon name="check" size={16} /> Confirm</button>
                    )}
                    {a.status === "Confirmed" && (
                      <button className="btn success small" onClick={() => changeStatus(a, "Completed")}>Mark completed</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "patients" && <MyPatients appointments={appointments} loaded={loaded} />}

      {tab === "leave" && <LeavePlanner doctor={profile} appointments={appointments} onChanged={loadData} onMessage={showToast} />}

      {tab === "profile" && (
        <>
          <header className="page-head">
            <div>
              <h1>My profile</h1>
              <p className="muted">This is how patients see you when they book.</p>
            </div>
            <PhotoPicker
              doctor={profile}
              onSaved={(updated) => {
                setProfile({ ...profile, photo: updated.photo });
                showToast("Profile photo updated.");
              }}
              onError={(err) => showToast(err.message, "error")}
            />
          </header>
          <div className="profile-narrow"><DoctorProfile doctor={profile} /></div>
        </>
      )}

      <Toast toast={toast} onDone={() => setToast(null)} />
    </Layout>
  );
}

// ---------------- Leave calendar ----------------
function LeavePlanner({ doctor, appointments, onChanged, onMessage }) {
  const [leaves, setLeaves] = useState([]);
  const [selected, setSelected] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const working = workingDays(doctor);

  function loadLeaves() {
    api("/leaves?doctor=" + doctor._id).then(setLeaves).catch(() => {});
  }

  useEffect(loadLeaves, []);

  // Five weeks, starting from Monday of this week
  const start = new Date();
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const cells = Array.from({ length: 35 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });

  const leaveOn = (value) => leaves.find((l) => l.date === value);
  const bookingsOn = (value) => appointments.filter((a) => a.date === value && isActive(a)).length;
  const selectedLeave = selected && leaveOn(selected);
  const selectedCount = selected ? bookingsOn(selected) : 0;
  const upcomingLeaves = leaves.filter((l) => l.date >= today());
  const longDate = (value) => new Date(value + "T00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  async function applyLeave() {
    if (selectedCount && !window.confirm(`${selectedCount} appointment(s) on this day will be cancelled and the patients will be notified. Continue?`)) return;
    setSaving(true);
    try {
      const result = await api("/leaves", "POST", { doctor: doctor._id, date: selected, reason });
      onMessage(`Leave added for ${showDate(selected)}.` + (result.cancelled ? ` ${result.cancelled} appointment(s) cancelled and patients notified.` : ""));
      setReason("");
      loadLeaves();
      onChanged();
    } catch (err) {
      onMessage(err.message, "error");
    }
    setSaving(false);
  }

  async function cancelLeave(leave) {
    await api("/leaves/" + leave._id, "DELETE");
    onMessage(`Leave on ${showDate(leave.date)} cancelled. Patients can book that day again.`);
    loadLeaves();
    onChanged();
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Leave</h1>
          <p className="muted">Choose a working day to apply for leave. Patients cannot book that day, and anyone already booked is informed.</p>
        </div>
      </header>

      <div className="leave-layout">
        <div className="card calendar-card">
          <div className="cal-title">
            <b>{cells[0].toLocaleDateString("en-IN", { month: "long" })} to {cells[34].toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</b>
          </div>
          <div className="cal-head">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <span key={d}>{d}</span>)}
          </div>
          <div className="cal-grid">
            {cells.map((d) => {
              const value = d.toLocaleDateString("en-CA");
              const dayName = DAY_NAMES[d.getDay()];
              const past = value < today();
              const works = dayName !== "Sun" && working.includes(dayName);
              const leave = leaveOn(value);
              const count = bookingsOn(value);
              const classes = ["cal-day", past && "past", !works && "off", leave && "leave", selected === value && "selected", value === today() && "today"]
                .filter(Boolean).join(" ");
              return (
                <button key={value} className={classes} disabled={past || (!works && !leave)} onClick={() => setSelected(value)}
                  title={leave ? `On leave${leave.reason ? `: ${leave.reason}` : ""}` : count ? `${count} booking(s)` : undefined}>
                  <span className="cal-num">{d.getDate()}</span>
                  {d.getDate() === 1 && <span className="cal-month">{d.toLocaleDateString("en-IN", { month: "short" })}</span>}
                  {leave ? <span className="cal-tag">Leave</span> : count > 0 && <span className="cal-count">{count}</span>}
                </button>
              );
            })}
          </div>
          <div className="cal-legend">
            <span><i className="work" /> Working day</span>
            <span><i className="off" /> Not working</span>
            <span><i className="leave" /> Leave</span>
            <span><i className="count" /> Bookings</span>
          </div>
        </div>

        <div className="card leave-side">
          {!selected ? (
            <EmptyState icon="calendar" title="Select a day" text="Tap a working day on the calendar to apply for leave." />
          ) : selectedLeave ? (
            <>
              <h2>{longDate(selected)}</h2>
              <p className="note"><Icon name="umbrella" size={16} /> You are on leave on this day{selectedLeave.reason ? ` (${selectedLeave.reason})` : ""}.</p>
              <button className="btn danger full" onClick={() => cancelLeave(selectedLeave)}>Cancel this leave</button>
            </>
          ) : (
            <>
              <h2>{longDate(selected)}</h2>
              {selectedCount > 0 ? (
                <p className="note warn"><Icon name="info" size={16} /> {selectedCount} appointment(s) on this day will be cancelled and the patients notified.</p>
              ) : (
                <p className="muted">No appointments on this day.</p>
              )}
              <label>Reason (optional)
                <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="For example: medical conference" />
              </label>
              <button className="btn primary full" onClick={applyLeave} disabled={saving}>
                {saving ? "Saving..." : "Apply for leave"}
              </button>
            </>
          )}

          <h3>Upcoming leave</h3>
          {upcomingLeaves.length === 0 ? (
            <p className="muted">No leave planned.</p>
          ) : (
            <ul className="leave-list">
              {upcomingLeaves.map((l) => (
                <li key={l._id}>
                  <span className="leave-date"><Icon name="umbrella" size={14} /></span>
                  <span className="leave-text"><b>{showDate(l.date)}</b><small>{l.reason || "No reason given"}</small></span>
                  <button className="icon-btn danger" onClick={() => cancelLeave(l)} title="Cancel leave" aria-label={`Cancel leave on ${showDate(l.date)}`}>
                    <Icon name="trash" size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

// ---------------- Patients who booked with this doctor ----------------
function MyPatients({ appointments, loaded }) {
  const [openId, setOpenId] = useState(null);
  const [search, setSearch] = useState("");

  // Group this doctor's appointments by patient
  const byPatient = {};
  appointments.forEach((a) => {
    if (!a.patient) return;
    byPatient[a.patient._id] = byPatient[a.patient._id] || { ...a.patient, visits: [] };
    byPatient[a.patient._id].visits.push(a);
  });
  const patients = Object.values(byPatient).filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <>
      <header className="page-head">
        <div>
          <h1>My patients</h1>
          <p className="muted">Only patients who booked an appointment with you are listed.</p>
        </div>
      </header>

      <div className="search-box">
        <Icon name="search" size={18} />
        <input placeholder="Search patients by name" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {!loaded ? (
        <Loading kind="list" count={3} />
      ) : patients.length === 0 ? (
        <EmptyState icon="users" title="No patients found" text="Patients appear here after they book with you." />
      ) : (
        <div className="patient-list">
          {patients.map((p) => {
            const open = openId === p._id;
            return (
              <div className={"patient-card" + (open ? " open" : "")} key={p._id}>
                <button className="patient-row" onClick={() => setOpenId(open ? null : p._id)} aria-expanded={open}>
                  <Initials name={p.name} size={44} />
                  <span className="patient-main">
                    <b>{p.name}</b>
                    <span className="muted">{[p.age && `${p.age} yrs`, p.gender, p.phone].filter(Boolean).join(", ")}</span>
                  </span>
                  <span className="patient-count">
                    <b>{p.visits.length}</b>
                    <small>{p.visits.length === 1 ? "visit" : "visits"}</small>
                  </span>
                  <span className="chevron"><Icon name="back" size={18} /></span>
                </button>
                {open && (
                  <ul className="visit-list">
                    {p.visits.map((v) => (
                      <li key={v._id}>
                        <b>{showDate(v.date)}, {showTime(v.time)}</b>
                        <span className="muted">{v.reason || "No reason given"}</span>
                        <span className={statusClass(v.status)}>{v.status}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
