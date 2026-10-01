// All communication with the FastAPI backend goes through this file.

const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
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
  listUsers: () => request("/auth/users"),
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
  listDepartments: () => request("/departments"),
  getDepartment: (id) => request(`/departments/${id}`),
  createDepartment: (body) => request("/departments", { method: "POST", body }),
  updateDepartment: (id, body) => request(`/departments/${id}`, { method: "PUT", body }),
  deleteDepartment: (id) => request(`/departments/${id}`, { method: "DELETE" }),
  bulkCreateDepartments: (departments) =>
    request("/departments/bulk-create", { method: "POST", body: { departments } }),

  // --- employees ---
  listEmployees: (params) => request(`/employees?${new URLSearchParams(params)}`),
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
  salaryHistory: (id) => request(`/employees/${id}/salary-history`),

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

  downloadEmployeeTemplate: () => `${BASE_URL}/employees/template`,
  exportEmployeesUrl: (include_inactive = false) =>
    `${BASE_URL}/employees/export?include_inactive=${include_inactive}`,
};


