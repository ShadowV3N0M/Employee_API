export const BASE_URL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== "undefined" && window.location.hostname
    ? `http://${window.location.hostname}:8000`
    : "http://127.0.0.1:8000");
const TOKEN_KEY = "emp_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

// Called when the server says our token is no longer valid (expired, user
// deactivated...). AuthProvider registers a handler that logs the user out.
let onUnauthorized = () => { };
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// FastAPI reports errors as {"detail": "..."} or, for validation problems,
// {"detail": [{"loc": [...], "msg": "..."}]}. slowapi uses {"error": "..."}.
function errorMessage(data, fallback) {
  if (!data) return fallback;
  if (typeof data.detail === "string") return data.detail;
  if (Array.isArray(data.detail)) {
    return data.detail
      .map((d) => `${(d.loc || []).slice(1).join(".")}: ${d.msg}`)
      .join("; ");
  }
  if (typeof data.error === "string") return data.error;
  return fallback;
}

async function request(path, { method = "GET", body, form, auth = true } = {}) {
  const headers = {};
  let payload;

  if (form) {
    // /auth/login uses the OAuth2 password flow: form-encoded, not JSON
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    payload = new URLSearchParams(form).toString();
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, { method, headers, body: payload });
  } catch {
    throw new ApiError("Cannot reach the server. Is the API running?", 0);
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    // empty or non-JSON body
  }

  if (!res.ok) {
    // A 401 on a logged-in request means the session is over. (Login itself
    // passes auth:false, so a wrong password doesn't trigger a logout.)
    if (res.status === 401 && auth) onUnauthorized();
    throw new ApiError(errorMessage(data, `Request failed (${res.status})`), res.status);
  }

  return data;
}

export const api = {
  // --- auth ---
  login: (username, password) =>
    request("/auth/login", { method: "POST", form: { username, password }, auth: false }),
  register: (username, password, email) =>
    request("/auth/register", {
      method: "POST",
      body: { username, password, email: email || undefined },
      auth: false,
    }),
  me: () => request("/auth/me"),
  forgotPassword: (identifier) =>
    request("/auth/forgot-password", {
      method: "POST",
      body: { identifier },
      auth: false,
    }),
  verifyResetToken: (token) =>
    request(`/auth/verify-reset-token?token=${encodeURIComponent(token)}`, { auth: false }),
  resetPassword: (token, new_password) =>
    request("/auth/reset-password", {
      method: "POST",
      body: { token, new_password },
      auth: false,
    }),

  // --- users (admin) ---
  listUsers: (params) => {
    const clean = Object.fromEntries(
      Object.entries(params || {}).filter(([_, v]) => v != null && v !== "")
    );
    const q = new URLSearchParams(clean).toString();
    return request(`/auth/users${q ? `?${q}` : ""}`);
  },
  createUser: (body) => request("/auth/users", { method: "POST", body }),
  changeRole: (username, role) =>
    request(`/auth/users/${encodeURIComponent(username)}/role`, {
      method: "PUT",
      body: { role },
    }),
  changeUserStatus: (username, is_active) =>
    request(`/auth/users/${encodeURIComponent(username)}/status`, {
      method: "PUT",
      body: { is_active },
    }),
  deleteUser: (username) =>
    request(`/auth/users/${encodeURIComponent(username)}`, { method: "DELETE" }),
  changePassword: (old_password, new_password) =>
    request("/auth/change-password", {
      method: "PUT",
      body: { old_password, new_password },
    }),

  // --- departments ---
  departments: (params) => api.listDepartments(params),
  listDepartments: (params) => {
    const clean = Object.fromEntries(
      Object.entries(params || {}).filter(([_, v]) => v != null && v !== "")
    );
    const q = new URLSearchParams(clean).toString();
    return request(`/departments${q ? `?${q}` : ""}`);
  },
  getDepartment: (id) => request(`/departments/${id}`),
  createDepartment: (body) => request("/departments", { method: "POST", body }),
  updateDepartment: (id, body) => request(`/departments/${id}`, { method: "PUT", body }),
  deleteDepartment: (id) => request(`/departments/${id}`, { method: "DELETE" }),
  departmentHistory: (id) => request(`/departments/${id}/history`),
  allDepartmentsHistory: () => request("/departments/history/all"),
  bulkCreateDepartments: (departments) =>
    request("/departments/bulk-create", { method: "POST", body: { departments } }),

  // --- employees ---
  getEmployees: (params) => api.listEmployees(params),
  listEmployees: (params) => {
    const clean = Object.fromEntries(
      Object.entries(params || {}).filter(([_, v]) => v != null && v !== "")
    );
    return request(`/employees?${new URLSearchParams(clean)}`);
  },
  getEmployee: (id) => request(`/employees/${id}`),
  createEmployee: (body) => request("/employees", { method: "POST", body }),
  updateEmployee: (id, body) => request(`/employees/${id}`, { method: "PATCH", body }),
  deactivateEmployee: (id) => request(`/employees/${id}/deactivate`, { method: "DELETE" }),
  deleteEmployee: (id) => request(`/employees/${id}/delete`, { method: "DELETE" }),
  restoreEmployee: (id) => request(`/employees/${id}/restore`, { method: "POST" }),
  bulkDeleteEmployees: (emp_ids, hard_delete = false) =>
    request("/employees/bulk-delete", {
      method: "POST",
      body: { emp_ids, hard_delete },
    }),
  bulkDeactivateEmployees: (emp_ids) =>
    request("/employees/bulk-deactivate", { method: "POST", body: emp_ids }),
  bulkRestoreEmployees: (emp_ids) =>
    request("/employees/bulk-restore", { method: "POST", body: emp_ids }),

  // --- salary ---
  setSalary: (id, new_salary) =>
    request(`/employees/${id}/salary`, { method: "PUT", body: { new_salary } }),
  incrementSalary: (id, amount) =>
    request(`/employees/${id}/salary/increment`, { method: "POST", body: { amount } }),
  bulkIncrementSalary: (body) =>
    request("/employees/salary/bulk-increment", { method: "POST", body }),
  getPayrollSummary: () => request("/employees/salary/summary"),
  getWorkforceAnalytics: () => request("/analytics/workforce"),
  calculateSalary: (body) => request("/employees/salary/calculate", { method: "POST", body }),
  getMySalaryProfile: () => request("/employees/salary/my-profile"),
  salaryHistory: (id, params) => {
    const clean = Object.fromEntries(
      Object.entries(params || {}).filter(([_, v]) => v != null && v !== "")
    );
    const q = new URLSearchParams(clean).toString();
    return request(`/employees/${id}/salary-history${q ? `?${q}` : ""}`);
  },

  // --- excel import & export ---
  uploadEmployeesExcel: async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    const token = getToken();
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    let res;
    try {
      res = await fetch(`${BASE_URL}/employees/upload-excel`, {
        method: "POST",
        headers,
        body: formData,
      });
    } catch {
      throw new ApiError("Cannot reach the server. Is the API running?", 0);
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new ApiError(errorMessage(data, `Upload failed (${res.status})`), res.status);
    }
    return data;
  },

  bulkActivateEmployeesExcel: async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    const token = getToken();
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    let res;
    try {
      res = await fetch(`${BASE_URL}/employees/bulk-activate-excel`, {
        method: "POST",
        headers,
        body: formData,
      });
    } catch {
      throw new ApiError("Cannot reach the server. Is the API running?", 0);
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new ApiError(errorMessage(data, `Bulk activation failed (${res.status})`), res.status);
    }
    return data;
  },

  bulkDeactivateEmployeesExcel: async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    const token = getToken();
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    let res;
    try {
      res = await fetch(`${BASE_URL}/employees/bulk-deactivate-excel`, {
        method: "POST",
        headers,
        body: formData,
      });
    } catch {
      throw new ApiError("Cannot reach the server. Is the API running?", 0);
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new ApiError(errorMessage(data, `Bulk deactivation failed (${res.status})`), res.status);
    }
    return data;
  },

  bulkDeleteEmployeesExcel: async (file, hard_delete = false) => {
    const formData = new FormData();
    formData.append("file", file);
    const token = getToken();
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    let res;
    try {
      res = await fetch(`${BASE_URL}/employees/bulk-delete-excel?hard_delete=${hard_delete}`, {
        method: "POST",
        headers,
        body: formData,
      });
    } catch {
      throw new ApiError("Cannot reach the server. Is the API running?", 0);
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new ApiError(errorMessage(data, `Bulk deletion failed (${res.status})`), res.status);
    }
    return data;
  },

  downloadEmployeeTemplate: (type = "full") => `${BASE_URL}/employees/template?template_type=${type}`,
  exportEmployeesUrl: (params = {}) => {
    if (typeof params === "boolean") {
      params = { include_inactive: params };
    }
    const clean = Object.fromEntries(
      Object.entries(params || {}).filter(([_, v]) => v != null && v !== "")
    );
    const token = getToken();
    if (token) clean.token = token;
    const q = new URLSearchParams(clean).toString();
    return `${BASE_URL}/employees/export${q ? `?${q}` : ""}`;
  },

  downloadBlob: async (url, filename) => {
    const token = getToken();
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    let res;
    try {
      res = await fetch(url, { headers });
    } catch {
      throw new ApiError("Cannot reach the server. Is the API running?", 0);
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new ApiError(errorMessage(data, `Download failed (${res.status})`), res.status);
    }

    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
  },

  // --- holidays & calendar ---
  listHolidays: (params) => {
    const clean = Object.fromEntries(
      Object.entries(params || {}).filter(([_, v]) => v != null && v !== "")
    );
    const q = new URLSearchParams(clean).toString();
    return request(`/holidays${q ? `?${q}` : ""}`);
  },
  upcomingHolidays: (limit = 5) => request(`/holidays/upcoming?limit=${limit}`),
  calculateBusinessDays: (startDate, endDate) =>
    request(
      `/holidays/business-days?start_date=${encodeURIComponent(
        startDate
      )}&end_date=${encodeURIComponent(endDate)}`
    ),
  createHoliday: (body) => request("/holidays", { method: "POST", body }),
  updateHoliday: (id, body) => request(`/holidays/${id}`, { method: "PUT", body }),
  deleteHoliday: (id) => request(`/holidays/${id}`, { method: "DELETE" }),
  seedDefaultHolidays: (year = 2026) =>
    request(`/holidays/seed-defaults?year=${year}`, { method: "POST" }),

  // --- announcements ---
  listAnnouncements: (params) => {
    const clean = Object.fromEntries(
      Object.entries(params || {}).filter(([_, v]) => v != null && v !== "")
    );
    const q = new URLSearchParams(clean).toString();
    return request(`/announcements${q ? `?${q}` : ""}`);
  },
  createAnnouncement: (body) => request("/announcements", { method: "POST", body }),
  updateAnnouncement: (id, body) => request(`/announcements/${id}`, { method: "PUT", body }),
  deleteAnnouncement: (id) => request(`/announcements/${id}`, { method: "DELETE" }),
  
  // --- notifications & real-time alerts ---
  listNotifications: (unreadOnly = false, limit = 50) =>
    request(`/notifications?unread_only=${unreadOnly}&limit=${limit}`),
  getUnreadNotificationCount: () => request("/notifications/unread-count"),
  markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: "PATCH" }),
  markAllNotificationsRead: () => request("/notifications/mark-all-read", { method: "PATCH" }),
  deleteNotification: (id) => request(`/notifications/${id}`, { method: "DELETE" }),
  clearAllReadNotifications: () => request("/notifications/clear-all", { method: "DELETE" }),
  broadcastNotification: (body) => request("/notifications/broadcast", { method: "POST", body }),

  // --- employee self-service profile & emergency contacts ---
  getMyProfile: () => request("/employees/me/profile"),
  updateMyProfile: (body) => request("/employees/me/profile", { method: "PUT", body }),
  listMyEmergencyContacts: () => request("/employees/me/emergency-contacts"),
  addMyEmergencyContact: (body) => request("/employees/me/emergency-contacts", { method: "POST", body }),
  updateMyEmergencyContact: (id, body) => request(`/employees/me/emergency-contacts/${id}`, { method: "PUT", body }),
  deleteMyEmergencyContact: (id) => request(`/employees/me/emergency-contacts/${id}`, { method: "DELETE" }),
  getEmployeeEmergencyContacts: (empId) => request(`/employees/${empId}/emergency-contacts`),
  addEmployeeEmergencyContact: (empId, body) => request(`/employees/${empId}/emergency-contacts`, { method: "POST", body }),
  deleteEmployeeEmergencyContact: (empId, contactId) => request(`/employees/${empId}/emergency-contacts/${contactId}`, { method: "DELETE" }),
  linkUserToEmployee: (body) => request("/employees/link-user", { method: "POST", body }),

  // --- official reports & PDF exports ---
  downloadPdf: async (path, filename) => {
    const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
    return api.downloadBlob(url, filename);
  },

  previewPdf: async (path) => {
    const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
    const token = getToken();
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    let res;
    try {
      res = await fetch(url, { headers });
    } catch {
      throw new ApiError("Cannot reach the server. Is the API running?", 0);
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new ApiError(errorMessage(data, `Failed to load PDF (${res.status})`), res.status);
    }

    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    window.open(blobUrl, "_blank");
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 30000);
  },

  getPayslipPdfUrl: (empId, { month, year, regime = "new", isMetro = false, inline = true } = {}) => {
    const params = new URLSearchParams();
    if (month) params.set("month", month);
    if (year) params.set("year", year);
    if (regime) params.set("regime", regime);
    if (isMetro) params.set("is_metro", "true");
    params.set("inline", String(inline));
    return `/reports/payslip/${empId}/pdf?${params.toString()}`;
  },

  getMyPayslipPdfUrl: ({ month, year, regime = "new", isMetro = false, inline = true } = {}) => {
    const params = new URLSearchParams();
    if (month) params.set("month", month);
    if (year) params.set("year", year);
    if (regime) params.set("regime", regime);
    if (isMetro) params.set("is_metro", "true");
    params.set("inline", String(inline));
    return `/reports/my-payslip/pdf?${params.toString()}`;
  },

  getEmployeesPdfUrl: ({ deptId, status = "all", search, inline = true } = {}) => {
    const params = new URLSearchParams();
    if (deptId) params.set("dept_id", deptId);
    if (status) params.set("status", status);
    if (search) params.set("search", search);
    params.set("inline", String(inline));
    return `/reports/employees/pdf?${params.toString()}`;
  },

  getDepartmentsPdfUrl: ({ inline = true } = {}) => {
    return `/reports/departments/pdf?inline=${String(inline)}`;
  },

  getSalaryRevisionPdfUrl: (empId, { inline = true } = {}) => {
    return `/reports/salary-revisions/${empId}/pdf?inline=${String(inline)}`;
  },

  getMySalaryRevisionPdfUrl: ({ inline = true } = {}) => {
    return `/reports/my-salary-revision/pdf?inline=${String(inline)}`;
  },
};

