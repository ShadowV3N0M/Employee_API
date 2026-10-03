import { useState } from "react";
import { api } from "../api";
import Modal from "./Modal";

export default function ExcelImportModal({ onClose, onSuccess }) {
  const [mode, setMode] = useState("import"); // "import" | "delete"
  const [file, setFile] = useState(null);
  const [hardDelete, setHardDelete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

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
      setError("Please select an Excel (.xlsx) or CSV (.csv) file.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      if (mode === "import") {
        const res = await api.uploadEmployeesExcel(file);
        setResult(res);
        if (res.inserted > 0) {
          onSuccess(res.message);
        }
      } else {
        const res = await api.bulkDeleteEmployeesExcel(file, hardDelete);
        setResult(res);
        if (res.affected_count > 0) {
          onSuccess(res.message);
        }
      }
    } catch (err) {
      setError(err.message || "Failed to process file");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={mode === "import" ? "Batch Import Employees (Excel / CSV)" : "Bulk Delete via Spreadsheet"}
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
          }}
        >
          <button
            type="button"
            className={`btn ${mode === "import" ? "primary" : "ghost"}`}
            style={{ fontSize: "13px", padding: "6px 14px" }}
            onClick={() => {
              setMode("import");
              setFile(null);
              setResult(null);
              setError("");
            }}
          >
            📥 Import Employees
          </button>
          <button
            type="button"
            className={`btn ${mode === "delete" ? "danger" : "ghost"}`}
            style={{
              fontSize: "13px",
              padding: "6px 14px",
              color: mode === "delete" ? "#fff" : "var(--danger)",
            }}
            onClick={() => {
              setMode("delete");
              setFile(null);
              setResult(null);
              setError("");
            }}
          >
            🗑️ Bulk Delete via Excel
          </button>
        </div>

        {mode === "import" ? (
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
              Supported Columns:
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
                <code>Address</code>, <code>Emp_ID</code>, <code>Email</code>, <code>Joining_Date</code>{" "}
                <span style={{ color: "var(--muted)", fontSize: "11px" }}>(Optional)</span>
              </li>
            </ul>
            <div style={{ marginTop: "12px", paddingTop: "10px", borderTop: "1px dashed var(--border)" }}>
              <a
                href={api.downloadEmployeeTemplate()}
                download="employee_template.csv"
                className="link"
                style={{
                  fontSize: "13px",
                  fontWeight: "600",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  textDecoration: "none",
                  cursor: "pointer",
                }}
                onClick={async (e) => {
                  e.preventDefault();
                  try {
                    await api.downloadBlob(
                      api.downloadEmployeeTemplate(),
                      "employee_template.csv"
                    );
                  } catch {
                    window.location.href = api.downloadEmployeeTemplate();
                  }
                }}
              >
                📥 Download Sample CSV Template
              </a>
            </div>
          </div>
        ) : (
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
              Bulk Deletion Guide:
            </strong>
            <p style={{ margin: "0 0 10px 0", color: "var(--text)", lineHeight: 1.5 }}>
              Upload a spreadsheet or CSV containing an <code>Emp_ID</code> or <code>Email</code> column. All matching employee records will be processed.
            </p>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontWeight: "600",
                cursor: "pointer",
                color: "var(--danger)",
              }}
            >
              <input
                type="checkbox"
                checked={hardDelete}
                onChange={(e) => setHardDelete(e.target.checked)}
              />
              Hard Delete (Permanently remove records from database instead of soft-deactivation)
            </label>
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
                  background: mode === "delete" ? "var(--danger)" : "var(--primary)",
                  color: "#fff",
                  borderRadius: "8px",
                  fontWeight: "600",
                  fontSize: "14px",
                  transition: "opacity 0.15s ease",
                }}
              >
                Choose {mode === "delete" ? "Deletion" : "Employee"} File (.xlsx / .csv)
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
                  : "No file selected"}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button type="button" className="btn ghost" onClick={onClose} disabled={loading}>
                Cancel
              </button>
              <button
                type="submit"
                className={`btn ${mode === "delete" ? "danger" : "primary"}`}
                disabled={!file || loading}
              >
                {loading
                  ? "Processing File..."
                  : mode === "delete"
                  ? hardDelete
                    ? "Execute Hard Delete"
                    : "Execute Bulk Deactivate"
                  : "Upload & Import"}
              </button>
            </div>
          </form>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div className={`alert ${mode === "delete" ? "info" : "success"}`} style={{ margin: 0 }}>
              <strong>{result.message}</strong>
            </div>

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
