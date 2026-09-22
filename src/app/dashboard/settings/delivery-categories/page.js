"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { useSessionStore } from "@/store/session";
import { PERMISSIONS } from "@/lib/permissions";
import { PlusCircleIcon, PencilIcon, TrashIcon } from "@heroicons/react/24/outline";

export default function deliveryCategoriesPage() {
  const can = useSessionStore((s) => s.can);
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingOption, setEditingOption] = useState(null); // { categoryId, optionId, data }

  const [categoryForm, setCategoryForm] = useState({
    categoryName: "",
    description: "",
    statusWorkflow: [
      { status: "pending", displayName: "Pending", order: 0 },
      { status: "ready", displayName: "Ready", order: 1 },
      { status: "completed", displayName: "Completed", order: 2 },
    ],
    childOptions: [
      { optionName: "", price: 0, estimatedDays: 1 },
    ],
  });

  useEffect(() => {
    loadLocations();
  }, []);

  useEffect(() => {
    if (selectedLocation) {
      loadCategories();
    }
  }, [selectedLocation]);

  const loadLocations = async () => {
    try {
      const data = await apiFetch("/locations");
      setLocations(data?.locations || []);
      if (data?.locations?.length > 0) {
        setSelectedLocation(data.locations[0]._id);
      }
    } catch (err) {
      setError(err?.message || "Failed to load locations.");
    }
  };

  const loadCategories = async () => {
    if (!selectedLocation) return;
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch(`/locations/${selectedLocation}/delivery-categories`);
      setCategories(data?.categories || []);
    } catch (err) {
      setError(err?.message || "Failed to load delivery categories.");
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryFormChange = (field, value) => {
    setCategoryForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleWorkflowChange = (index, field, value) => {
    setCategoryForm((prev) => {
      const workflow = [...prev.statusWorkflow];
      workflow[index] = { ...workflow[index], [field]: value };
      return { ...prev, statusWorkflow: workflow };
    });
  };

  const addWorkflowStep = () => {
    setCategoryForm((prev) => ({
      ...prev,
      statusWorkflow: [
        ...prev.statusWorkflow,
        { status: "", displayName: "", order: prev.statusWorkflow.length },
      ],
    }));
  };

  const removeWorkflowStep = (index) => {
    setCategoryForm((prev) => ({
      ...prev,
      statusWorkflow: prev.statusWorkflow.filter((_, i) => i !== index),
    }));
  };

  const handleOptionChange = (index, field, value) => {
    setCategoryForm((prev) => {
      const options = [...prev.childOptions];
      options[index] = { ...options[index], [field]: value };
      return { ...prev, childOptions: options };
    });
  };

  const addOption = () => {
    setCategoryForm((prev) => ({
      ...prev,
      childOptions: [
        ...prev.childOptions,
        { optionName: "", price: 0, estimatedDays: 1 },
      ],
    }));
  };

  const removeOption = (index) => {
    setCategoryForm((prev) => ({
      ...prev,
      childOptions: prev.childOptions.filter((_, i) => i !== index),
    }));
  };

  const normalizeOptionPayload = (option) => ({
    optionName: option.optionName?.trim() || "",
    price: Number(option.price),
    estimatedDays: Number.isFinite(Number(option.estimatedDays))
      ? Number(option.estimatedDays)
      : 1,
    isActive: option.isActive !== false,
    description: option.description || "",
  });

  const hasOptionChanged = (originalOption, nextPayload) => {
    const currentPayload = normalizeOptionPayload(originalOption);
    return (
      currentPayload.optionName !== nextPayload.optionName ||
      currentPayload.price !== nextPayload.price ||
      currentPayload.estimatedDays !== nextPayload.estimatedDays ||
      currentPayload.isActive !== nextPayload.isActive ||
      currentPayload.description !== nextPayload.description
    );
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    setStatus("");
    setError("");

    // Validate
    if (!categoryForm.categoryName) {
      setError("Category name is required");
      return;
    }

    if (categoryForm.childOptions.length === 0) {
      setError("At least one delivery option is required");
      return;
    }

    const invalidOptionNameIndex = categoryForm.childOptions.findIndex(
      (option) => !option.optionName || option.optionName.trim() === ""
    );

    if (invalidOptionNameIndex !== -1) {
      setError(`Option name is required for option #${invalidOptionNameIndex + 1}`);
      return;
    }

    const invalidOptionPriceIndex = categoryForm.childOptions.findIndex(
      (option) => !Number.isFinite(Number(option.price)) || Number(option.price) < 0
    );

    if (invalidOptionPriceIndex !== -1) {
      setError(`Price must be a non-negative number for option #${invalidOptionPriceIndex + 1}`);
      return;
    }

    try {
      if (editingCategory) {
        // Update existing category
        await apiFetch(`/locations/${selectedLocation}/delivery-categories/${editingCategory._id}`, {
          method: "PATCH",
          body: {
            categoryName: categoryForm.categoryName,
            description: categoryForm.description,
            statusWorkflow: categoryForm.statusWorkflow,
          },
        });

        const originalOptions = editingCategory.childOptions || [];
        const currentOptions = categoryForm.childOptions || [];
        const originalOptionsById = new Map(
          originalOptions
            .filter((option) => option._id)
            .map((option) => [String(option._id), option])
        );
        const retainedOptionIds = new Set();

        for (const option of currentOptions) {
          const payload = normalizeOptionPayload(option);

          if (option._id) {
            const optionId = String(option._id);
            retainedOptionIds.add(optionId);
            const originalOption = originalOptionsById.get(optionId);

            if (!originalOption || hasOptionChanged(originalOption, payload)) {
              await apiFetch(
                `/locations/${selectedLocation}/delivery-categories/${editingCategory._id}/options/${optionId}`,
                {
                  method: "PATCH",
                  body: payload,
                }
              );
            }
          } else {
            await apiFetch(
              `/locations/${selectedLocation}/delivery-categories/${editingCategory._id}/options`,
              {
                method: "POST",
                body: payload,
              }
            );
          }
        }

        for (const option of originalOptions) {
          if (!option?._id) continue;
          const optionId = String(option._id);
          if (retainedOptionIds.has(optionId)) continue;

          await apiFetch(
            `/locations/${selectedLocation}/delivery-categories/${editingCategory._id}/options/${optionId}`,
            {
              method: "DELETE",
            }
          );
        }

        setStatus("Category updated successfully.");
      } else {
        // Create new category
        await apiFetch(`/locations/${selectedLocation}/delivery-categories`, {
          method: "POST",
          body: categoryForm,
        });
        setStatus("Category created successfully.");
      }
      
      resetForm();
      await loadCategories();
    } catch (err) {
      setError(err?.message || "Failed to save category.");
    }
  };

  const resetForm = () => {
    setCategoryForm({
      categoryName: "",
      description: "",
      statusWorkflow: [
        { status: "pending", displayName: "Pending", order: 0 },
        { status: "ready", displayName: "Ready", order: 1 },
        { status: "completed", displayName: "Completed", order: 2 },
      ],
      childOptions: [
        { optionName: "", price: 0, estimatedDays: 1 },
      ],
    });
    setEditingCategory(null);
    setShowCategoryForm(false);
  };

  const handleEditCategory = (category) => {
    setEditingCategory(category);
    setCategoryForm({
      categoryName: category.categoryName,
      description: category.description || "",
      statusWorkflow: category.statusWorkflow || [],
      childOptions: category.childOptions || [],
    });
    setShowCategoryForm(true);
  };

  const handleDeleteCategory = async (categoryId) => {
    if (!confirm("Are you sure you want to delete this delivery category?")) {
      return;
    }

    setStatus("");
    setError("");
    try {
      await apiFetch(`/locations/${selectedLocation}/delivery-categories/${categoryId}`, {
        method: "DELETE",
      });
      setStatus("Category deleted successfully.");
      await loadCategories();
    } catch (err) {
      setError(err?.message || "Failed to delete category.");
    }
  };

  const handleToggleCategoryActive = async (category) => {
    try {
      await apiFetch(`/locations/${selectedLocation}/delivery-categories/${category._id}`, {
        method: "PATCH",
        body: { isActive: !category.isActive },
      });
      await loadCategories();
    } catch (err) {
      setError(err?.message || "Failed to update category.");
    }
  };

  const handleEditOption = (categoryId, option) => {
    setEditingOption({
      categoryId,
      optionId: option._id,
      data: {
        optionName: option.optionName,
        price: option.price,
        estimatedDays: option.estimatedDays || 1,
        description: option.description || "",
        isActive: option.isActive !== false,
      },
    });
  };

  const handleUpdateOption = async (e) => {
    e.preventDefault();
    setStatus("");
    setError("");

    if (!editingOption) return;

    // Validate
    if (!editingOption.data.optionName || editingOption.data.optionName.trim() === "") {
      setError("Option name is required");
      return;
    }

    if (editingOption.data.price < 0) {
      setError("Price must be a positive number");
      return;
    }

    try {
      await apiFetch(
        `/locations/${selectedLocation}/delivery-categories/${editingOption.categoryId}/options/${editingOption.optionId}`,
        {
          method: "PATCH",
          body: editingOption.data,
        }
      );
      setStatus("Option updated successfully.");
      setEditingOption(null);
      await loadCategories();
    } catch (err) {
      setError(err?.message || "Failed to update option.");
    }
  };

  const handleDeleteOption = async (categoryId, optionId) => {
    if (!confirm("Are you sure you want to delete this delivery option?")) {
      return;
    }

    setStatus("");
    setError("");
    try {
      await apiFetch(
        `/locations/${selectedLocation}/delivery-categories/${categoryId}/options/${optionId}`,
        {
          method: "DELETE",
        }
      );
      setStatus("Option deleted successfully.");
      await loadCategories();
    } catch (err) {
      setError(err?.message || "Failed to delete option.");
    }
  };

  const handleToggleOptionActive = async (categoryId, option) => {
    try {
      await apiFetch(
        `/locations/${selectedLocation}/delivery-categories/${categoryId}/options/${option._id}`,
        {
          method: "PATCH",
          body: { isActive: !option.isActive },
        }
      );
      await loadCategories();
    } catch (err) {
      setError(err?.message || "Failed to update option.");
    }
  };

  const canManage = can(PERMISSIONS.MANAGE_INVENTORY); // Or create a specific MANAGE_DELIVERY_CATEGORIES permission

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Delivery Categories</h1>
        <p className="mt-1 text-sm text-gray-600">
          Manage customizable delivery methods for your locations
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {status && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-800">{status}</p>
        </div>
      )}

      {/* Location selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Location
        </label>
        <select
          value={selectedLocation || ""}
          onChange={(e) => setSelectedLocation(e.target.value)}
          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
        >
          {locations.map((loc) => (
            <option key={loc._id} value={loc._id}>
              {loc.name}
            </option>
          ))}
        </select>
      </div>

      {canManage && (
        <button
          onClick={() => setShowCategoryForm(!showCategoryForm)}
          className="mb-6 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
        >
          <PlusCircleIcon className="h-5 w-5 mr-2" />
          {showCategoryForm ? "Cancel" : "Add Category"}
        </button>
      )}

      {showCategoryForm && canManage && (
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">
            {editingCategory ? "Edit Category" : "Create New Category"}
          </h2>
          <form onSubmit={handleCreateCategory}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  value={categoryForm.categoryName}
                  onChange={(e) => handleCategoryFormChange("categoryName", e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="e.g., Shop Pickup, Local Delivery, Matatu/Saccos"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={categoryForm.description}
                  onChange={(e) => handleCategoryFormChange("description", e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status Workflow *
                </label>
                {categoryForm.statusWorkflow.map((step, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="Status (e.g., pending)"
                      value={step.status}
                      onChange={(e) => handleWorkflowChange(index, "status", e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                    <input
                      type="text"
                      placeholder="Display Name"
                      value={step.displayName}
                      onChange={(e) => handleWorkflowChange(index, "displayName", e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                    <input
                      type="number"
                      placeholder="Order"
                      value={step.order}
                      onChange={(e) => handleWorkflowChange(index, "order", parseInt(e.target.value))}
                      className="w-20 px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                    {categoryForm.statusWorkflow.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeWorkflowStep(index)}
                        className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-md"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addWorkflowStep}
                  className="text-sm text-indigo-600 hover:text-indigo-700"
                >
                  + Add workflow step
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Delivery Options *
                </label>
                {categoryForm.childOptions.map((option, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="Option Name (e.g., Same Day)"
                      value={option.optionName}
                      onChange={(e) => handleOptionChange(index, "optionName", e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                    <input
                      type="number"
                      placeholder="Price"
                      value={option.price}
                      onChange={(e) => handleOptionChange(index, "price", parseFloat(e.target.value))}
                      className="w-28 px-3 py-2 border border-gray-300 rounded-md"
                      step="0.01"
                      min="0"
                      required
                    />
                    <input
                      type="number"
                      placeholder="Days"
                      value={option.estimatedDays}
                      onChange={(e) => handleOptionChange(index, "estimatedDays", parseInt(e.target.value))}
                      className="w-20 px-3 py-2 border border-gray-300 rounded-md"
                      min="0"
                    />
                    {categoryForm.childOptions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeOption(index)}
                        className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-md"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addOption}
                  className="text-sm text-indigo-600 hover:text-indigo-700"
                >
                  + Add option
                </button>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  {editingCategory ? "Update Category" : "Create Category"}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Edit Option Modal */}
      {editingOption && canManage && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold mb-4">Edit Delivery Option</h2>
            <form onSubmit={handleUpdateOption}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Option Name *
                  </label>
                  <input
                    type="text"
                    value={editingOption.data.optionName}
                    onChange={(e) =>
                      setEditingOption((prev) => ({
                        ...prev,
                        data: { ...prev.data, optionName: e.target.value },
                      }))
                    }
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price *
                  </label>
                  <input
                    type="number"
                    value={editingOption.data.price}
                    onChange={(e) =>
                      setEditingOption((prev) => ({
                        ...prev,
                        data: { ...prev.data, price: parseFloat(e.target.value) },
                      }))
                    }
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md"
                    step="0.01"
                    min="0"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Estimated Days
                  </label>
                  <input
                    type="number"
                    value={editingOption.data.estimatedDays}
                    onChange={(e) =>
                      setEditingOption((prev) => ({
                        ...prev,
                        data: { ...prev.data, estimatedDays: parseInt(e.target.value) },
                      }))
                    }
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md"
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={editingOption.data.description}
                    onChange={(e) =>
                      setEditingOption((prev) => ({
                        ...prev,
                        data: { ...prev.data, description: e.target.value },
                      }))
                    }
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md"
                    rows={2}
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="optionActive"
                    checked={editingOption.data.isActive}
                    onChange={(e) =>
                      setEditingOption((prev) => ({
                        ...prev,
                        data: { ...prev.data, isActive: e.target.checked },
                      }))
                    }
                    className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                  />
                  <label htmlFor="optionActive" className="ml-2 block text-sm text-gray-700">
                    Active
                  </label>
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  Update Option
                </button>
                <button
                  type="button"
                  onClick={() => setEditingOption(null)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Categories List */}
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Delivery Categories
          </h2>
        </div>

        {loading ? (
          <div className="p-6 text-center text-gray-500">Loading...</div>
        ) : categories.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No delivery categories found. Add one to get started.
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {categories.map((category) => (
              <div key={category._id} className="p-6">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">
                      {category.categoryName}
                      {!category.isActive && (
                        <span className="ml-2 text-xs text-red-600 bg-red-100 px-2 py-1 rounded">
                          Inactive
                        </span>
                      )}
                    </h3>
                    {category.description && (
                      <p className="text-sm text-gray-600 mt-1">
                        {category.description}
                      </p>
                    )}
                  </div>
                  {canManage && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditCategory(category)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-md"
                        title="Edit"
                      >
                        <PencilIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleToggleCategoryActive(category)}
                        className={`px-3 py-1 text-sm rounded-md ${
                          category.isActive
                            ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                            : "bg-green-100 text-green-800 hover:bg-green-200"
                        }`}
                      >
                        {category.isActive ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(category._id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-md"
                        title="Delete"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                      Status Workflow
                    </h4>
                    <div className="space-y-1">
                      {category.statusWorkflow?.map((step, index) => (
                        <div key={index} className="text-sm text-gray-600">
                          {index + 1}. {step.displayName} ({step.status})
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                      Delivery Options
                    </h4>
                    <div className="space-y-2">
                      {category.childOptions?.map((option, index) => (
                        <div
                          key={option._id || index}
                          className="flex items-center justify-between bg-gray-50 p-2 rounded-md"
                        >
                          <div className="flex-1">
                            <span className="text-sm text-gray-900 font-medium">
                              {option.optionName}
                            </span>
                            {!option.isActive && (
                              <span className="ml-2 text-xs text-red-600 bg-red-100 px-2 py-0.5 rounded">
                                Inactive
                              </span>
                            )}
                            <div className="text-xs text-gray-600 mt-0.5">
                              ${option.price.toFixed(2)} • {option.estimatedDays}d
                              {option.description && ` • ${option.description}`}
                            </div>
                          </div>
                          {canManage && (
                            <div className="flex gap-1 ml-2">
                              <button
                                onClick={() => handleEditOption(category._id, option)}
                                className="p-1 text-gray-600 hover:bg-gray-200 rounded"
                                title="Edit option"
                              >
                                <PencilIcon className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleToggleOptionActive(category._id, option)}
                                className={`px-2 py-1 text-xs rounded ${
                                  option.isActive
                                    ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                                    : "bg-green-100 text-green-800 hover:bg-green-200"
                                }`}
                                title={option.isActive ? "Deactivate" : "Activate"}
                              >
                                {option.isActive ? "Off" : "On"}
                              </button>
                              <button
                                onClick={() => handleDeleteOption(category._id, option._id)}
                                className="p-1 text-red-600 hover:bg-red-100 rounded"
                                title="Delete option"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
