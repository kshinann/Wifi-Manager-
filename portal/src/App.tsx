import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import { useAuth, useCan } from "./auth";
import Dashboard from "./pages/Dashboard";
import Devices from "./pages/Devices";
import Groups from "./pages/Groups";
import Login from "./pages/Login";
import Platform from "./pages/Platform";
import Policies from "./pages/Policies";
import Settings from "./pages/Settings";
import Tools from "./pages/Tools";
import Usage from "./pages/Usage";
import Users from "./pages/Users";

function Shell() {
  const { session, signOut } = useAuth();
  const isAdmin = useCan("admin");
  const user = session!.user;
  const inTenant = !!session!.tenant;

  return (
    <div className="layout">
      <nav className="sidebar" aria-label="Main">
        <div className="brand">
          AI Guard
          <small>{session!.tenant?.name || "Platform"}</small>
        </div>
        {inTenant && (
          <>
            <NavLink to="/" end>Dashboard</NavLink>
            <NavLink to="/usage">Usage log</NavLink>
            <NavLink to="/devices">Devices</NavLink>
            <NavLink to="/groups">Groups</NavLink>
            <NavLink to="/policies">Policies</NavLink>
            <NavLink to="/tools">AI tools</NavLink>
            {isAdmin && <NavLink to="/users">Users</NavLink>}
            <NavLink to="/settings">Settings</NavLink>
          </>
        )}
        {user.is_platform_admin && <NavLink to="/platform">Tenants</NavLink>}
        <div className="spacer" />
        <div className="who">{user.email} · {user.role}</div>
        <button className="link" style={{ textAlign: "left", padding: "4px 10px" }} onClick={signOut}>Sign out</button>
      </nav>
      <main className="content">
        <Routes>
          {inTenant ? (
            <>
              <Route path="/" element={<Dashboard />} />
              <Route path="/usage" element={<Usage />} />
              <Route path="/devices" element={<Devices />} />
              <Route path="/groups" element={<Groups />} />
              <Route path="/policies" element={<Policies />} />
              <Route path="/tools" element={<Tools />} />
              <Route path="/users" element={<Users />} />
              <Route path="/settings" element={<Settings />} />
            </>
          ) : (
            <Route path="/" element={<Navigate to="/platform" replace />} />
          )}
          {user.is_platform_admin && <Route path="/platform" element={<Platform />} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  const { session, loading } = useAuth();
  if (loading) return <div className="login subtle">Loading…</div>;
  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/*" element={session ? <Shell /> : <Navigate to="/login" replace />} />
    </Routes>
  );
}
