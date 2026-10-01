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
        <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid #e2e8f0", paddingBottom: "10px" }}>
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
            className={`btn ${mode === "delete" ? "primary" : "ghost"}`}
            style={{ fontSize: "13px", padding: "6px 14px", color: mode === "delete" ? "#fff" : "#dc2626" }}
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
          <div style={{ background: "var(--bg-subtle, #f8fafc)", padding: "12px", borderRadius: "6px", fontSize: "13px" }}>
            <strong>Supported Columns:</strong>
            <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
              <li><code>F_Name</code>, <code>L_Name</code>, <code>Salary</code> (Required)</li>
              <li><code>Department</code> (e.g. "Engineering") or <code>Dept_ID</code> (Required)</li>
              <li><code>Address</code>, <code>Emp_ID</code>, <code>Email</code>, <code>Joining_Date</code> (Optional)</li>
            </ul>
            <div style={{ marginTop: "10px" }}>
              <a
                href={api.downloadEmployeeTemplate()}
                download="employee_template.csv"
                style={{ color: "#2563eb", textDecoration: "underline", fontSize: "12px", fontWeight: "bold" }}
              >
                📥 Download Sample CSV Template
              </a>
            </div>
          </div>
        ) : (
          <div style={{ background: "#fef2f2", border: "1px solid #fee2e2", padding: "12px", borderRadius: "6px", fontSize: "13px", color: "#991b1b" }}>
            <strong>Bulk Deletion Guide:</strong>
            <p style={{ margin: "6px 0 8px 0" }}>
              Upload a spreadsheet or CSV containing an <code>Emp_ID</code> or <code>Email</code> column. All matching employee records will be processed.
            </p>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "bold", cursor: "pointer", color: "#b91c1c" }}>
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
            <div style={{ border: "2px dashed #cbd5e1", borderRadius: "8px", padding: "20px", textAlign: "center" }}>
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
                  padding: "8px 16px",
                  background: mode === "delete" ? "#dc2626" : "#2563eb",
                  color: "#fff",
                  borderRadius: "4px",
                  fontWeight: "bold",
                  fontSize: "14px",
                }}
              >
                Choose {mode === "delete" ? "Deletion" : "Employee"} File (.xlsx / .csv)
              </label>
              <div style={{ marginTop: "10px", fontSize: "13px", color: file ? "#0f172a" : "#64748b" }}>
                {file ? `Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)` : "No file selected"}
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
                style={mode === "delete" ? { background: "#dc2626", color: "#fff" } : {}}
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
                <strong style={{ fontSize: "13px", color: "#dc2626" }}>
                  Skipped Rows ({result.errors.length}):
                </strong>
                <div style={{ maxHeight: "150px", overflowY: "auto", border: "1px solid #fee2e2", borderRadius: "4px", marginTop: "6px", background: "#fef2f2", padding: "8px", fontSize: "12px" }}>
                  {result.errors.map((err, idx) => (
                    <div key={idx} style={{ padding: "3px 0", borderBottom: "1px solid #fecaca" }}>
                      Row {err.row}{err.emp_id ? ` (ID: ${err.emp_id})` : ""}: <strong>{err.error}</strong>
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
