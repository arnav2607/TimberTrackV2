import React, { createContext, useContext, useEffect, useState } from "react";
import api from "@/lib/api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("tl_token");
    if (!token) {
      setUser(null);
      setBooting(false);
      return;
    }
    api
      .get("/auth/me")
      .then((res) => setUser(res.data))
      .catch(() => setUser(null))
      .finally(() => setBooting(false));
  }, []);

  const login = async (username, password) => {
    const { data } = await api.post("/auth/login", { username, password });
    localStorage.setItem("tl_token", data.token);
    localStorage.setItem("tl_user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const signup = async (payload) => {
    const { data } = await api.post("/auth/signup", payload);
    localStorage.setItem("tl_token", data.token);
    localStorage.setItem("tl_user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem("tl_token");
    localStorage.removeItem("tl_user");
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, login, signup, logout, booting }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
