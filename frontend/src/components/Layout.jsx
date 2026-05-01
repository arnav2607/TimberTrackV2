import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Package, Ruler, BarChart3, LogOut, TreePine } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";

const navItems = [
  { to: "/", label: "Purchases", icon: Package, end: true, testid: "nav-purchases" },
  { to: "/measure", label: "Measure", icon: Ruler, testid: "nav-measure" },
  { to: "/dashboard", label: "Dashboard", icon: BarChart3, testid: "nav-dashboard" },
];

function initialsOf(name) {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join("");
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="app-shell bg-[#F4F4F5]">
      {/* Top header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="brand-grad w-10 h-10 rounded-xl flex items-center justify-center text-white">
              <TreePine className="w-5 h-5" strokeWidth={2.5} />
            </div>
            <div className="leading-tight">
              <div className="text-base sm:text-lg font-bold text-slate-900" data-testid="company-name">
                {user?.company_name || "TimberLog"}
              </div>
              <div className="text-xs uppercase tracking-wider text-emerald-800 font-semibold">
                Timber Log Tracker
              </div>
            </div>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-2">
            {navItems.map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                end={it.end}
                data-testid={`top-${it.testid}`}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 h-11 rounded-lg font-semibold text-sm transition ${
                    isActive
                      ? "bg-[#064E3B] text-white"
                      : "text-slate-700 hover:bg-slate-100"
                  }`
                }
              >
                <it.icon className="w-4 h-4" strokeWidth={2.5} />
                {it.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <div
              className="w-10 h-10 rounded-full bg-emerald-900 text-white flex items-center justify-center font-bold text-sm"
              data-testid="user-initials"
              title={user?.full_name || ""}
            >
              {initialsOf(user?.full_name)}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                logout();
                navigate("/login");
              }}
              data-testid="logout-btn"
              className="hidden sm:inline-flex h-10"
            >
              <LogOut className="w-4 h-4 mr-1" /> Logout
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                logout();
                navigate("/login");
              }}
              data-testid="logout-btn-mobile"
              className="sm:hidden h-10 w-10"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <Outlet />
      </main>

      {/* Bottom nav (mobile) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 bottom-nav-safe">
        <div className="grid grid-cols-3 h-16">
          {navItems.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              data-testid={`bottom-${it.testid}`}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1 ${
                  isActive ? "text-[#064E3B]" : "text-slate-500"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <it.icon
                    className="w-6 h-6"
                    strokeWidth={isActive ? 3 : 2.25}
                  />
                  <span className="text-xs font-semibold">{it.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
