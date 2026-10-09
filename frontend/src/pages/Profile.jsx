import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { formatMoney } from "../format";
import PhoneInput from "../components/PhoneInput";
import { formatFullPhone, parsePhoneNumber } from "../phoneUtils";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const RELATIONSHIPS = ["Spouse", "Parent", "Sibling", "Child", "Friend", "Guardian", "Other"];
const MARITAL_STATUSES = ["Single", "Married", "Divorced", "Widowed"];

function getInitials(firstName, lastName) {
  const f = (firstName || "").trim();
  const l = (lastName || "").trim();
  if (f && l) return (f[0] + l[0]).toUpperCase();
  if (f) return f.slice(0, 2).toUpperCase();
  return "U";
}

function calculateAge(dobString) {
  if (!dobString) return null;
  const dob = new Date(dobString);
  if (isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age >= 0 ? age : null;
}

export default function Profile() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [unlinked, setUnlinked] = useState(false);
  const [activeTab, setActiveTab] = useState("personal"); // "personal" | "emergency"

  // Personal form state
  const [phoneCountryCode, setPhoneCountryCode] = useState("+91");
  const [customCountryCode, setCustomCountryCode] = useState("");
  const [phoneDigits, setPhoneDigits] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [dob, setDob] = useState("");
  const [maritalStatus, setMaritalStatus] = useState("");
  const [address, setAddress] = useState("");
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [personalMsg, setPersonalMsg] = useState("");
  const [personalError, setPersonalError] = useState("");

  // Emergency contact modal state
  const [showContactModal, setShowContactModal] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [cName, setCName] = useState("");
  const [cRel, setCRel] = useState("Spouse");
  const [cPhone1, setCPhone1] = useState("");
  const [cPhone2, setCPhone2] = useState("");
  const [cIsPrimary, setCIsPrimary] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [contactError, setContactError] = useState("");

  // Deleting contact state
  const [deletingId, setDeletingId] = useState(null);

  // Copy phone feedback
  const [copiedPhone, setCopiedPhone] = useState("");

  const loadProfile = async () => {
    setLoading(true);
    setUnlinked(false);
    try {
      const data = await api.getMyProfile();
      setProfile(data);
      const parsed = parsePhoneNumber(data.personal_phone);
      setPhoneCountryCode(parsed.code);
      setCustomCountryCode(parsed.customCode);
      setPhoneDigits(parsed.digits);
      setBloodGroup(data.blood_group || "");
      setDob(data.dob || "");
      setMaritalStatus(data.marital_status || "");
      setAddress(data.Address || "");
    } catch (err) {
      if (err.status === 404) {
        setUnlinked(true);
      } else {
        setPersonalError(err.message || "Failed to load employee profile");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleSavePersonal = async (e) => {
    e.preventDefault();
    setSavingPersonal(true);
    setPersonalMsg("");
    setPersonalError("");

    if (phoneDigits) {
      if (phoneDigits.length !== 10) {
        setPersonalError(`Mobile number must be exactly 10 digits (currently ${phoneDigits.length} digits).`);
        setSavingPersonal(false);
        return;
      }
      if (phoneCountryCode === "custom" && (!customCountryCode || !customCountryCode.startsWith("+") || customCountryCode.length < 2)) {
        setPersonalError("Please enter a valid custom country code starting with '+' (e.g. +353).");
        setSavingPersonal(false);
        return;
      }
    }

    try {
      const formattedPhone = formatFullPhone(phoneCountryCode, customCountryCode, phoneDigits);
      const payload = {
        personal_phone: formattedPhone,
        blood_group: bloodGroup || null,
        dob: dob || null,
        marital_status: maritalStatus || null,
        Address: address.trim(),
      };
      const updated = await api.updateMyProfile(payload);
      setProfile((prev) => ({ ...prev, ...updated }));
      setPersonalMsg("Personal details updated successfully!");
      setTimeout(() => setPersonalMsg(""), 4000);
    } catch (err) {
      setPersonalError(err.message || "Failed to update profile");
    } finally {
      setSavingPersonal(false);
    }
  };

  const handleOpenAddContact = () => {
    setEditingContact(null);
    setCName("");
    setCRel("Spouse");
    setCPhone1("");
    setCPhone2("");
    setCIsPrimary(profile?.emergency_contacts?.length === 0);
    setContactError("");
    setShowContactModal(true);
  };

  const handleOpenEditContact = (c) => {
    setEditingContact(c);
    setCName(c.contact_name);
    setCRel(c.relationship_type);
    setCPhone1(c.phone_primary);
    setCPhone2(c.phone_secondary || "");
    setCIsPrimary(c.is_primary);
    setContactError("");
    setShowContactModal(true);
  };

  const handleSaveContact = async (e) => {
    e.preventDefault();
    if (!cName.trim() || !cPhone1.trim()) {
      setContactError("Contact name and primary phone number are required.");
      return;
    }
    setSavingContact(true);
    setContactError("");

    try {
      const payload = {
        contact_name: cName.trim(),
        relationship_type: cRel,
        phone_primary: cPhone1.trim(),
        phone_secondary: cPhone2.trim() || null,
        is_primary: cIsPrimary,
      };

      if (editingContact) {
        await api.updateMyEmergencyContact(editingContact.id, payload);
      } else {
        await api.addMyEmergencyContact(payload);
      }

      await loadProfile();
      setShowContactModal(false);
    } catch (err) {
      setContactError(err.message || "Failed to save emergency contact");
    } finally {
      setSavingContact(false);
    }
  };

  const handleDeleteContact = async (id) => {
    if (!window.confirm("Are you sure you want to remove this emergency contact?")) {
      return;
    }
    setDeletingId(id);
    try {
      await api.deleteMyEmergencyContact(id);
      setProfile((prev) => ({
        ...prev,
        emergency_contacts: prev.emergency_contacts.filter((c) => c.id !== id),
      }));
    } catch (err) {
      alert(err.message || "Failed to delete emergency contact");
    } finally {
      setDeletingId(null);
    }
  };

  const handleCopyPhone = (phone) => {
    navigator.clipboard?.writeText(phone);
    setCopiedPhone(phone);
    setTimeout(() => setCopiedPhone(""), 2000);
  };

  if (loading) {
    return (
      <div className="card" style={{ padding: "40px", textAlign: "center" }}>
        <p className="center-note">Loading employee profile...</p>
      </div>
    );
  }

  // Unlinked user account state
  if (unlinked || !profile) {
    return (
      <div className="card" style={{ maxWidth: "700px", margin: "20px auto", padding: "32px" }}>
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              background: "var(--surface-alt)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.8rem",
              marginBottom: "12px",
            }}
          >
            👤
          </div>
          <h2 style={{ margin: "0 0 6px" }}>User Account: @{user?.username}</h2>
          <span className={`badge role-${user?.role}`}>{user?.role}</span>
        </div>

        <div className="alert" style={{ background: "var(--surface-alt)", borderLeft: "4px solid var(--primary)" }}>
          <strong style={{ display: "block", marginBottom: "4px" }}>
            No Employee Profile Linked
          </strong>
          Your user login is not yet linked to an official employee record in the company directory.
          Please reach out to your HR administrator to connect your account.
        </div>

        <div style={{ marginTop: "24px", display: "flex", justifyContent: "center" }}>
          <button type="button" className="btn btn-secondary" onClick={loadProfile}>
            🔄 Refresh Status
          </button>
        </div>
      </div>
    );
  }

  const primaryContact = profile.emergency_contacts?.find((c) => c.is_primary);
  const secondaryContacts = profile.emergency_contacts?.filter((c) => !c.is_primary) || [];
  const age = calculateAge(profile.dob);

  return (
    <div style={{ maxWidth: "1050px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Profile Header Hero Card */}
      <div className="card" style={{ padding: "24px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
          <div
            style={{
              width: "74px",
              height: "74px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, var(--primary), var(--primary-dark))",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.8rem",
              fontWeight: "700",
              boxShadow: "0 4px 14px rgba(59, 91, 219, 0.3)",
              flexShrink: 0,
            }}
          >
            {getInitials(profile.F_Name, profile.L_Name)}
          </div>

          <div style={{ flex: 1, minWidth: "240px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "4px" }}>
              <h1 style={{ margin: 0, fontSize: "1.5rem" }}>
                {profile.F_Name} {profile.L_Name}
              </h1>
              <span className="badge" style={{ background: "var(--code-bg)" }}>
                Emp #{profile.Emp_ID}
              </span>
              <span className={`badge role-${user?.role}`}>{user?.role}</span>
              <span className={`badge ${profile.is_active ? "badge-active" : "badge-inactive"}`}>
                {profile.is_active ? "● Active" : "○ Inactive"}
              </span>
            </div>

            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", color: "var(--muted)", fontSize: "0.88rem" }}>
              <span>🏛️ {profile.department_name}</span>
              <span>✉️ {profile.Email || "No official email"}</span>
              {profile.blood_group && (
                <span style={{ color: "var(--danger)", fontWeight: "600" }}>
                  🩸 Blood Group: {profile.blood_group}
                </span>
              )}
            </div>
          </div>

          {/* Quick Stats Pill Tiles */}
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <div
              style={{
                background: "var(--surface-alt)",
                padding: "8px 14px",
                borderRadius: "8px",
                textAlign: "center",
                border: "1px solid var(--border)",
              }}
            >
              <div style={{ fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: "600" }}>
                Emergency Contacts
              </div>
              <div style={{ fontSize: "1.1rem", fontWeight: "700", color: "var(--text-heading)" }}>
                {profile.emergency_contacts?.length || 0}
              </div>
            </div>

            {profile.Salary && (
              <div
                style={{
                  background: "var(--surface-alt)",
                  padding: "8px 14px",
                  borderRadius: "8px",
                  textAlign: "center",
                  border: "1px solid var(--border)",
                }}
              >
                <div style={{ fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: "600" }}>
                  Annual CTC
                </div>
                <div style={{ fontSize: "1.1rem", fontWeight: "700", color: "var(--primary)" }}>
                  {formatMoney(profile.Salary)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tab Toggle Bar & PDF Actions */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
            marginTop: "20px",
            borderTop: "1px solid var(--border)",
            paddingTop: "16px",
          }}
        >
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              type="button"
              className={`btn ${activeTab === "personal" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setActiveTab("personal")}
            >
              👤 Personal Details & Address
            </button>
            <button
              type="button"
              className={`btn ${activeTab === "emergency" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setActiveTab("emergency")}
            >
              🚨 Emergency Contacts & SOS ({profile.emergency_contacts?.length || 0})
            </button>
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn ghost small"
              title="Download your official monthly payslip voucher (PDF)"
              onClick={async () => {
                try {
                  const url = api.getMyPayslipPdfUrl({ inline: false });
                  await api.downloadPdf(url, `My_Payslip_${profile.Emp_ID}.pdf`);
                  setSuccess("Downloaded official payslip voucher PDF successfully.");
                } catch (err) {
                  setError(err.message || "Failed to download payslip PDF");
                }
              }}
            >
              🧾 My Payslip (PDF)
            </button>
            <button
              type="button"
              className="btn ghost small"
              title="Download your formal salary revision & compensation letter (PDF)"
              onClick={async () => {
                try {
                  const url = api.getMySalaryRevisionPdfUrl({ inline: false });
                  await api.downloadPdf(url, `My_Salary_Revision_${profile.Emp_ID}.pdf`);
                  setSuccess("Downloaded compensation statement PDF successfully.");
                } catch (err) {
                  setError(err.message || "Failed to download compensation letter PDF");
                }
              }}
            >
              📄 Compensation Letter (PDF)
            </button>
          </div>
        </div>
      </div>

      {/* Tab 1: Personal Details */}
      {activeTab === "personal" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))", gap: "20px" }}>
          {/* Editable Personal Form */}
          <div className="card" style={{ padding: "24px" }}>
            <h3 style={{ margin: "0 0 4px", fontSize: "1.15rem" }}>
              Self-Service Personal Profile
            </h3>
            <p style={{ margin: "0 0 16px", fontSize: "0.85rem", color: "var(--muted)" }}>
              Update your personal phone number, blood group, date of birth, and home address.
            </p>

            {personalMsg && <div className="alert success">{personalMsg}</div>}
            {personalError && <div className="alert danger">{personalError}</div>}

            <form onSubmit={handleSavePersonal} className="form-grid">
              <div className="form-group">
                <PhoneInput
                  countryCode={phoneCountryCode}
                  setCountryCode={setPhoneCountryCode}
                  customCode={customCountryCode}
                  setCustomCode={setCustomCountryCode}
                  digits={phoneDigits}
                  setDigits={setPhoneDigits}
                  label="Personal Mobile Phone"
                />
              </div>

              <div className="form-group">
                <label>Blood Group 🩸</label>
                <select value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)}>
                  <option value="">Not Specified</option>
                  {BLOOD_GROUPS.map((bg) => (
                    <option key={bg} value={bg}>
                      {bg}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>
                  Date of Birth {age !== null && <span style={{ color: "var(--muted)" }}>({age} yrs)</span>}
                </label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Marital Status</label>
                <select value={maritalStatus} onChange={(e) => setMaritalStatus(e.target.value)}>
                  <option value="">Not Specified</option>
                  {MARITAL_STATUSES.map((ms) => (
                    <option key={ms} value={ms}>
                      {ms}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group full">
                <label>Current Residential Address *</label>
                <textarea
                  rows={3}
                  placeholder="House number, Street, City, State, PIN code"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  required
                />
              </div>

              <div className="full" style={{ marginTop: "10px" }}>
                <button type="submit" className="btn btn-primary" disabled={savingPersonal}>
                  {savingPersonal ? "Saving..." : "💾 Save Personal Details"}
                </button>
              </div>
            </form>
          </div>

          {/* Read-Only Organizational Information Card */}
          <div className="card" style={{ padding: "24px" }}>
            <h3 style={{ margin: "0 0 4px", fontSize: "1.15rem" }}>
              Official Organizational Details
            </h3>
            <p style={{ margin: "0 0 16px", fontSize: "0.85rem", color: "var(--muted)" }}>
              Managed by HR & System Administrators. Non-editable via self-service.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ background: "var(--surface-alt)", padding: "12px 14px", borderRadius: "8px" }}>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", display: "block" }}>
                  Employee ID
                </span>
                <strong style={{ fontSize: "1rem" }}>#{profile.Emp_ID}</strong>
              </div>

              <div style={{ background: "var(--surface-alt)", padding: "12px 14px", borderRadius: "8px" }}>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", display: "block" }}>
                  Official Corporate Email
                </span>
                <strong style={{ fontSize: "1rem" }}>{profile.Email || "None"}</strong>
              </div>

              <div style={{ background: "var(--surface-alt)", padding: "12px 14px", borderRadius: "8px" }}>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", display: "block" }}>
                  Department
                </span>
                <strong style={{ fontSize: "1rem" }}>{profile.department_name}</strong>
              </div>

              <div style={{ background: "var(--surface-alt)", padding: "12px 14px", borderRadius: "8px" }}>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", display: "block" }}>
                  Joining Date
                </span>
                <strong style={{ fontSize: "1rem" }}>{profile.joining_date || "Not recorded"}</strong>
              </div>

              {profile.Salary && (
                <div style={{ background: "var(--surface-alt)", padding: "12px 14px", borderRadius: "8px" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", display: "block" }}>
                    Compensation (CTC)
                  </span>
                  <strong style={{ fontSize: "1.05rem", color: "var(--primary)" }}>
                    {formatMoney(profile.Salary)} / year
                  </strong>
                  <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: "2px" }}>
                    🔒 Confidential: visible exclusively to you and system administrators.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Emergency Contacts (SOS) */}
      {activeTab === "emergency" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Header Action Bar & Explanation */}
          <div className="card" style={{ padding: "20px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <h3 style={{ margin: "0 0 4px", fontSize: "1.15rem" }}>
                  🚨 Emergency & SOS Contacts Directory
                </h3>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>
                  In the event of a medical emergency or critical incident, HR and leadership will immediately reach out to your designated contacts.
                </p>
              </div>

              <button type="button" className="btn btn-primary" onClick={handleOpenAddContact}>
                ➕ Add Emergency Contact
              </button>
            </div>
          </div>

          {/* Primary SOS Contact Spotlight Card */}
          {primaryContact ? (
            <div
              className="card"
              style={{
                padding: "24px",
                borderLeft: "6px solid #f59f00",
                background: "linear-gradient(145deg, var(--surface), var(--surface-alt))",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                <span
                  style={{
                    background: "#fff3bf",
                    color: "#d9480f",
                    padding: "3px 10px",
                    borderRadius: "999px",
                    fontWeight: "700",
                    fontSize: "0.78rem",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  ⭐ Primary Emergency Contact (First SOS Responder)
                </span>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => handleOpenEditContact(primaryContact)}
                  >
                    ✏️ Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    style={{ color: "var(--danger)" }}
                    onClick={() => handleDeleteContact(primaryContact.id)}
                    disabled={deletingId === primaryContact.id}
                  >
                    🗑️ Remove
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                <div>
                  <h2 style={{ margin: "0 0 4px", fontSize: "1.3rem" }}>
                    {primaryContact.contact_name}
                  </h2>
                  <span className="badge" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
                    Relationship: {primaryContact.relationship_type}
                  </span>
                </div>

                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <a
                    href={`tel:${primaryContact.phone_primary}`}
                    className="btn btn-primary"
                    style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    📞 Call {primaryContact.phone_primary}
                  </a>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleCopyPhone(primaryContact.phone_primary)}
                  >
                    {copiedPhone === primaryContact.phone_primary ? "✓ Copied!" : "📋 Copy"}
                  </button>
                </div>
              </div>

              {primaryContact.phone_secondary && (
                <div style={{ marginTop: "12px", fontSize: "0.85rem", color: "var(--muted)" }}>
                  Alternate Phone:{" "}
                  <a href={`tel:${primaryContact.phone_secondary}`} style={{ color: "var(--text)", fontWeight: "600" }}>
                    {primaryContact.phone_secondary}
                  </a>
                </div>
              )}
            </div>
          ) : (
            <div className="card" style={{ padding: "24px", textAlign: "center", border: "2px dashed var(--border)" }}>
              <span style={{ fontSize: "2rem", display: "block", marginBottom: "8px" }}>⚠️</span>
              <h3 style={{ margin: "0 0 6px" }}>No Primary Emergency Contact Assigned</h3>
              <p style={{ margin: "0 0 16px", color: "var(--muted)", fontSize: "0.88rem" }}>
                Please add at least one primary emergency contact (spouse, parent, guardian) who can be contacted immediately in an emergency.
              </p>
              <button type="button" className="btn btn-primary" onClick={handleOpenAddContact}>
                ➕ Set Primary Emergency Contact
              </button>
            </div>
          )}

          {/* Secondary Emergency Contacts List */}
          {secondaryContacts.length > 0 && (
            <div className="card" style={{ padding: "24px" }}>
              <h4 style={{ margin: "0 0 16px", fontSize: "1rem" }}>
                Secondary Emergency Contacts ({secondaryContacts.length})
              </h4>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))", gap: "14px" }}>
                {secondaryContacts.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: "10px",
                      padding: "16px",
                      background: "var(--surface-alt)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: "12px",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                        <strong style={{ fontSize: "1rem" }}>{c.contact_name}</strong>
                        <span className="badge" style={{ background: "var(--surface)" }}>
                          {c.relationship_type}
                        </span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px" }}>
                        <a
                          href={`tel:${c.phone_primary}`}
                          style={{
                            fontSize: "0.95rem",
                            fontWeight: "600",
                            color: "var(--primary)",
                            textDecoration: "none",
                          }}
                        >
                          📞 {c.phone_primary}
                        </a>
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          style={{ padding: "2px 6px", fontSize: "0.72rem" }}
                          onClick={() => handleCopyPhone(c.phone_primary)}
                        >
                          {copiedPhone === c.phone_primary ? "✓ Copied" : "Copy"}
                        </button>
                      </div>

                      {c.phone_secondary && (
                        <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "4px" }}>
                          Alt: {c.phone_secondary}
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: "8px", borderTop: "1px solid var(--border)", paddingTop: "10px" }}>
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleOpenEditContact(c)}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        style={{ color: "var(--danger)" }}
                        onClick={() => handleDeleteContact(c.id)}
                        disabled={deletingId === c.id}
                      >
                        🗑️ Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Emergency Contact Modal */}
      {showContactModal && (
        <div className="modal-backdrop" onClick={() => setShowContactModal(false)}>
          <div className="modal-card" style={{ maxWidth: "520px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingContact ? "✏️ Edit Emergency Contact" : "➕ Add Emergency Contact"}</h2>
              <button type="button" className="modal-close" onClick={() => setShowContactModal(false)}>
                ✕
              </button>
            </div>

            <p className="modal-subtitle">
              Enter phone numbers and relationship details for medical or workplace emergencies.
            </p>

            {contactError && <div className="alert danger">{contactError}</div>}

            <form onSubmit={handleSaveContact} className="form-grid">
              <div className="form-group full">
                <label>Contact Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Jane Doe"
                  value={cName}
                  onChange={(e) => setCName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Relationship *</label>
                <select value={cRel} onChange={(e) => setCRel(e.target.value)}>
                  {RELATIONSHIPS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Primary Phone *</label>
                <input
                  type="text"
                  placeholder="e.g. +91 98765 43210"
                  value={cPhone1}
                  onChange={(e) => setCPhone1(e.target.value)}
                  required
                />
              </div>

              <div className="form-group full">
                <label>Secondary Phone (Optional)</label>
                <input
                  type="text"
                  placeholder="Alternate mobile or landline"
                  value={cPhone2}
                  onChange={(e) => setCPhone2(e.target.value)}
                />
              </div>

              <div className="form-group full">
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={cIsPrimary}
                    onChange={(e) => setCIsPrimary(e.target.checked)}
                  />
                  <span>⭐ Set as Primary Emergency Contact (First responder for SOS alerts)</span>
                </label>
              </div>

              <div className="modal-actions full" style={{ marginTop: "16px" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowContactModal(false)}
                  disabled={savingContact}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingContact}>
                  {savingContact ? "Saving..." : "💾 Save Contact"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
