/**
 * Form validation utilities for employee management application.
 * Follows modern web guidance and accessibility guidelines.
 */

export const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
export const USERNAME_REGEX = /^[a-zA-Z0-9_.-]{3,50}$/;
export const NAME_REGEX = /^[a-zA-Z\s'’.\-–]+$/;

/**
 * Validates a person's first or last name.
 */
export function validateName(value, label = "Name") {
  const trimmed = (value || "").trim();
  if (!trimmed) {
    return `${label} is required.`;
  }
  if (trimmed.length < 2) {
    return `${label} must be at least 2 characters long.`;
  }
  if (trimmed.length > 50) {
    return `${label} cannot exceed 50 characters.`;
  }
  if (!NAME_REGEX.test(trimmed)) {
    return `${label} should only contain letters, spaces, hyphens, or apostrophes.`;
  }
  return "";
}

/**
 * Validates employee ID.
 */
export function validateEmpId(value) {
  if (value === "" || value === null || value === undefined) {
    return "Employee ID is required.";
  }
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    return "Employee ID must be a positive whole number (1 or greater).";
  }
  if (num > 2147483647) {
    return "Employee ID is too large (maximum 2,147,483,647).";
  }
  return "";
}

/**
 * Validates an email address.
 */
export function validateEmail(value, required = false) {
  const trimmed = (value || "").trim();
  if (!trimmed) {
    if (required) return "Email address is required.";
    return "";
  }
  if (trimmed.length > 100) {
    return "Email address cannot exceed 100 characters.";
  }
  if (!EMAIL_REGEX.test(trimmed)) {
    return "Please enter a valid email address (e.g. name@company.com).";
  }
  return "";
}

/**
 * Validates salary amount.
 */
export function validateSalary(value, required = true) {
  if (value === "" || value === null || value === undefined) {
    if (required) return "Salary is required.";
    return "";
  }
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return "Salary must be a valid numeric value.";
  }
  if (num < 0) {
    return "Salary cannot be negative.";
  }
  if (num > 1000000000) {
    return "Salary cannot exceed 1,000,000,000.";
  }
  return "";
}

/**
 * Validates physical address.
 */
export function validateAddress(value) {
  const trimmed = (value || "").trim();
  if (!trimmed) {
    return "Address is required.";
  }
  if (trimmed.length < 5) {
    return "Address must be at least 5 characters long.";
  }
  if (trimmed.length > 500) {
    return "Address cannot exceed 500 characters.";
  }
  return "";
}

/**
 * Validates mobile phone input.
 */
export function validatePhone(digits, countryCode = "+91", customCode = "", required = false) {
  const cleanDigits = (digits || "").replace(/\D/g, "");
  if (!cleanDigits) {
    if (required) return "Mobile phone number is required.";
    return "";
  }

  if (cleanDigits.length !== 10) {
    return `Mobile number must be exactly 10 digits (currently ${cleanDigits.length} digit${cleanDigits.length === 1 ? "" : "s"}).`;
  }

  if (countryCode === "custom") {
    const codeTrim = (customCode || "").trim();
    if (!codeTrim || !codeTrim.startsWith("+") || codeTrim.length < 2) {
      return "Please enter a valid custom country code starting with '+' (e.g. +353).";
    }
  }

  return "";
}

/**
 * Validates Date of Birth.
 */
export function validateDob(value, required = false) {
  if (!value) {
    if (required) return "Date of birth is required.";
    return "";
  }

  const birthDate = new Date(value);
  if (isNaN(birthDate.getTime())) {
    return "Please enter a valid date of birth.";
  }

  const today = new Date();
  if (birthDate > today) {
    return "Date of birth cannot be in the future.";
  }

  const year = birthDate.getFullYear();
  if (year < 1920) {
    return "Date of birth cannot be earlier than year 1920.";
  }

  // Minimum age check (at least 14 years old for employment)
  const minAgeDate = new Date();
  minAgeDate.setFullYear(minAgeDate.getFullYear() - 14);
  if (birthDate > minAgeDate) {
    return "Employee must be at least 14 years old.";
  }

  return "";
}

/**
 * Validates Joining Date.
 */
export function validateJoiningDate(value, required = true) {
  if (!value) {
    if (required) return "Joining date is required.";
    return "";
  }

  const joinDate = new Date(value);
  if (isNaN(joinDate.getTime())) {
    return "Please enter a valid joining date.";
  }

  const year = joinDate.getFullYear();
  if (year < 1970) {
    return "Joining date cannot be earlier than 1970.";
  }

  // Disallow more than 1 year in future
  const maxFutureDate = new Date();
  maxFutureDate.setFullYear(maxFutureDate.getFullYear() + 1);
  if (joinDate > maxFutureDate) {
    return "Joining date cannot be more than 1 year in the future.";
  }

  return "";
}

/**
 * Validates password.
 */
export function validatePassword(value, minLength = 6) {
  if (!value) {
    return "Password is required.";
  }
  if (value.length < minLength) {
    return `Password must be at least ${minLength} characters long.`;
  }
  if (value.length > 128) {
    return "Password cannot exceed 128 characters.";
  }
  return "";
}

/**
 * Validates password confirmation.
 */
export function validateConfirmPassword(confirmPassword, password) {
  if (!confirmPassword) {
    return "Please confirm your password.";
  }
  if (confirmPassword !== password) {
    return "Passwords do not match.";
  }
  return "";
}

/**
 * Validates Department Name.
 */
export function validateDeptName(value) {
  const trimmed = (value || "").trim();
  if (!trimmed) {
    return "Department name is required.";
  }
  if (trimmed.length < 2) {
    return "Department name must be at least 2 characters long.";
  }
  if (trimmed.length > 50) {
    return "Department name cannot exceed 50 characters.";
  }
  return "";
}

/**
 * Validates Department Budget.
 */
export function validateBudget(value, required = false) {
  if (value === "" || value === null || value === undefined) {
    if (required) return "Budget is required.";
    return "";
  }
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return "Budget must be a valid numeric amount.";
  }
  if (num < 0) {
    return "Budget cannot be negative.";
  }
  if (num > 1000000000000) {
    return "Budget amount is unrealistically large.";
  }
  return "";
}

/**
 * Validates Username.
 */
export function validateUsername(value) {
  const trimmed = (value || "").trim();
  if (!trimmed) {
    return "Username is required.";
  }
  if (trimmed.length < 3) {
    return "Username must be at least 3 characters long.";
  }
  if (trimmed.length > 50) {
    return "Username cannot exceed 50 characters.";
  }
  if (!USERNAME_REGEX.test(trimmed)) {
    return "Username can only contain letters, numbers, hyphens, and underscores.";
  }
  return "";
}

