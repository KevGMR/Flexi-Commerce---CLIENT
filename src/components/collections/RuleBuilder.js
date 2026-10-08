"use client";

import { useEffect, useState } from "react";
import { locationsApi } from "@/lib/api-client";
import NumberInput from "@/components/products/NumberInput";

// Field config drives the UI: which input to render, which operators are valid.
const FIELD_CONFIG = {
  product: {
    name: { label: "Name", type: "string" },
    sku: { label: "SKU", type: "string" },
    vendor: { label: "Vendor", type: "string" },
    productType: { label: "Product type", type: "string" },
    handle: { label: "Handle", type: "string" },
    description: { label: "Description", type: "string" },
    tags: { label: "Tags", type: "string_array" },
    status: {
      label: "Status",
      type: "enum",
      options: ["active", "draft", "unlisted", "archived"],
    },
    type: {
      label: "Type",
      type: "enum",
      options: ["physical", "digital", "service"],
    },
    price: { label: "Price", type: "number" },
    compareAtPrice: { label: "Compare at price", type: "number" },
    cost: { label: "Cost", type: "number" },
    weight: { label: "Weight", type: "number" },
    published: { label: "Published", type: "boolean" },
    trackInventory: { label: "Track inventory", type: "boolean" },
  },
  variant: {
    sku: { label: "Variant SKU", type: "string" },
    barcode: { label: "Barcode", type: "string" },
    sourceSku: { label: "Source SKU", type: "string" },
    price: { label: "Variant price", type: "number" },
    compareAtPrice: { label: "Variant compare at price", type: "number" },
    cost: { label: "Variant cost", type: "number" },
    weight: { label: "Variant weight", type: "number" },
    trackInventory: { label: "Track variant inventory", type: "boolean" },
    continueSellingWhenOutOfStock: {
      label: "Continue selling when out of stock",
      type: "boolean",
    },
    status: {
      label: "Variant status",
      type: "enum",
      options: ["active", "archived"],
    },
  },
  location: {
    availableAtLocation: { label: "Available at location", type: "number" },
    onHandAtLocation: { label: "On hand at location", type: "number" },
    committedAtLocation: { label: "Committed at location", type: "number" },
  },
};

const OPERATORS_BY_TYPE = {
  string: ["equals", "not_equals", "contains", "not_contains", "starts_with", "ends_with", "is_set", "is_not_set"],
  string_array: ["contains", "not_contains", "is_set", "is_not_set"],
  number: ["equals", "not_equals", "greater_than", "greater_than_or_equal", "less_than", "less_than_or_equal", "is_set", "is_not_set"],
  boolean: ["is_true", "is_false"],
  enum: ["equals", "not_equals"],
};

const OPERATOR_LABELS = {
  equals: "is",
  not_equals: "is not",
  contains: "contains",
  not_contains: "does not contain",
  starts_with: "starts with",
  ends_with: "ends with",
  greater_than: "is greater than",
  greater_than_or_equal: "is at least",
  less_than: "is less than",
  less_than_or_equal: "is at most",
  is_true: "is true",
  is_false: "is false",
  is_set: "is set",
  is_not_set: "is not set",
};

const QUANTIFIER_LABELS = {
  any: "any variant",
  all: "all variants",
  count: "count of variants",
};

const COUNT_OPERATORS = ["equals", "greater_than", "greater_than_or_equal", "less_than", "less_than_or_equal"];

function getFieldConfig(scope, field, locationScoped) {
  if (locationScoped) return FIELD_CONFIG.location[field] || null;
  if (scope === "variant") return FIELD_CONFIG.variant[field] || null;
  return FIELD_CONFIG.product[field] || null;
}

function operatorNeedsValue(op) {
  return !["is_true", "is_false", "is_set", "is_not_set"].includes(op);
}

export default function RuleBuilder({ rules = [], logic = "AND", onChange }) {
  const [locations, setLocations] = useState([]);

  useEffect(() => {
    locationsApi
      .list()
      .then((data) => setLocations(data.locations || []))
      .catch(() => setLocations([]));
  }, []);

  const update = (index, patch) => {
    onChange({
      rules: rules.map((r, i) => (i === index ? { ...r, ...patch } : r)),
      logic,
    });
  };

  const addRule = () => {
    onChange({
      rules: [
        ...rules,
        {
          scope: "product",
          field: "status",
          operator: "equals",
          value: "active",
        },
      ],
      logic,
    });
  };

  const removeRule = (index) => {
    onChange({
      rules: rules.filter((_, i) => i !== index),
      logic,
    });
  };

  const setLogic = (next) => {
    onChange({ rules, logic: next });
  };

  const handleScopeChange = (index, scope) => {
    // Reset field/operator/value to a sensible default for the new scope
    const defaultField =
      scope === "product" ? "status" : scope === "variant" ? "price" : "availableAtLocation";
    const isLocationField = defaultField.endsWith("AtLocation");
    const fc = getFieldConfig(scope, defaultField, isLocationField);
    const operators = fc ? OPERATORS_BY_TYPE[fc.type] : ["equals"];
    const operator = operators[0];

    update(index, {
      scope,
      field: defaultField,
      operator,
      value: fc?.type === "number" ? 0 : fc?.type === "enum" ? fc.options[0] : "",
      quantifier: scope === "variant" ? "any" : undefined,
      locationScope: isLocationField ? "any" : undefined,
      locationIds: undefined,
    });
  };

  const handleFieldChange = (index, field) => {
    const rule = rules[index];
    const isLocationField = field.endsWith("AtLocation");
    const fc = getFieldConfig(rule.scope, field, isLocationField);
    const operators = fc ? OPERATORS_BY_TYPE[fc.type] : ["equals"];
    const operator = operators[0];

    update(index, {
      field,
      operator,
      value: fc?.type === "number" ? 0 : fc?.type === "enum" ? fc.options[0] : "",
      locationScope: isLocationField ? rule.locationScope || "any" : undefined,
      locationIds: isLocationField ? rule.locationIds : undefined,
    });
  };

  return (
    <div className="space-y-3">
      {/* Logic toggle */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-600">Match</span>
        <select
          value={logic}
          onChange={(e) => setLogic(e.target.value)}
          className="px-2 py-1 border rounded text-sm"
        >
          <option value="AND">all</option>
          <option value="OR">any</option>
        </select>
        <span className="text-gray-600">of the following rules</span>
      </div>

      {rules.length === 0 && (
        <p className="text-sm text-gray-500">
          No rules yet. An automatic collection with no rules matches nothing.
        </p>
      )}

      {rules.map((rule, i) => {
        const isLocationField = rule.field?.endsWith("AtLocation");
        const fc = getFieldConfig(rule.scope, rule.field, isLocationField);
        const operators = fc ? OPERATORS_BY_TYPE[fc.type] : ["equals"];
        const validOperators = isLocationField
          ? ["greater_than", "greater_than_or_equal", "less_than", "less_than_or_equal", "equals", "not_equals"]
          : operators;

        return (
          <div key={i} className="border rounded-lg p-3 space-y-3 bg-gray-50">
            {/* Row 1: scope + field + operator + value */}
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {i === 0 && (
                <span className="text-gray-600">If</span>
              )}
              {i > 0 && (
                <span className="text-gray-400">
                  {logic === "AND" ? "and" : "or"}
                </span>
              )}

              <select
                value={rule.scope || "product"}
                onChange={(e) => handleScopeChange(i, e.target.value)}
                className="px-2 py-1 border rounded text-sm"
              >
                <option value="product">product</option>
                <option value="variant">variant</option>
              </select>

              {/* Variant quantifier */}
              {rule.scope === "variant" && !isLocationField && (
                <select
                  value={rule.quantifier || "any"}
                  onChange={(e) => update(i, { quantifier: e.target.value })}
                  className="px-2 py-1 border rounded text-sm"
                >
                  <option value="any">any</option>
                  <option value="all">all</option>
                  <option value="count">count of</option>
                </select>
              )}

              {/* Field */}
              <select
                value={rule.field}
                onChange={(e) => handleFieldChange(i, e.target.value)}
                className="px-2 py-1 border rounded text-sm"
              >
                {Object.entries(
                  isLocationField
                    ? FIELD_CONFIG.location
                    : rule.scope === "variant"
                      ? FIELD_CONFIG.variant
                      : FIELD_CONFIG.product,
                ).map(([key, cfg]) => (
                  <option key={key} value={key}>
                    {cfg.label}
                  </option>
                ))}
              </select>

              {/* Operator */}
              <select
                value={rule.operator}
                onChange={(e) => update(i, { operator: e.target.value })}
                className="px-2 py-1 border rounded text-sm"
              >
                {validOperators.map((op) => (
                  <option key={op} value={op}>
                    {OPERATOR_LABELS[op]}
                  </option>
                ))}
              </select>

              {/* Value input depends on type */}
              {operatorNeedsValue(rule.operator) && fc && (
                <>
                  {fc.type === "enum" && (
                    <select
                      value={rule.value || ""}
                      onChange={(e) => update(i, { value: e.target.value })}
                      className="px-2 py-1 border rounded text-sm"
                    >
                      {fc.options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  )}
                  {fc.type === "number" && (
                    <NumberInput
                      value={rule.value ?? 0}
                      onChange={(v) => update(i, { value: v })}
                      emptyValue={0}
                      className="w-24 px-2 py-1 border rounded text-sm"
                    />
                  )}
                  {(fc.type === "string" || fc.type === "string_array") && (
                    <input
                      type="text"
                      value={rule.value ?? ""}
                      onChange={(e) => update(i, { value: e.target.value })}
                      placeholder="value"
                      className="w-40 px-2 py-1 border rounded text-sm"
                    />
                  )}
                </>
              )}

              <button
                type="button"
                onClick={() => removeRule(i)}
                className="ml-auto text-xs text-red-600 hover:text-red-800"
              >
                Remove
              </button>
            </div>

            {/* Count quantifier second row */}
            {rule.scope === "variant" &&
              rule.quantifier === "count" &&
              !isLocationField && (
                <div className="flex items-center gap-2 text-sm pl-12">
                  <span className="text-gray-600">and the count is</span>
                  <select
                    value={rule.countOperator || "greater_than_or_equal"}
                    onChange={(e) => update(i, { countOperator: e.target.value })}
                    className="px-2 py-1 border rounded text-sm"
                  >
                    {COUNT_OPERATORS.map((op) => (
                      <option key={op} value={op}>
                        {OPERATOR_LABELS[op]}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0"
                    value={rule.countValue ?? 0}
                    onChange={(e) =>
                      update(i, { countValue: Number(e.target.value) || 0 })
                    }
                    className="w-20 px-2 py-1 border rounded text-sm"
                  />
                </div>
              )}

            {/* Location scope picker */}
            {isLocationField && (
              <div className="flex items-center gap-2 text-sm pl-12 flex-wrap">
                <span className="text-gray-600">at</span>
                <select
                  value={rule.locationScope || "any"}
                  onChange={(e) =>
                    update(i, {
                      locationScope: e.target.value,
                      locationIds:
                        e.target.value === "specified"
                          ? rule.locationIds || []
                          : undefined,
                    })
                  }
                  className="px-2 py-1 border rounded text-sm"
                >
                  <option value="any">any location</option>
                  <option value="specified">specific locations</option>
                </select>

                {rule.locationScope === "specified" && (
                  <select
                    multiple
                    value={(rule.locationIds || []).map(String)}
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions).map(
                        (o) => o.value,
                      );
                      update(i, { locationIds: selected });
                    }}
                    className="px-2 py-1 border rounded text-sm min-w-48"
                    size={Math.min(4, locations.length)}
                  >
                    {locations.map((loc) => (
                      <option key={loc._id} value={loc._id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={addRule}
        className="text-sm text-blue-600 hover:underline"
      >
        + Add rule
      </button>
    </div>
  );
}