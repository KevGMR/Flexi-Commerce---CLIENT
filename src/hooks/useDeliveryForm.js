import { useState, useCallback, useMemo } from "react";
import { useSessionStore } from "@/store/session";
import {
  validatePhone,
  validateEmail,
  validateAddress,
  validateDeliveryForm,
} from "@/lib/validation";

/**
 * Custom hook for delivery form state management with validation
 * Handles form data, validation, and price calculation
 */
export function useDeliveryForm({
  initialData = {},
  categories = [],
  onSubmit = null,
} = {}) {
  const selectedLocationId = useSessionStore((s) => s.selectedLocationId);

  // Form state
  const [formData, setFormData] = useState({
    locationId: initialData.locationId || selectedLocationId || "",
    deliveryCategory: initialData.deliveryCategory || "",
    deliveryOption: initialData.deliveryOption || "",
    recipientName: initialData.recipientName || "",
    recipientPhone: initialData.recipientPhone || "",
    recipientEmail: initialData.recipientEmail || "",
    deliveryAddress: {
      street: initialData.deliveryAddress?.street || "",
      city: initialData.deliveryAddress?.city || "",
      state: initialData.deliveryAddress?.state || "",
      postalCode: initialData.deliveryAddress?.postalCode || "",
      country: initialData.deliveryAddress?.country || "Kenya",
      landmark: initialData.deliveryAddress?.landmark || "",
    },
    deliveryInstructions: initialData.deliveryInstructions || "",
    notes: initialData.notes || "",
    isTaxable: initialData.isTaxable ?? true,
  });

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update form field
  const updateField = useCallback((field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Clear error when field is updated
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  }, []);

  // Update nested address field
  const updateAddress = useCallback((field, value) => {
    setFormData((prev) => ({
      ...prev,
      deliveryAddress: {
        ...prev.deliveryAddress,
        [field]: value,
      },
    }));

    // Clear address errors
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors.deliveryAddress;
      return newErrors;
    });
  }, []);

  // Mark field as touched
  const touchField = useCallback((field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }, []);

  // Validate individual field
  const validateField = useCallback(
    (field, value) => {
      switch (field) {
        case "recipientPhone":
          return validatePhone(value);
        case "recipientEmail":
          return value ? validateEmail(value) : { valid: true };
        case "deliveryAddress":
          return validateAddress(value);
        case "recipientName":
          return value
            ? { valid: true }
            : { valid: false, message: "Recipient name is required" };
        case "deliveryCategory":
          return value
            ? { valid: true }
            : { valid: false, message: "Delivery category is required" };
        case "deliveryOption":
          if (!formData.deliveryCategory) return { valid: true };
          return value
            ? { valid: true }
            : { valid: false, message: "Delivery option is required" };
        default:
          return { valid: true };
      }
    },
    [formData.deliveryCategory],
  );

  // Validate entire form
  const validateForm = useCallback(() => {
    const validation = validateDeliveryForm(formData);

    if (!validation.valid) {
      setErrors(validation.errors);
      return false;
    }

    setErrors({});
    return true;
  }, [formData]);

  // Get selected category object
  const selectedCategory = useMemo(() => {
    if (!formData.deliveryCategory || !categories.length) return null;
    return categories.find((cat) => cat.categoryName === formData.deliveryCategory);
  }, [formData.deliveryCategory, categories]);

  // Get available options for selected category
  const availableOptions = useMemo(() => {
    if (!selectedCategory) return [];
    return selectedCategory.childOptions.filter((opt) => opt.isActive);
  }, [selectedCategory]);

  // Get selected option object
  const selectedOption = useMemo(() => {
    if (!formData.deliveryOption || !availableOptions.length) return null;
    return availableOptions.find(
      (opt) => opt.optionName === formData.deliveryOption,
    );
  }, [formData.deliveryOption, availableOptions]);

  // Calculate delivery price
  const deliveryPrice = useMemo(() => {
    if (selectedOption) {
      return selectedOption.price || 0;
    }
    return 0;
  }, [selectedOption]);

  // Reset form to initial state
  const resetForm = useCallback(() => {
    setFormData({
      locationId: selectedLocationId || "",
      deliveryCategory: "",
      deliveryOption: "",
      recipientName: "",
      recipientPhone: "",
      recipientEmail: "",
      deliveryAddress: {
        street: "",
        city: "",
        state: "",
        postalCode: "",
        country: "Kenya",
        landmark: "",
      },
      deliveryInstructions: "",
      notes: "",
      isTaxable: true,
    });
    setErrors({});
    setTouched({});
  }, [selectedLocationId]);

  // Handle form submission
  const handleSubmit = useCallback(
    async (e) => {
      if (e) e.preventDefault();

      // Mark all fields as touched
      setTouched({
        recipientName: true,
        recipientPhone: true,
        recipientEmail: true,
        deliveryAddress: true,
        deliveryCategory: true,
        deliveryOption: true,
      });

      // Validate form
      if (!validateForm()) {
        return false;
      }

      if (!onSubmit) return true;

      setIsSubmitting(true);
      try {
        await onSubmit(formData);
        return true;
      } catch (err) {
        console.error("Form submission error:", err);
        setErrors({ submit: err.message });
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [formData, validateForm, onSubmit],
  );

  // Check if form has unsaved changes
  const isDirty = useMemo(() => {
    return Object.keys(touched).length > 0;
  }, [touched]);

  // Check if form is valid
  const isValid = useMemo(() => {
    return Object.keys(errors).length === 0;
  }, [errors]);

  return {
    formData,
    errors,
    touched,
    isSubmitting,
    isDirty,
    isValid,
    deliveryPrice,
    selectedCategory,
    selectedOption,
    availableOptions,
    updateField,
    updateAddress,
    touchField,
    validateField,
    validateForm,
    handleSubmit,
    resetForm,
  };
}
