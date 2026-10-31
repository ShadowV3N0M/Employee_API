import { useEffect, useRef } from "react";

/**
 * EmployeeActionMenu Component
 * Renders a sleek vertical ellipsis (⋮) action button with a role-tailored dropdown menu.
 * Fully theme-responsive (Light & Dark modes) across all roles: admin, manager, user.
 */
export default function EmployeeActionMenu({
  employee,
  role,
  isOpen,
  onToggle,
  onClose,
  onView,
  onEdit,
  onHistory,
  onSalary,
  onToggleActive,
  onDownloadPayslip,
  isDropup = false,
}) {
  const menuRef = useRef(null);

  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const privileged = isAdmin || isManager;

  // Handle escape key and click outside when open
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    }

    function handleKeyDown(e) {
      if (e.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  return (
    <div className="action-menu-wrap" ref={menuRef} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className={`action-ellipsis-btn ${isOpen ? "active" : ""}`}
        onClick={onToggle}
        aria-label={`Actions for ${employee.F_Name} ${employee.L_Name}`}
        aria-haspopup="true"
        aria-expanded={isOpen}
        title="Employee actions"
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <circle cx="8" cy="3" r="1.6" />
          <circle cx="8" cy="8" r="1.6" />
          <circle cx="8" cy="13" r="1.6" />
        </svg>
      </button>

      {isOpen && (
        <div
          className={`action-menu-dropdown ${isDropup ? "dropup" : ""}`}
          role="menu"
          aria-label="Employee Actions"
        >
          <div className="action-menu-header">
            <span className="action-menu-name" title={`${employee.F_Name} ${employee.L_Name}`}>
              {employee.F_Name} {employee.L_Name}
            </span>
            <span className="action-menu-id">#{employee.Emp_ID}</span>
          </div>

          <div className="action-menu-divider" />

          {/* 1. View Profile / Details (All Roles: user, manager, admin) */}
          <button
            type="button"
            className="action-menu-item"
            role="menuitem"
            onClick={() => {
              onClose();
              onView(employee);
            }}
          >
            <span className="action-menu-icon" aria-hidden="true">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </span>
            <span>View Details</span>
          </button>

          {/* 2. Edit Employee Details (Manager & Admin) */}
          {privileged && (
            <button
              type="button"
              className="action-menu-item"
              role="menuitem"
              onClick={() => {
                onClose();
                onEdit(employee);
              }}
            >
              <span className="action-menu-icon" aria-hidden="true">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </span>
              <span>Edit Details</span>
            </button>
          )}

          {/* 3. Salary Revision History Audit (Manager & Admin) */}
          {privileged && (
            <button
              type="button"
              className="action-menu-item"
              role="menuitem"
              onClick={() => {
                onClose();
                onHistory(employee);
              }}
            >
              <span className="action-menu-icon" aria-hidden="true">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </span>
              <span>Revision History</span>
            </button>
          )}

          {/* 4. Adjust Salary (Admin Only) */}
          {isAdmin && (
            <button
              type="button"
              className="action-menu-item"
              role="menuitem"
              onClick={() => {
                onClose();
                onSalary(employee);
              }}
            >
              <span className="action-menu-icon" aria-hidden="true">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </span>
              <span>Adjust Salary</span>
            </button>
          )}

          {/* 5. Download Official Payslip Voucher (Manager & Admin) */}
          {privileged && onDownloadPayslip && (
            <button
              type="button"
              className="action-menu-item"
              role="menuitem"
              onClick={() => {
                onClose();
                onDownloadPayslip(employee);
              }}
            >
              <span className="action-menu-icon" aria-hidden="true">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </span>
              <span>Export Payslip PDF</span>
            </button>
          )}

          {/* 6. Deactivate / Restore Account (Admin Only) */}
          {isAdmin && (
            <>
              <div className="action-menu-divider" />
              <button
                type="button"
                className={`action-menu-item ${employee.is_active ? "danger" : "restore"}`}
                role="menuitem"
                onClick={() => {
                  onClose();
                  onToggleActive(employee);
                }}
              >
                <span className="action-menu-icon" aria-hidden="true">
                  {employee.is_active ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                    </svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="23 4 23 10 17 10" />
                      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                    </svg>
                  )}
                </span>
                <span>{employee.is_active ? "Deactivate" : "Restore Employee"}</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
