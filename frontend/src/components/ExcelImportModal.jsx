import { useState } from "react";
import { api } from "../api";
import Modal from "./Modal";

export default function ExcelImportModal({ onClose, onSuccess }) {
  // mode: "add" | "activate" | "deactivate" | "delete"
  const [mode, setMode] = useState("add");
  const [file, setFile] = useState(null);
  const [hardDelete, setHardDelete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const switchMode = (newMode) => {
    setMode(newMode);
    setFile(null);
    setResult(null);
    setError("");
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError("");
      setResult(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError("Please select an Excel (.xlsx, .xls) or CSV (.csv) file.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      if (mode === "add" || mode === "import") {
        const res = await api.uploadEmployeesExcel(file);
        setResult(res);
        if (res.inserted > 0) {
          onSuccess(res.message);
        }
      } else if (mode === "activate") {
        const res = await api.bulkActivateEmployeesExcel(file);
        setResult(res);
        if (res.affected_count > 0 || res.users_affected_count > 0) {
          onSuccess(res.message);
        }
      } else if (mode === "deactivate") {
        const res = await api.bulkDeactivateEmployeesExcel(file);
        setResult(res);
        if (res.affected_count > 0 || res.users_affected_count > 0) {
          onSuccess(res.message);
        }
      } else if (mode === "delete") {
        const res = await api.bulkDeleteEmployeesExcel(file, hardDelete);
        setResult(res);
        if (res.affected_count > 0 || res.users_affected_count > 0) {
          onSuccess(res.message);
        }
      }
    } catch (err) {
      setError(err.message || "Failed to process spreadsheet");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTemplate = async (templateType, filename) => {
    try {
      await api.downloadBlob(
        api.downloadEmployeeTemplate(templateType),
        filename
      );
    } catch {
      window.location.href = api.downloadEmployeeTemplate(templateType);
    }
  };

  return (
    <Modal
      title="📊 Excel Hub — Bulk Employee & User Management"
      onClose={onClose}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Mode Selector Tabs */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            borderBottom: "1px solid var(--border)",
            paddingBottom: "10px",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            className={`btn ${mode === "add" ? "primary" : "ghost"}`}
            style={{ fontSize: "13px", padding: "6px 14px" }}
            onClick={() => switchMode("add")}
          >
            📥 Bulk Add
          </button>
          <button
            type="button"
            className={`btn ${mode === "activate" ? "primary" : "ghost"}`}
            style={{
              fontSize: "13px",
              padding: "6px 14px",
              background: mode === "activate" ? "var(--success, #10b981)" : "transparent",
              color: mode === "activate" ? "#fff" : "var(--text)",
              borderColor: mode === "activate" ? "var(--success, #10b981)" : "var(--border)",
            }}
            onClick={() => switchMode("activate")}
          >
            ⚡ Bulk Activate
          </button>
          <button
            type="button"
            className={`btn ${mode === "deactivate" ? "secondary" : "ghost"}`}
            style={{
              fontSize: "13px",
              padding: "6px 14px",
              background: mode === "deactivate" ? "var(--warning, #f59e0b)" : "transparent",
              color: mode === "deactivate" ? "#fff" : "var(--text)",
              borderColor: mode === "deactivate" ? "var(--warning, #f59e0b)" : "var(--border)",
            }}
            onClick={() => switchMode("deactivate")}
          >
            ⏸️ Bulk Deactivate
          </button>
          <button
            type="button"
            className={`btn ${mode === "delete" ? "danger" : "ghost"}`}
            style={{
              fontSize: "13px",
              padding: "6px 14px",
              color: mode === "delete" ? "#fff" : "var(--danger)",
            }}
            onClick={() => switchMode("delete")}
          >
            🗑️ Bulk Delete
          </button>
        </div>

        {/* Dynamic Mode Guide */}
        {mode === "add" && (
          <div
            style={{
              background: "var(--surface-alt)",
              border: "1px solid var(--border)",
              padding: "14px",
              borderRadius: "8px",
              fontSize: "13px",
              color: "var(--text)",
            }}
          >
            <strong style={{ color: "var(--text-heading)", display: "block", marginBottom: "6px" }}>
              Bulk Add / Import Guide (.xlsx, .xls, .csv):
            </strong>
            <ul style={{ margin: "0 0 0 18px", padding: 0, lineHeight: 1.6 }}>
              <li>
                <code>F_Name</code>, <code>L_Name</code>, <code>Salary</code>{" "}
                <span style={{ color: "var(--danger)", fontSize: "11px", fontWeight: "600" }}>
                  (Required)
                </span>
              </li>
              <li>
                <code>Department</code> (e.g. "Engineering") or <code>Dept_ID</code>{" "}
                <span style={{ color: "var(--danger)", fontSize: "11px", fontWeight: "600" }}>
                  (Required)
                </span>
              </li>
              <li>
                <code>Address</code>, <code>Emp_ID</code>, <code>Email</code>, <code>Joining_Date</code>, <code>Status</code>{" "}
                <span style={{ color: "var(--muted)", fontSize: "11px" }}>(Optional)</span>
              </li>
            </ul>
            <p style={{ margin: "8px 0 0 0", fontSize: "12px", color: "var(--muted)" }}>
              💡 Automatically assigns IDs, generates company emails, and reactivates any soft-deleted records.
            </p>
            <div style={{ marginTop: "12px", paddingTop: "10px", borderTop: "1px dashed var(--border)" }}>
              <button
                type="button"
                className="btn link"
                style={{ fontSize: "13px", padding: 0, textDecoration: "underline", cursor: "pointer" }}
                onClick={() => handleDownloadTemplate("full", "employee_add_template.csv")}
              >
                📥 Download Sample Add Template (.csv)
              </button>
            </div>
          </div>
        )}

        {mode === "activate" && (
          <div
            style={{
              background: "rgba(16, 185, 129, 0.08)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              padding: "14px",
              borderRadius: "8px",
              fontSize: "13px",
              color: "var(--text)",
            }}
          >
            <strong style={{ color: "var(--success, #10b981)", display: "block", marginBottom: "6px" }}>
              ⚡ Bulk Activation Guide (.xlsx, .xls, .csv):
            </strong>
            <p style={{ margin: "0 0 8px 0", lineHeight: 1.5 }}>
              Upload a spreadsheet or CSV containing an <code>Emp_ID</code>, <code>Email</code>, or <code>Username</code> column.
            </p>
            <p style={{ margin: "0", fontSize: "12px", color: "var(--muted)", lineHeight: 1.5 }}>
              ✅ All matched employee profiles will be restored to <strong>Active</strong> state, and logins for linked user accounts will be reenacted immediately.
            </p>
            <div style={{ marginTop: "12px", paddingTop: "10px", borderTop: "1px dashed rgba(16, 185, 129, 0.3)" }}>
              <button
                type="button"
                className="btn link"
                style={{ fontSize: "13px", padding: 0, textDecoration: "underline", cursor: "pointer" }}
                onClick={() => handleDownloadTemplate("identifiers", "employee_identifier_template.csv")}
              >
                📥 Download Identifier Template (.csv)
              </button>
            </div>
          </div>
        )}

        {mode === "deactivate" && (
          <div
            style={{
              background: "rgba(245, 158, 11, 0.08)",
              border: "1px solid rgba(245, 158, 11, 0.3)",
              padding: "14px",
              borderRadius: "8px",
              fontSize: "13px",
              color: "var(--text)",
            }}
          >
            <strong style={{ color: "var(--warning, #f59e0b)", display: "block", marginBottom: "6px" }}>
              ⏸️ Bulk Deactivation Guide (.xlsx, .xls, .csv):
            </strong>
            <p style={{ margin: "0 0 8px 0", lineHeight: 1.5 }}>
              Upload a spreadsheet or CSV containing an <code>Emp_ID</code>, <code>Email</code>, or <code>Username</code> column.
            </p>
            <p style={{ margin: "0", fontSize: "12px", color: "var(--muted)", lineHeight: 1.5 }}>
              🛡️ Safely soft-deactivates employee profiles (hidden from active directory) and suspends linked user logins without erasing any history or salary records.
            </p>
            <div style={{ marginTop: "12px", paddingTop: "10px", borderTop: "1px dashed rgba(245, 158, 11, 0.3)" }}>
              <button
                type="button"
                className="btn link"
                style={{ fontSize: "13px", padding: 0, textDecoration: "underline", cursor: "pointer" }}
                onClick={() => handleDownloadTemplate("identifiers", "employee_identifier_template.csv")}
              >
                📥 Download Identifier Template (.csv)
              </button>
            </div>
          </div>
        )}

        {mode === "delete" && (
          <div
            style={{
              background: "var(--danger-bg)",
              border: "1px solid var(--danger-border)",
              padding: "14px",
              borderRadius: "8px",
              fontSize: "13px",
              color: "var(--danger-text)",
            }}
          >
            <strong style={{ color: "var(--danger)", display: "block", marginBottom: "4px" }}>
              🗑️ Bulk Deletion Guide (.xlsx, .xls, .csv):
            </strong>
            <p style={{ margin: "0 0 10px 0", color: "var(--text)", lineHeight: 1.5 }}>
              Upload a spreadsheet or CSV containing an <code>Emp_ID</code>, <code>Email</code>, or <code>Username</code> column.
            </p>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontWeight: "600",
                cursor: "pointer",
                color: "var(--danger)",
                marginBottom: "8px",
              }}
            >
              <input
                type="checkbox"
                checked={hardDelete}
                onChange={(e) => setHardDelete(e.target.checked)}
              />
              Hard Delete (Permanently remove records from database instead of soft-deactivation)
            </label>
            {hardDelete && (
              <p style={{ margin: "0 0 8px 0", fontSize: "12px", color: "var(--danger)", fontWeight: "500" }}>
                ⚠️ Warning: Hard delete permanently purges employee profiles, salary histories, and emergency contacts.
              </p>
            )}
            <div style={{ marginTop: "10px", paddingTop: "8px", borderTop: "1px dashed var(--danger-border)" }}>
              <button
                type="button"
                className="btn link"
                style={{ fontSize: "13px", padding: 0, textDecoration: "underline", cursor: "pointer", color: "var(--danger)" }}
                onClick={() => handleDownloadTemplate("identifiers", "employee_identifier_template.csv")}
              >
                📥 Download Identifier Template (.csv)
              </button>
            </div>
          </div>
        )}

        {error && <div className="alert error">{error}</div>}

        {!result ? (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div
              style={{
                border: "2px dashed var(--border)",
                borderRadius: "10px",
                padding: "24px 20px",
                textAlign: "center",
                background: "var(--surface-alt)",
                transition: "border-color 0.2s ease, background-color 0.2s ease",
              }}
            >
              <input
                type="file"
                id="excelFileInput"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                disabled={loading}
                style={{ display: "none" }}
              />
              <label
                htmlFor="excelFileInput"
                style={{
                  cursor: "pointer",
                  display: "inline-block",
                  padding: "9px 18px",
                  background:
                    mode === "delete"
                      ? "var(--danger)"
                      : mode === "deactivate"
                      ? "var(--warning, #f59e0b)"
                      : mode === "activate"
                      ? "var(--success, #10b981)"
                      : "var(--primary)",
                  color: "#fff",
                  borderRadius: "8px",
                  fontWeight: "600",
                  fontSize: "14px",
                  transition: "opacity 0.15s ease",
                }}
              >
                Choose {mode === "delete" ? "Deletion" : mode === "activate" ? "Activation" : mode === "deactivate" ? "Deactivation" : "Employee"} File (.xlsx / .xls / .csv)
              </label>
              <div
                style={{
                  marginTop: "12px",
                  fontSize: "13px",
                  color: file ? "var(--text)" : "var(--muted)",
                  fontWeight: file ? "600" : "normal",
                }}
              >
                {file
                  ? `📄 Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`
                  : "No file selected (Supports .xlsx, .xls, .csv)"}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button type="button" className="btn ghost" onClick={onClose} disabled={loading}>
                Cancel
              </button>
              <button
                type="submit"
                className={`btn ${
                  mode === "delete"
                    ? "danger"
                    : mode === "deactivate"
                    ? "secondary"
                    : "primary"
                }`}
                style={
                  mode === "activate"
                    ? { background: "var(--success, #10b981)", borderColor: "var(--success, #10b981)", color: "#fff" }
                    : mode === "deactivate"
                    ? { background: "var(--warning, #f59e0b)", borderColor: "var(--warning, #f59e0b)", color: "#fff" }
                    : undefined
                }
                disabled={!file || loading}
              >
                {loading
                  ? "Processing Spreadsheet..."
                  : mode === "delete"
                  ? hardDelete
                    ? "Execute Hard Delete"
                    : "Execute Bulk Deactivate"
                  : mode === "activate"
                  ? "Execute Bulk Activation"
                  : mode === "deactivate"
                  ? "Execute Bulk Deactivation"
                  : "Upload & Add Employees"}
              </button>
            </div>
          </form>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div
              className={`alert ${
                mode === "delete" && hardDelete
                  ? "error"
                  : mode === "deactivate"
                  ? "warning"
                  : "success"
              }`}
              style={{ margin: 0 }}
            >
              <strong>{result.message}</strong>
            </div>

            {/* Summary Statistics */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(130px, 100%), 1fr))",
                gap: "10px",
                margin: "4px 0",
              }}
            >
              <div
                style={{
                  background: "var(--surface-alt)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  padding: "10px 12px",
                }}
              >
                <div style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase" }}>
                  Employees Affected
                </div>
                <div style={{ fontSize: "20px", fontWeight: "700", color: "var(--text-heading)", marginTop: "2px" }}>
                  {result.inserted ?? result.affected_count ?? 0}
                </div>
              </div>

              {result.users_affected_count !== undefined && (
                <div
                  style={{
                    background: "var(--surface-alt)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    padding: "10px 12px",
                  }}
                >
                  <div style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase" }}>
                    Users Affected
                  </div>
                  <div style={{ fontSize: "20px", fontWeight: "700", color: "var(--text-heading)", marginTop: "2px" }}>
                    {result.users_affected_count}
                  </div>
                </div>
              )}

              {result.skipped !== undefined && (
                <div
                  style={{
                    background: "var(--surface-alt)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    padding: "10px 12px",
                  }}
                >
                  <div style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase" }}>
                    Skipped Rows
                  </div>
                  <div style={{ fontSize: "20px", fontWeight: "700", color: "var(--danger)", marginTop: "2px" }}>
                    {result.skipped}
                  </div>
                </div>
              )}

              {result.not_found && result.not_found.length > 0 && (
                <div
                  style={{
                    background: "var(--surface-alt)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    padding: "10px 12px",
                  }}
                >
                  <div style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase" }}>
                    Unmatched Items
                  </div>
                  <div style={{ fontSize: "20px", fontWeight: "700", color: "var(--warning, #f59e0b)", marginTop: "2px" }}>
                    {result.not_found.length}
                  </div>
                </div>
              )}
            </div>

            {/* Skipped Rows (Add Mode) */}
            {result.errors && result.errors.length > 0 && (
              <div>
                <strong style={{ fontSize: "13px", color: "var(--danger)" }}>
                  Skipped Rows ({result.errors.length}):
                </strong>
                <div
                  style={{
                    maxHeight: "150px",
                    overflowY: "auto",
                    border: "1px solid var(--danger-border)",
                    borderRadius: "8px",
                    marginTop: "6px",
                    background: "var(--danger-bg)",
                    padding: "8px 12px",
                    fontSize: "12px",
                    color: "var(--text)",
                  }}
                >
                  {result.errors.map((err, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: "5px 0",
                        borderBottom:
                          idx === result.errors.length - 1 ? "none" : "1px solid var(--danger-border)",
                      }}
                    >
                      Row {err.row}
                      {err.emp_id ? ` (ID: ${err.emp_id})` : ""}: <strong>{err.error}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Unmatched Identifiers (Activate/Deactivate/Delete Modes) */}
            {result.not_found && result.not_found.length > 0 && (
              <div>
                <strong style={{ fontSize: "13px", color: "var(--warning, #f59e0b)" }}>
                  Unmatched Identifiers ({result.not_found.length} not found in database):
                </strong>
                <div
                  style={{
                    maxHeight: "120px",
                    overflowY: "auto",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    marginTop: "6px",
                    background: "var(--surface-alt)",
                    padding: "8px 12px",
                    fontSize: "12px",
                    color: "var(--muted)",
                  }}
                >
                  {result.not_found.join(", ")}
                </div>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setFile(null);
                  setResult(null);
                }}
              >
                Process Another File
              </button>
              <button type="button" className="btn primary" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
