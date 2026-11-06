// Shared pieces used by every page: icons, avatars, page layout, toast and doctor profile
import { useEffect, useRef, useState } from "react";
import { api, DAY_NAMES, resizeImage, showDate, timeAgo, workingDays } from "./api";

// ---------- Icons (simple line icons drawn with SVG) ----------
const ICONS = {
  home: <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>,
  user: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
  users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
  search: <><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>,
  arrow: <><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></>,
  back: <polyline points="15 18 9 12 15 6" />,
  clock: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
  check: <polyline points="20 6 9 17 4 12" />,
  x: <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
  plus: <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>,
  eye: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></>,
  info: <><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></>,
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  refresh: <><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></>,
  trash: <><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>,
  phone: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />,
  mail: <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></>,
  briefcase: <><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></>,
  rupee: <><path d="M6 3h12" /><path d="M6 8h12" /><path d="m6 13 8.5 8" /><path d="M6 13h3" /><path d="M9 13c6.667 0 6.667-10 0-10" /></>,
  bell: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>,
  umbrella: <path d="M23 12a11.05 11.05 0 0 0-22 0zm-5 7a3 3 0 0 1-6 0v-7" />,
  camera: <><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></>,
  clipboard: <><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" /></>,
  hourglass: <><path d="M5 22h14" /><path d="M5 2h14" /><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" /><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></>,
  heart: <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />,
  bone: <path d="M17 10c.7-.7 1.69 0 2.5 0a2.5 2.5 0 1 0 0-5 .5.5 0 0 1-.5-.5 2.5 2.5 0 1 0-5 0c0 .81.7 1.8 0 2.5l-7 7c-.7.7-1.69 0-2.5 0a2.5 2.5 0 0 0 0 5c.28 0 .5.22.5.5a2.5 2.5 0 1 0 5 0c0-.81-.7-1.8 0-2.5Z" />,
  smile: <><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /></>,
  droplet: <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />,
  ear: <><path d="M6 8.5a6.5 6.5 0 1 1 13 0c0 6-6 6-6 10a3.5 3.5 0 1 1-7 0" /><path d="M15 8.5a2.5 2.5 0 0 0-5 0v1a2 2 0 1 1 0 4" /></>,
  activity: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />,
  stethoscope: <><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" /><path d="M8 15v1a6 6 0 0 0 6 6a6 6 0 0 0 6-6v-4" /><circle cx="20" cy="10" r="2" /></>,
};

export function Icon({ name, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name] || ICONS.stethoscope}
    </svg>
  );
}

// ---------- Colours and icons for departments ----------
function hash(text = "") {
  let n = 0;
  for (const ch of String(text)) n = (n * 31 + ch.charCodeAt(0)) % 9973;
  return n;
}

// Checked in order, so "ortho" must come before "paed" (Orthopaedics contains "paed")
const DEPARTMENTS = [
  { match: "ortho", icon: "bone", tone: "tone-4" },
  { match: "cardio", icon: "heart", tone: "tone-3" },
  { match: "derma", icon: "droplet", tone: "tone-2" },
  { match: "paed", icon: "smile", tone: "tone-1" },
  { match: "pediat", icon: "smile", tone: "tone-1" },
  { match: "general", icon: "stethoscope", tone: "tone-5" },
  { match: "neuro", icon: "activity", tone: "tone-0" },
  { match: "ent", icon: "ear", tone: "tone-0" },
];

export function deptStyle(name = "") {
  const lower = String(name).toLowerCase();
  const found = DEPARTMENTS.find((d) => (d.match === "ent" ? lower === "ent" : lower.includes(d.match)));
  return found || { icon: "stethoscope", tone: "tone-" + (hash(name) % 6) };
}

// ---------- Avatars ----------
const SKIN = ["#f2c9a8", "#e3b08b", "#c98d66", "#edbd98"];
const HAIR = ["#2b2730", "#3d2c26", "#1e1c22", "#4a3426"];

// Doctor picture: shows the doctor's photo if one is saved,
// otherwise an illustrated picture drawn in SVG
export function DoctorAvatar({ doctor = {}, size = 64 }) {
  const [photoFailed, setPhotoFailed] = useState(false);
  useEffect(() => setPhotoFailed(false), [doctor.photo]);

  const tone = deptStyle(doctor.specialization).tone;
  if (doctor.photo && !photoFailed) {
    return (
      <span className={"avatar-doctor " + tone} style={{ width: size, height: size }}>
        <img src={doctor.photo} alt={doctor.name || "Doctor"} onError={() => setPhotoFailed(true)} />
      </span>
    );
  }

  const n = hash(doctor.name);
  const skin = SKIN[n % SKIN.length];
  const hair = HAIR[Math.floor(n / 4) % HAIR.length];
  const female = String(doctor.gender).toLowerCase() === "female";

  return (
    <span className={"avatar-doctor " + tone} style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" width="100%" height="100%" aria-hidden="true">
        {female && <path d="M37 62 C33 30 47 21 60 21 C74 21 88 30 83 62 L85 96 L35 96 Z" fill={hair} />}
        <rect x="52" y="64" width="16" height="22" rx="7" fill={skin} />
        <path d="M14 120 C14 97 32 84 60 84 C88 84 106 97 106 120 Z" fill="#ffffff" />
        <path d="M50 85 L60 104 L70 85 Z" fill="#d7e3f7" />
        {!female && <path d="M58.3 89 L61.7 89 L63.5 104 L60 109 L56.5 104 Z" fill="#7b88d1" />}
        <path d="M49 85 L57 120 M71 85 L63 120" stroke="#dfe3ee" strokeWidth="2" fill="none" />
        <path d="M45 88 C39 101 43 111 51 113" stroke="#69718a" strokeWidth="2.6" fill="none" strokeLinecap="round" />
        <circle cx="52.5" cy="113.5" r="3.6" fill="#69718a" />
        <ellipse cx="43" cy="54" rx="3.4" ry="5" fill={skin} />
        <ellipse cx="77" cy="54" rx="3.4" ry="5" fill={skin} />
        <ellipse cx="60" cy="52" rx="17" ry="20" fill={skin} />
        {female ? (
          <path d="M42 51 C41 33 51 27 60 27 C71 27 80 33 78 51 C73 40 63 36 52 41 C48 43 44.5 46.5 42 51 Z" fill={hair} />
        ) : (
          <path d="M43 48 C41 31 52 26 61 27 C72 27 80 33 77 48 C75 41 70 37 60 37 C51 37 46 41 43 48 Z" fill={hair} />
        )}
        <circle cx="54" cy="54" r="1.9" fill="#2b2730" />
        <circle cx="66" cy="54" r="1.9" fill="#2b2730" />
        <path d="M55 62 Q60 66 65 62" stroke="#a5644a" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      </svg>
    </span>
  );
}

// Button that lets the admin or the doctor choose a new photo.
// The picture is made smaller in the browser and saved in MongoDB.
export function PhotoPicker({ doctor, onSaved, onError, iconOnly = false }) {
  const [saving, setSaving] = useState(false);

  async function handleFile(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setSaving(true);
    try {
      const photo = await resizeImage(file);
      const updated = await api(`/doctors/${doctor._id}/photo`, "PUT", { photo });
      onSaved(updated);
    } catch (err) {
      onError ? onError(err) : window.alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <label className={iconOnly ? "icon-btn photo-btn" : "btn photo-btn"} title="Change photo">
      <Icon name="camera" size={iconOnly ? 16 : 18} />
      {!iconOnly && (saving ? "Saving..." : "Change photo")}
      <input type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
    </label>
  );
}

// Coloured circle with the first letters of a name (used for patients)
export function Initials({ name = "", size = 40 }) {
  const letters = String(name).replace(/^Dr\.?\s*/i, "").split(" ").filter(Boolean)
    .slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <span className={"initials tone-" + (hash(name) % 6)} style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {letters || "?"}
    </span>
  );
}

// ---------- Page layout: top bar on desktop, bottom bar on phones ----------
const ROLE_LABEL = { patient: "Patient", doctor: "Doctor", admin: "Administrator" };

export function Layout({ user, nav, tab, onNavigate, onSignOut, onNotificationAction, onNewNotification, children }) {
  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <span className="logo"><Icon name="plus" size={20} /></span>
            <b>CareConnect</b>
          </div>

          <nav className="nav">
            {nav.map((item) => (
              <button key={item.id} className={"nav-item" + (tab === item.id ? " active" : "")} onClick={() => onNavigate(item.id)}>
                <Icon name={item.icon} size={20} />
                <span>{item.label}</span>
              </button>
            ))}
            <button className="nav-item signout" onClick={onSignOut}>
              <Icon name="logout" size={20} />
              <span>Sign out</span>
            </button>
          </nav>

          <div className="top-right">
            <NotificationBell user={user} onAction={onNotificationAction} onNew={onNewNotification} />
            <div className="me" title={user.name}>
              {user.role === "doctor" ? <DoctorAvatar doctor={user} size={32} /> : <Initials name={user.name} size={32} />}
              <span className="me-text">
                <b>{user.name}</b>
                <small>{ROLE_LABEL[user.role]}</small>
              </span>
            </div>
            <button className="icon-btn signout-btn" onClick={onSignOut} title="Sign out" aria-label="Sign out">
              <Icon name="logout" size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="main">{children}</main>
    </div>
  );
}

// ---------- Loading placeholders ----------
// Grey shapes shown while data is being read from MongoDB,
// so the page never says "nothing found" before the data has arrived
export function Loading({ kind = "cards", count = 6 }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 4000);
    return () => clearTimeout(timer);
  }, []);

  const items = Array.from({ length: count }, (_, i) => i);
  return (
    <div className="loading" aria-busy="true">
      {kind === "cards" && (
        <div className="doctor-grid">
          {items.map((i) => (
            <div className="sk-card" key={i}>
              <div className="sk-top"><span className="sk sk-avatar" /><span className="sk-lines"><span className="sk w70" /><span className="sk w45" /><span className="sk w35" /></span></div>
              <div className="sk-facts"><span className="sk w60" /><span className="sk w60" /><span className="sk w60" /></div>
            </div>
          ))}
        </div>
      )}
      {kind === "list" && (
        <div className="appt-list">
          {items.map((i) => (
            <div className="sk-row" key={i}><span className="sk sk-date" /><span className="sk-lines"><span className="sk w40" /><span className="sk w25" /><span className="sk w55" /></span></div>
          ))}
        </div>
      )}
      {kind === "slots" && (
        <div className="slot-grid">{items.map((i) => <span className="sk sk-slot" key={i} />)}</div>
      )}
      <p className="loading-text">{slow ? "Still loading. The database is taking longer than usual to answer..." : "Loading from the database..."}</p>
    </div>
  );
}

// ---------- Notifications (bell icon) ----------
const NOTIFICATION_ICON = { booking: "calendar", status: "check", cancelled: "x", "slot-free": "bell", leave: "umbrella" };

// Ask the browser for permission to show desktop alerts
export function askDesktopAlerts() {
  if ("Notification" in window && Notification.permission === "default") {
    return Notification.requestPermission();
  }
  return Promise.resolve(window.Notification?.permission);
}

function showDesktopAlert(item) {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(item.title, { body: item.message });
  }
}

// Bell with unread count. Checks the server for new notifications every 15 seconds.
export function NotificationBell({ user, onAction, onNew }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [ringing, setRinging] = useState(false);
  const [newIds, setNewIds] = useState(new Set());
  const [permission, setPermission] = useState(window.Notification?.permission);
  const known = useRef(null); // ids we have already seen
  const boxRef = useRef(null);

  async function load() {
    try {
      const list = await api("/notifications?user=" + user._id);
      if (known.current) {
        const fresh = list.filter((n) => !known.current.has(n._id) && !n.read);
        if (fresh.length) {
          setRinging(true);
          setTimeout(() => setRinging(false), 1200);
          showDesktopAlert(fresh[0]);
          if (onNew) onNew(); // let the page reload its data
        }
      }
      known.current = new Set(list.map((n) => n._id));
      setItems(list);
    } catch {
      // server not reachable right now; try again on the next check
    }
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [user._id]);

  // Close the panel when clicking anywhere else
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const unread = items.filter((n) => !n.read).length;

  function togglePanel() {
    if (open) return setOpen(false);
    setOpen(true);
    const unreadIds = items.filter((n) => !n.read).map((n) => n._id);
    setNewIds(new Set(unreadIds));
    if (unreadIds.length) {
      setItems(items.map((n) => ({ ...n, read: true })));
      api("/notifications/read", "PUT", { user: user._id }).catch(() => {});
    }
  }

  return (
    <div className="bell-wrap" ref={boxRef}>
      <button className={"icon-btn bell" + (ringing ? " ring" : "")} onClick={togglePanel}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
        <Icon name="bell" size={18} />
        {unread > 0 && <span className="badge">{unread}</span>}
      </button>

      {open && (
        <div className="notif-panel fade-in">
          <div className="notif-head">
            <b>Notifications</b>
            {permission === "default" && (
              <button className="link" onClick={() => askDesktopAlerts().then(setPermission)}>Turn on desktop alerts</button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="notif-empty">No notifications yet.</p>
          ) : (
            <ul className="notif-list">
              {items.map((n) => (
                <li key={n._id} className={"notif " + (n.type || "") + (newIds.has(n._id) ? " new" : "")}>
                  <span className="notif-icon"><Icon name={NOTIFICATION_ICON[n.type] || "bell"} size={16} /></span>
                  <div>
                    <b>{n.title}</b>
                    <p>{n.message}</p>
                    <small>{timeAgo(n.createdAt)}</small>
                    {n.type === "slot-free" && onAction && (
                      <button className="btn primary small" onClick={() => { setOpen(false); onAction(n); }}>Book this slot</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Small reusable pieces ----------

// Message that appears at the bottom and hides itself after a few seconds
export function Toast({ toast, onDone }) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onDone, 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;
  return (
    <div className={"toast " + toast.type} role="status">
      <Icon name={toast.type === "error" ? "x" : "check"} size={18} />
      {toast.text}
    </div>
  );
}

// Reloads data from the database; the icon spins once when clicked
export function RefreshButton({ onClick }) {
  const [spinning, setSpinning] = useState(false);
  function handleClick() {
    setSpinning(true);
    onClick();
    setTimeout(() => setSpinning(false), 600);
  }
  return (
    <button className={"icon-btn" + (spinning ? " spinning" : "")} onClick={handleClick} title="Reload from database" aria-label="Refresh">
      <Icon name="refresh" size={18} />
    </button>
  );
}

export function EmptyState({ icon, title, text, children }) {
  return (
    <div className="empty-state">
      <span className="empty-icon"><Icon name={icon} size={26} /></span>
      <b>{title}</b>
      {text && <p>{text}</p>}
      {children}
    </div>
  );
}

// Calendar-style date box: month, day number and weekday
export function DateBlock({ date }) {
  const d = new Date(String(date) + "T00:00");
  if (isNaN(d)) return <div className="date-block"><b>-</b></div>;
  return (
    <div className="date-block">
      <span>{d.toLocaleDateString("en-IN", { month: "short" })}</span>
      <b>{d.getDate()}</b>
      <span>{DAY_NAMES[d.getDay()]}</span>
    </div>
  );
}

// Doctor profile card (used on the patient's doctor page and the doctor's own profile)
export function DoctorProfile({ doctor }) {
  const dept = deptStyle(doctor.specialization);
  const days = workingDays(doctor);
  return (
    <div className="card profile-card">
      <div className={"profile-hero " + dept.tone}>
        <DoctorAvatar doctor={doctor} size={132} />
      </div>
      <div className="profile-body">
        <h2>{doctor.name}</h2>
        <p className="muted">{doctor.qualification || doctor.specialization}</p>
        <span className={"dept-tag " + dept.tone}><Icon name={dept.icon} size={14} /> {doctor.specialization}</span>

        <div className="stats">
          <Stat icon="users" value={doctor.patientCount ?? 0} label="Patients" />
          <Stat icon="briefcase" value={doctor.experience ?? "-"} label="Years exp." />
          <Stat icon="rupee" value={doctor.fee != null ? "₹" + doctor.fee : "-"} label="Fee" />
          <Stat icon="calendar" value={days.length} label="Days a week" />
        </div>

        <h3>About</h3>
        <p className="about">{doctor.about || `${doctor.name} is a consultant in ${doctor.specialization} at CareConnect.`}</p>

        <h3>Working days</h3>
        <div className="day-pills">
          {DAY_NAMES.slice(1).map((d) => (
            <span key={d} className={days.includes(d) ? "on" : ""}>{d}</span>
          ))}
        </div>

        {doctor.leaveDates?.length > 0 && (
          <>
            <h3>On leave</h3>
            <div className="day-pills">
              {doctor.leaveDates.slice(0, 6).map((d) => (
                <span key={d} className="leave"><Icon name="umbrella" size={12} /> {showDate(d)}</span>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ icon, value, label }) {
  return (
    <div className="stat">
      <span className="stat-icon"><Icon name={icon} size={20} /></span>
      <b>{value}</b>
      <small>{label}</small>
    </div>
  );
}
