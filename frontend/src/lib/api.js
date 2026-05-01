import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("tl_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem("tl_token");
      localStorage.removeItem("tl_user");
      if (!window.location.pathname.startsWith("/login") && !window.location.pathname.startsWith("/signup")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

export default api;

export function formatErr(detail) {
  if (!detail) return "Something went wrong.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => e?.msg || JSON.stringify(e)).join(" ");
  if (detail?.msg) return detail.msg;
  return String(detail);
}

// Supplier APIs
export const getSuppliers = () => api.get("/suppliers");
export const createSupplier = (name) => api.post("/suppliers", { name });

// Country APIs
export const getCountries = () => api.get("/countries");
export const createCountry = (name) => api.post("/countries", { name });
export const seedCountries = () => api.post("/countries/seed");

// Enhanced Dashboard
export const getDashboardKPIs = () => api.get("/dashboard/kpis");

// Container completion form
export const updateContainerCompletionForm = (containerId, data) =>
  api.patch(`/containers/${containerId}/completion-form`, data);
