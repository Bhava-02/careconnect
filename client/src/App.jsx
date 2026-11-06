import { useState } from "react";
import Login from "./Login";
import PatientPage from "./PatientPage";
import DoctorPage from "./DoctorPage";
import AdminPage from "./AdminPage";

export default function App() {
  // The signed-in user is kept in localStorage so a page refresh does not sign out
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("cc_user")));

  function signIn(userData) {
    localStorage.setItem("cc_user", JSON.stringify(userData));
    setUser(userData);
  }

  function signOut() {
    localStorage.removeItem("cc_user");
    setUser(null);
  }

  // Each role sees a different page
  if (!user) return <Login onSignIn={signIn} />;
  if (user.role === "patient") return <PatientPage user={user} onSignOut={signOut} />;
  if (user.role === "doctor") return <DoctorPage user={user} onSignOut={signOut} />;
  return <AdminPage user={user} onSignOut={signOut} />;
}
