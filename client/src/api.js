// Common helpers used by all pages

// Calls the Express backend and returns the JSON data
export async function api(url, method = "GET", body) {
  const res = await fetch("/api" + url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Cannot reach the server. Check that the backend is running.");
  return data;
}

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Appointment times offered by the clinic (stored in 24-hour format)
export const TIME_SLOTS = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
];

// Today's date as "YYYY-MM-DD"
export const today = () => new Date().toLocaleDateString("en-CA");

// The next few days, used for the date picker
export function nextDays(count) {
  const days = [];
  for (let i = 0; i < count; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push({
      value: d.toLocaleDateString("en-CA"),
      day: DAY_NAMES[d.getDay()],
      date: d.getDate(),
      month: d.toLocaleDateString("en-IN", { month: "short" }),
    });
  }
  return days;
}

// True when the slot is today and the time has already passed
export function isPastSlot(date, time) {
  if (date !== today()) return false;
  const now = new Date();
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m <= now.getHours() * 60 + now.getMinutes();
}

// Days a doctor works (all weekdays if not set in the database)
export function workingDays(doctor) {
  return doctor.availableDays?.length ? doctor.availableDays : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
}

export function daysText(doctor) {
  const days = workingDays(doctor);
  return days.length === 6 ? "Mon to Sat" : days.join(", ");
}

// True when the doctor can be booked on this day:
// a working day, not on leave, and (for today) not already over
export function isOpenOn(doctor, d) {
  if (d.day === "Sun" || !workingDays(doctor).includes(d.day)) return false;
  if ((doctor.leaveDates || []).includes(d.value)) return false;
  return !(d.value === today() && isPastSlot(d.value, TIME_SLOTS[TIME_SLOTS.length - 1]));
}

// First day the doctor can be booked
export function nextAvailable(doctor) {
  return nextDays(30).find((d) => isOpenOn(doctor, d)) || null;
}

// Day from nextDays() -> "Today", "Tomorrow" or "Wed, 4 Nov"
export function dayLabel(d) {
  if (d.value === today()) return "Today";
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (d.value === tomorrow.toLocaleDateString("en-CA")) return "Tomorrow";
  return `${d.day}, ${d.date} ${d.month}`;
}

// "just now", "5 min ago", "2 h ago" or a date
export function timeAgo(value) {
  const seconds = (Date.now() - new Date(value)) / 1000;
  if (seconds < 60) return "just now";
  if (seconds < 3600) return Math.floor(seconds / 60) + " min ago";
  if (seconds < 86400) return Math.floor(seconds / 3600) + " h ago";
  return showDate(value);
}

// "Tuesday, 3 November"
export const todayLong = () => new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

export function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

// "2026-11-05" -> "05 Nov 2026"
export function showDate(value) {
  const d = new Date(String(value).slice(0, 10) + "T00:00");
  if (isNaN(d)) return value || "-";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// "14:30" -> "2:30 PM"
export function showTime(value) {
  if (!/^\d{1,2}:\d{2}$/.test(value)) return value || "-";
  const [h, m] = value.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

// Shrinks a chosen picture to a small square JPEG so it can be saved in MongoDB
export function resizeImage(file, size = 320) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const x = (img.width - side) / 2;
      const y = img.height > img.width ? (img.height - side) * 0.2 : 0; // keep the face in tall photos
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      canvas.getContext("2d").drawImage(img, x, y, side, side, 0, 0, size, size);
      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => reject(new Error("This file is not a picture. Please choose a JPG or PNG image."));
    img.src = URL.createObjectURL(file);
  });
}

// CSS class for the coloured status label
export const statusClass = (status = "") => "status " + String(status).toLowerCase();
