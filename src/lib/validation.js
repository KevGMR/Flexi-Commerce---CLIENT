/**
 * Form validation utilities for delivery-related forms
 */

/**
 * Validate phone number in E.164 format
 * @param {string} phone - Phone number to validate
 * @returns {{ isValid: boolean, error: string | null }}
 */
export const validatePhone = (phone) => {
  if (!phone || phone.trim() === "") {
    return { isValid: true, error: null }; // Empty is okay if optional
  }

  // Remove common formatting characters
  const cleaned = phone.replace(/[\s-()]/g, "");

  // E.164 format: + followed by 1-15 digits
  const e164Regex = /^\+?[1-9]\d{7,14}$/;

  if (!e164Regex.test(cleaned)) {
    return {
      isValid: false,
      error: "Please enter a valid phone number with country code (e.g., +1234567890)",
    };
  }

  return { isValid: true, error: null };
};

/**
 * Validate email address
 * @param {string} email - Email address to validate
 * @returns {{ isValid: boolean, error: string | null }}
 */
export const validateEmail = (email) => {
  if (!email || email.trim() === "") {
    return { isValid: true, error: null }; // Empty is okay if optional
  }

  // Standard email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) {
    return {
      isValid: false,
      error: "Please enter a valid email address",
    };
  }

  return { isValid: true, error: null };
};

/**
 * Validate delivery address completeness
 * @param {Object} address - Address object with street, city, state, zipCode, country
 * @returns {{ isValid: boolean, errors: Object }}
 */
export const validateAddress = (address) => {
  const errors = {};

  if (!address?.street || address.street.trim() === "") {
    errors.street = "Street is required";
  }

  if (!address?.city || address.city.trim() === "") {
    errors.city = "City is required";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

/**
 * Validate recipient information (name, phone, email)
 * @param {Object} recipient - Recipient object with name, phone, email
 * @returns {{ isValid: boolean, errors: Object }}
 */
export const validateRecipient = (recipient) => {
  const errors = {};

  // Name is required
  if (!recipient?.recipientName || recipient.recipientName.trim() === "") {
    errors.recipientName = "Recipient name is required";
  }

  // At least one contact method is required
  if (!recipient?.recipientPhone && !recipient?.recipientEmail) {
    errors.contact = "At least one contact method (phone or email) is required";
  }

  // Validate phone if provided
  if (recipient?.recipientPhone) {
    const phoneValidation = validatePhone(recipient.recipientPhone);
    if (!phoneValidation.isValid) {
      errors.recipientPhone = phoneValidation.error;
    }
  }

  // Validate email if provided
  if (recipient?.recipientEmail) {
    const emailValidation = validateEmail(recipient.recipientEmail);
    if (!emailValidation.isValid) {
      errors.recipientEmail = emailValidation.error;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

/**
 * Validate entire delivery form data
 * @param {Object} formData - Complete form data object
 * @returns {{ isValid: boolean, errors: Object }}
 */
export const validateDeliveryForm = (formData) => {
  const errors = {};

  // Validate recipient
  const recipientValidation = validateRecipient(formData);
  if (!recipientValidation.isValid) {
    Object.assign(errors, recipientValidation.errors);
  }

  // Validate address
  const addressValidation = validateAddress(formData.deliveryAddress);
  if (!addressValidation.isValid) {
    Object.assign(errors, addressValidation.errors);
  }

  // Validate location
  if (!formData.locationId) {
    errors.locationId = "Location is required";
  }

  // Validate delivery method (category only)
  if (!formData.deliveryCategory) {
    errors.deliveryCategory = "Please select a delivery category";
  } else if (!formData.deliveryOption) {
    errors.deliveryOption = "Please select a delivery option";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

/**
 * Format phone number for display (add country code if missing)
 * @param {string} phone - Phone number
 * @returns {string} - Formatted phone number
 */
export const formatPhoneForDisplay = (phone) => {
  if (!phone) return "";

  const cleaned = phone.replace(/[\s-()]/g, "");

  // If doesn't start with +, assume it needs formatting
  if (!cleaned.startsWith("+")) {
    // For display purposes, you might want to add a default country code
    // This is just for UI, validation should enforce the correct format
    return phone;
  }

  return phone;
};

/**
 * Format address for display (single line)
 * @param {Object} address - Address object
 * @returns {string} - Formatted address string
 */
export const formatAddressForDisplay = (address) => {
  if (!address) return "";

  const parts = [
    address.street,
    address.city,
    address.state,
    address.postalCode,
    address.country,
  ].filter(Boolean);

  return parts.join(", ");
};
