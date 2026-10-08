import axios from "axios";

const rawBaseUrl = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
export const API_BASE_URL = rawBaseUrl.replace(/\/+$/, "");

let inMemoryAccessToken = null;

export function setAccessToken(token) {
  inMemoryAccessToken = token;
}

export function getAccessToken() {
  return inMemoryAccessToken;
}

/**
 * Extracts a standardized, human-readable error message from any API error response.
 */
export function formatApiError(error) {
  if (!error) return "An unexpected error occurred.";
  if (typeof error === "string") return error;

  // Axios error structure
  if (error.response && error.response.data) {
    const data = error.response.data;
    if (typeof data === "string") return data;
    if (data.detail) return data.detail;
    if (data.error) return data.error;
    if (data.message) return data.message;
    if (Array.isArray(data.non_field_errors)) return data.non_field_errors.join(" ");

    // Handle dictionary of field validation errors { email: ["Invalid email"], ... }
    const fieldErrors = Object.entries(data)
      .map(([field, msgs]) => {
        const msgStr = Array.isArray(msgs) ? msgs.join(", ") : String(msgs);
        return `${field}: ${msgStr}`;
      })
      .join(" | ");
    if (fieldErrors) return fieldErrors;
  }

  if (error.message) return error.message;
  return "Request failed. Please verify network connection or try again.";
}

// ── Standardized Axios Client ──
export const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Sends HttpOnly JWT cookies across origins
  timeout: 15000,
});

// Request Interceptor: Attach in-memory JWT bearer token if available
axiosInstance.interceptors.request.use(
  (config) => {
    if (inMemoryAccessToken && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${inMemoryAccessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Automatic 401 Token Refresh
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (
      error.response &&
      error.response.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/auth/login/") &&
      !originalRequest.url?.includes("/auth/token/refresh/")
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return axiosInstance(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshRes = await axios.post(
          `${API_BASE_URL}/api/v1/auth/token/refresh/`,
          {},
          { withCredentials: true }
        );
        const newAccess = refreshRes.data?.access;
        if (newAccess) {
          setAccessToken(newAccess);
          axiosInstance.defaults.headers.common.Authorization = `Bearer ${newAccess}`;
          originalRequest.headers.Authorization = `Bearer ${newAccess}`;
          processQueue(null, newAccess);
          return axiosInstance(originalRequest);
        }
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        setAccessToken(null);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Universal fetch-compatible client used across services.
 * Integrates token handling, cookies, and standard responses.
 */
export async function apiClient(endpoint, options = {}) {
  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`;
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...options.headers,
  };

  if (inMemoryAccessToken && !headers.Authorization) {
    headers.Authorization = `Bearer ${inMemoryAccessToken}`;
  }

  const fetchOptions = {
    ...options,
    headers,
    credentials: "include",
  };

  let response = await fetch(url, fetchOptions);

  if (
    response.status === 401 &&
    !endpoint.includes("/auth/login/") &&
    !endpoint.includes("/auth/token/refresh/")
  ) {
    try {
      const refreshResponse = await fetch(`${API_BASE_URL}/api/v1/auth/token/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        if (refreshData.access) {
          setAccessToken(refreshData.access);
          headers.Authorization = `Bearer ${refreshData.access}`;
          response = await fetch(url, { ...fetchOptions, headers });
        }
      } else {
        setAccessToken(null);
      }
    } catch {
      setAccessToken(null);
    }
  }

  return response;
}
