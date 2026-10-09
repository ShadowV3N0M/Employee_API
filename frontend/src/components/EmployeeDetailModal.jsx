import { useEffect, useState } from "react";
import { api } from "../api";
import Modal from "./Modal";
import { formatDateTime, formatMoney } from "../format";

export default function EmployeeDetailModal({
  employee: initialEmp,
  departments,
  role,
  onClose,
  onEdit,
  onSalary,
  onHistory,
  onToggleActive,
}) {
  const [emp, setEmp] = useState(initialEmp);
  const [loading, setLoading] = useState(false);
  const [emergencyContacts, setEmergencyContacts] = useState([]);

  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const isPrivileged = isAdmin || isManager;

  const dept = departments.find((d) => d.Dept_ID === emp.Dept_ID);
  const deptName = dept ? dept.Dept_Name : `#${emp.Dept_ID}`;

  // Fetch full details if needed (for fresh timestamps or single view)
  useEffect(() => {
    let cancelled = false;
    if (emp?.Emp_ID) {
      setLoading(true);
      api
        .getEmployee(emp.Emp_ID)
        .then((data) => {
          if (!cancelled && data) {
            setEmp((prev) => ({ ...prev, ...data }));
          }
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoading(false);
        });

      if (isPrivileged) {
        api
          .getEmployeeEmergencyContacts(emp.Emp_ID)
          .then((data) => {
            if (!cancelled && Array.isArray(data)) {
              setEmergencyContacts(data);
            }
          })
          .catch(() => {});
      }
    }
    return () => {
      cancelled = true;
    };
  }, [initialEmp.Emp_ID, isPrivileged]);

  return (
    <Modal title={`Employee Profile — #${emp.Emp_ID}`} onClose={onClose}>
      <div className="employee-detail-modal" style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
        
        {/* Header Profile Card */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "14px",
          padding: "16px",
          background: "var(--bg, #f4f6fa)",
          borderRadius: "8px"
        }}>
          <div style={{
            width: "52px",
            height: "52px",
            borderRadius: "50%",
            background: "var(--primary, #3b5bdb)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.25rem",
            fontWeight: "bold",
            flexShrink: 0
          }}>
            {emp.F_Name?.[0]}{emp.L_Name?.[0]}
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: "1.25rem", color: "var(--text)" }}>
              {emp.F_Name} {emp.L_Name}
            </h3>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "4px", flexWrap: "wrap" }}>
              <span className={`badge ${emp.is_active ? "ok" : "off"}`}>
                {emp.is_active ? "Active" : "Inactive"}
              </span>
              <span className="muted small">Emp ID: #{emp.Emp_ID}</span>
              <span className="muted small">·</span>
              <span className="muted small">{deptName}</span>
            </div>
          </div>
        </div>

        {/* General Information (Visible to all users) */}
        <div>
          <h4 style={{ margin: "0 0 10px 0", fontSize: "0.82rem", textTransform: "uppercase", color: "var(--muted)", letterSpacing: "0.05em" }}>
            General Information
          </h4>
          <div className="responsive-grid-2" style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            padding: "14px"
          }}>
            <div>
              <span className="muted small" style={{ display: "block" }}>First Name</span>
              <strong>{emp.F_Name}</strong>
            </div>
            <div>
              <span className="muted small" style={{ display: "block" }}>Last Name</span>
              <strong>{emp.L_Name}</strong>
            </div>
            <div>
              <span className="muted small" style={{ display: "block" }}>Official Email</span>
              <span style={{ color: "var(--primary)", wordBreak: "break-all" }}>{emp.Email || "—"}</span>
            </div>
            <div>
              <span className="muted small" style={{ display: "block" }}>Phone Number</span>
              {emp.personal_phone ? (
                <a
                  href={`tel:${emp.personal_phone}`}
                  style={{ color: "var(--primary)", textDecoration: "none", fontWeight: "600" }}
                >
                  📞 {emp.personal_phone}
                </a>
              ) : (
                <strong>—</strong>
              )}
            </div>
            <div>
              <span className="muted small" style={{ display: "block" }}>Department</span>
              <strong>{deptName}</strong>
            </div>
            <div>
              <span className="muted small" style={{ display: "block" }}>Joining Date</span>
              <strong>{emp.joining_date ? emp.joining_date : (emp.created_at ? String(emp.created_at).slice(0, 10) : "—")}</strong>
            </div>
            <div>
              <span className="muted small" style={{ display: "block" }}>Status</span>
              <span className={`badge ${emp.is_active ? "ok" : "off"}`}>
                {emp.is_active ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
        </div>

        {/* Privileged Information: Admin and Manager Only */}
        {isPrivileged ? (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <h4 style={{ margin: 0, fontSize: "0.82rem", textTransform: "uppercase", color: "var(--muted)", letterSpacing: "0.05em" }}>
                Compensation & Personal Details {isAdmin && <span className="badge role-admin" style={{ marginLeft: "6px" }}>Admin Full View</span>}
              </h4>
            </div>

            <div className="responsive-grid-2" style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: "14px"
            }}>
              <div>
                <span className="muted small" style={{ display: "block" }}>Current Salary</span>
                <strong style={{ fontSize: "1.15rem", color: "var(--ok, #2b8a3e)" }}>
                  {formatMoney(emp.Salary)}
                </strong>
              </div>

              <div>
                <span className="muted small" style={{ display: "block" }}>Status</span>
                <strong>{emp.is_active ? "Active" : "Inactive / Deactivated"}</strong>
              </div>

              <div className="span-2">
                <span className="muted small" style={{ display: "block" }}>Residential Address</span>
                <span>{emp.Address || "—"}</span>
              </div>

              <div>
                <span className="muted small" style={{ display: "block" }}>Blood Group</span>
                {emp.blood_group ? (
                  <span className="badge" style={{ background: "#ffe8ef", color: "#d6336c", fontWeight: "700" }}>
                    🩸 {emp.blood_group}
                  </span>
                ) : (
                  <span>—</span>
                )}
              </div>

              <div>
                <span className="muted small" style={{ display: "block" }}>Date of Birth</span>
                <span>{emp.dob ? String(emp.dob).slice(0, 10) : "—"}</span>
              </div>

              <div>
                <span className="muted small" style={{ display: "block" }}>Marital Status</span>
                <span>{emp.marital_status || "—"}</span>
              </div>

              {emp.created_at && (
                <div>
                  <span className="muted small" style={{ display: "block" }}>Created Timestamp</span>
                  <span className="small">{formatDateTime(emp.created_at)}</span>
                </div>
              )}

              {emp.updated_at && (
                <div>
                  <span className="muted small" style={{ display: "block" }}>Last Updated</span>
                  <span className="small">{formatDateTime(emp.updated_at)}</span>
                </div>
              )}
            </div>

            {/* Emergency Contacts & SOS Section */}
            <div style={{ marginTop: "14px" }}>
              <h4 style={{ margin: "0 0 8px 0", fontSize: "0.82rem", textTransform: "uppercase", color: "var(--muted)", letterSpacing: "0.05em" }}>
                🚨 Emergency Contacts & SOS
              </h4>

              {emergencyContacts.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {emergencyContacts.map((c) => (
                    <div
                      key={c.id}
                      style={{
                        padding: "10px 14px",
                        background: c.is_primary ? "rgba(245, 159, 0, 0.08)" : "var(--surface)",
                        border: c.is_primary ? "1px solid #f59f00" : "1px solid var(--border)",
                        borderRadius: "8px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: "8px",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <strong>{c.contact_name}</strong>
                          <span className="badge" style={{ background: "var(--surface-alt)" }}>
                            {c.relationship_type}
                          </span>
                          {c.is_primary && (
                            <span style={{ fontSize: "0.72rem", color: "#d9480f", fontWeight: "700" }}>
                              ⭐ Primary SOS
                            </span>
                          )}
                        </div>
                        {c.phone_secondary && (
                          <span className="muted small" style={{ display: "block", marginTop: "2px" }}>
                            Alt: {c.phone_secondary}
                          </span>
                        )}
                      </div>

                      <a
                        href={`tel:${c.phone_primary}`}
                        className="btn btn-sm btn-primary"
                        style={{ textDecoration: "none", fontSize: "0.82rem", padding: "4px 10px" }}
                      >
                        📞 Call {c.phone_primary}
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: "12px", background: "var(--surface-alt)", borderRadius: "8px", color: "var(--muted)", fontSize: "0.85rem" }}>
                  No emergency contacts registered for this employee yet.
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Limited view confidentiality notice for standard users */
          <div style={{
            background: "var(--surface-alt)",
            border: "1px dashed var(--border)",
            borderRadius: "8px",
            padding: "14px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            color: "var(--muted)",
            fontSize: "0.88rem"
          }}>
            <span style={{ fontSize: "1.4rem" }}>🔒</span>
            <div>
              <strong>Confidential Details Hidden:</strong> Salary compensation, residential address, and salary revision history are confidential and visible to managers and administrators only.
            </div>
          </div>
        )}

        {/* Modal Action Controls */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: "1px solid var(--border)",
          paddingTop: "14px",
          marginTop: "6px",
          flexWrap: "wrap",
          gap: "10px"
        }}>
          <div>
            {isAdmin && (
              <button
                type="button"
                className={`btn small ${emp.is_active ? "danger" : "ghost"}`}
                onClick={() => {
                  onClose();
                  onToggleActive(emp);
                }}
              >
                {emp.is_active ? "Deactivate" : "Restore"}
              </button>
            )}
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {isPrivileged && (
              <>
                <button
                  type="button"
                  className="btn small ghost"
                  title="Download official monthly payslip voucher (PDF)"
                  onClick={async () => {
                    try {
                      const url = api.getPayslipPdfUrl(emp.Emp_ID, { inline: false });
                      await api.downloadPdf(url, `Payslip_${emp.Emp_ID}_${emp.F_Name}.pdf`);
                    } catch (err) {
                      alert(err.message || "Failed to download payslip PDF");
                    }
                  }}
                >
                  🧾 Payslip (PDF)
                </button>

                <button
                  type="button"
                  className="btn small ghost"
                  title="Download salary revision notice & compensation audit letter (PDF)"
                  onClick={async () => {
                    try {
                      const url = api.getSalaryRevisionPdfUrl(emp.Emp_ID, { inline: false });
                      await api.downloadPdf(url, `Salary_Revision_${emp.Emp_ID}_${emp.F_Name}.pdf`);
                    } catch (err) {
                      alert(err.message || "Failed to download revision letter PDF");
                    }
                  }}
                >
                  📄 Revision Letter (PDF)
                </button>

                <button
                  type="button"
                  className="btn small ghost"
                  onClick={() => {
                    onClose();
                    onHistory(emp);
                  }}
                >
                  📜 History
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    className="btn small ghost"
                    onClick={() => {
                      onClose();
                      onSalary(emp);
                    }}
                  >
                    💰 Salary
                  </button>
                )}
                <button
                  type="button"
                  className="btn small primary"
                  onClick={() => {
                    onClose();
                    onEdit(emp);
                  }}
                >
                  ✏️ Edit
                </button>
              </>
            )}
            <button type="button" className="btn small ghost" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

      </div>
    </Modal>
  );
}
