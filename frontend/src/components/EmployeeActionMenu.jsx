import { useEffect, useRef } from "react";

/**
 * EmployeeActionMenu Component
 * Renders a sleek vertical ellipsis (⋮) action button with a role-tailored dropdown menu.
 * Replaces bulky row action buttons so the employee table fits comfortably across all screens.
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
        <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
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
            <span className="action-menu-name">
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
            <span className="action-menu-icon">👁️</span>
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
              <span className="action-menu-icon">✏️</span>
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
              <span className="action-menu-icon">📜</span>
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
              <span className="action-menu-icon">💵</span>
              <span>Adjust Salary</span>
            </button>
          )}

          {/* 5. Download Official Payslip Voucher (Privileged) */}
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
              <span className="action-menu-icon">📑</span>
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
                <span className="action-menu-icon">
                  {employee.is_active ? "🚫" : "🔄"}
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
