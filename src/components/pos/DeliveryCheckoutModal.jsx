"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api-client";

export default function DeliveryCheckoutModal({
  isOpen,
  locationId,
  cartSubtotal,
  cartDiscount,
  onConfirm,
  onSkip,
  onClose,
}) {
  const [deliveryCategories, setDeliveryCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedOption, setSelectedOption] = useState("");
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [deliveryStreet, setDeliveryStreet] = useState("");
  const [deliveryCity, setDeliveryCity] = useState("");
  const [deliveryCountry, setDeliveryCountry] = useState("Kenya"); // Default to Kenya
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  // Calculate totals
  const cartTotal = Math.max(0, cartSubtotal - cartDiscount);
  const totalWithDelivery = cartTotal + deliveryFee;

  // Load delivery categories when modal opens
  useEffect(() => {
    if (isOpen && locationId) {
      loadDeliveryCategories();
    }
  }, [isOpen, locationId]);

  const loadDeliveryCategories = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`/locations/${locationId}/delivery-categories`);
      if (res?.categories) {
        setDeliveryCategories(res.categories);
      }
    } catch (err) {
      setError("Failed to load delivery categories");
      console.error("Error loading delivery categories:", err);
    } finally {
      setLoading(false);
    }
  };

  // Update delivery fee when option changes
  useEffect(() => {
    if (selectedCategory && selectedOption) {
      const category = deliveryCategories.find(
        (cat) => cat.categoryName === selectedCategory
      );
      if (category) {
        const option = category.childOptions?.find(
          (opt) => opt.optionName === selectedOption
        );
        if (option) {
          setDeliveryFee(option.price || 0);
        }
      }
    } else {
      setDeliveryFee(0);
    }
  }, [selectedCategory, selectedOption, deliveryCategories]);

  const handleCategoryChange = (e) => {
    setSelectedCategory(e.target.value);
    setSelectedOption(""); // Reset option when category changes
  };

  const handleConfirm = () => {
    setFormError("");

    // Validate required fields
    if (
      !recipientName.trim() ||
      !recipientPhone.trim() ||
      !deliveryStreet.trim() ||
      !deliveryCity.trim() ||
      !selectedCategory ||
      !selectedOption
    ) {
      setFormError("Please fill in all required delivery fields");
      return;
    }

    const deliveryInfo = {
      requiresDelivery: true,
      recipientName: recipientName.trim(),
      recipientPhone: recipientPhone.trim(),
      deliveryAddress: {
        street: deliveryStreet.trim(),
        city: deliveryCity.trim(),
        country: deliveryCountry.trim(),
      },
      deliveryCategory: selectedCategory,
      deliveryOption: selectedOption,
    };

    onConfirm(deliveryInfo, deliveryFee);
  };

  const currentCategory = deliveryCategories.find(
    (cat) => cat.categoryName === selectedCategory
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-blue-600 text-white p-6 border-b border-blue-700">
          <h2 className="text-2xl font-bold">Delivery Information</h2>
          <p className="text-blue-100 mt-1">
            Please provide delivery details and select a delivery option
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {formError && (
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-orange-700 text-sm">{formError}</p>
            </div>
          )}

          {loading ? (
            <div className="text-center py-8">
              <p className="text-gray-600">Loading delivery options...</p>
            </div>
          ) : (
            <>
              {/* Recipient Information Section */}
              <div className="space-y-4 border-b pb-4">
                <h3 className="font-semibold text-gray-900">
                  Recipient Information
                </h3>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Recipient Name *
                  </label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="Full name"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    placeholder="+254 700 000000"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Delivery Address Section */}
              <div className="space-y-4 border-b pb-4">
                <h3 className="font-semibold text-gray-900">Delivery Address</h3>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Street Address *
                  </label>
                  <input
                    type="text"
                    value={deliveryStreet}
                    onChange={(e) => setDeliveryStreet(e.target.value)}
                    placeholder="123 Main Street"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      City *
                    </label>
                    <input
                      type="text"
                      value={deliveryCity}
                      onChange={(e) => setDeliveryCity(e.target.value)}
                      placeholder="Nairobi"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Country (optional - defaults to Kenya)
                    </label>
                    <input
                      type="text"
                      value={deliveryCountry}
                      onChange={(e) => setDeliveryCountry(e.target.value || "Kenya")}
                      placeholder="Kenya"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Delivery Options Section */}
              <div className="space-y-4 border-b pb-4">
                <h3 className="font-semibold text-gray-900">Delivery Options</h3>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Delivery Category *
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={handleCategoryChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    <option value="">Select a delivery category</option>
                    {deliveryCategories.map((cat) => (
                      <option key={cat.categoryName} value={cat.categoryName}>
                        {cat.categoryName}
                      </option>
                    ))}
                  </select>
                </div>

                {currentCategory && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Delivery Option *
                    </label>
                    <select
                      value={selectedOption}
                      onChange={(e) => setSelectedOption(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    >
                      <option value="">Select an option</option>
                      {currentCategory.childOptions?.map((opt) => (
                        <option key={opt.optionName} value={opt.optionName}>
                          {opt.optionName} - ${opt.price?.toFixed(2) || "0.00"}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Price Summary */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-gray-700">
                  <span>Subtotal:</span>
                  <span>${cartTotal.toFixed(2)}</span>
                </div>
                {deliveryFee > 0 && (
                  <div className="flex justify-between text-blue-700 font-semibold border-t pt-2">
                    <span>Delivery Fee:</span>
                    <span>${deliveryFee.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold text-gray-900 border-t pt-2">
                  <span>Total with Delivery:</span>
                  <span>${totalWithDelivery.toFixed(2)}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-6 flex gap-3">
          <button
            onClick={onSkip}
            className="flex-1 px-4 py-3 bg-gray-300 hover:bg-gray-400 text-gray-900 font-semibold rounded-lg transition-colors"
          >
            Skip Delivery
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || !selectedCategory || !selectedOption}
            className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold rounded-lg transition-colors"
          >
            Confirm Delivery
          </button>
        </div>
      </div>
    </div>
  );
}
