import { useEffect, useRef, useState } from "react";

export default function SortByDropdown({
  options = [],
  sortBy,
  order = "asc",
  onChange,
  label = "Sort by",
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const currentOption = options.find((opt) => opt.value === sortBy) || options[0];

  const handleSelectField = (val) => {
    onChange(val, order);
  };

  const handleToggleOrder = (newOrder) => {
    onChange(sortBy, newOrder);
  };

  return (
    <div className="sort-dropdown-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`sort-btn ${open ? "active" : ""}`}
        onClick={() => setOpen((prev) => !prev)}
        title="Change table sorting field and direction"
      >
        <span>⇅</span>
        <span>
          {label}: <strong>{currentOption?.label || sortBy}</strong>
        </span>
        <span style={{ fontSize: "0.75rem", color: "var(--primary)" }}>
          {order === "asc" ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <div className="sort-popover" role="dialog" aria-label="Sort options">
          <div className="sort-popover-header">
            <span>Sort Field</span>
            <button
              type="button"
              className="link small"
              onClick={() => setOpen(false)}
              style={{ padding: 0 }}
            >
              ✕
            </button>
          </div>

          <div className="sort-options-list">
            {options.map((opt) => {
              const isSelected = opt.value === sortBy;
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={`sort-option-item ${isSelected ? "selected" : ""}`}
                  onClick={() => {
                    handleSelectField(opt.value);
                  }}
                >
                  <span>{opt.label}</span>
                  {isSelected && <span style={{ color: "var(--primary)" }}>✓</span>}
                </button>
              );
            })}
          </div>

          <div className="sort-order-toggle">
            <button
              type="button"
              className={`sort-order-btn ${order === "asc" ? "active" : ""}`}
              onClick={() => handleToggleOrder("asc")}
              title="Ascending (A-Z / Low to High)"
            >
              ▲ Ascending
            </button>
            <button
              type="button"
              className={`sort-order-btn ${order === "desc" ? "active" : ""}`}
              onClick={() => handleToggleOrder("desc")}
              title="Descending (Z-A / High to Low)"
            >
              ▼ Descending
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
