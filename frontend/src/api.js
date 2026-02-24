import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const api = axios.create({ baseURL: BASE_URL });

// Attach JWT token to every request if present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const login = (username, password) =>
  api.post("/auth/login", new URLSearchParams({ username, password }), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

export const getProfile = () => api.get("/auth/me");
export const getGreeting = () => api.get("/api/greeting");

// Market
export const getEquity = (params) => api.get("/api/equity", { params });
export const getFixedIncome = () => api.get("/api/fixed-income");
export const getCurrency = (params) => api.get("/api/currency", { params });
export const getEconomic = () => api.get("/api/economic");
export const getHeatmap = (params) => api.get("/api/heatmap", { params });

// Analysis
export const getPerformance = (params) => api.get("/api/performance", { params });
export const getPortfolio = (params) => api.get("/api/portfolio", { params });
export const getFactors = (params) => api.get("/api/factors", { params });
export const getFactorDatasets = () => api.get("/api/factors/datasets");
export const getPeers = (params) => api.get("/api/peers", { params });

// Model
export const getOptions = (params) => api.get("/api/options", { params });
export const getOptionStrategies = () => api.get("/api/options/strategies");
export const getALM = (params) => api.get("/api/alm", { params });
export const getLinking = (params) => api.get("/api/linking", { params });

export default api;
