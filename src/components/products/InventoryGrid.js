"use client";

import NumberInput from "./NumberInput";

export default function InventoryGrid({ locations, inventory, variants, onChange }) {
  const findQty = (variantId, locationId) => {
    const row = inventory.find(
      (i) => String(i.variantId) === String(variantId) && String(i.locationId) === String(locationId)
    );
    return row?.onHand ?? 0;
  };

  const setQty = (variantId, locationId, value) => {
    const qty = Number(value) || 0;
    const existing = inventory.find(
      (i) => String(i.variantId) === String(variantId) && String(i.locationId) === String(locationId)
    );
    if (existing) {
      onChange(
        inventory.map((i) =>
          i === existing ? { ...i, onHand: qty, available: qty } : i
        )
      );
    } else {
      onChange([
        ...inventory,
        { variantId, locationId, onHand: qty, available: qty, committed: 0, unavailable: 0 },
      ]);
    }
  };

  if (!locations?.length) {
    return <p className="text-sm text-gray-500">No locations configured.</p>;
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b">
        <span className="text-sm font-medium">Inventory</span>
        <span className="text-xs text-gray-500">Inventory tracked</span>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b text-xs uppercase text-gray-500">
          <tr>
            <th className="px-3 py-2 text-left">Variant</th>
            {locations.map((l) => (
              <th key={l._id} className="px-3 py-2 text-right">
                {l.name}
                {l.isDefault && <span className="ml-1 text-[10px] text-gray-400">(default)</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {variants.map((v) => (
            <tr key={v._id || v._temp} className="border-b last:border-b-0">
              <td className="px-3 py-2 text-gray-700">
                {v.selectedOptions?.map((o) => o.value).join(" / ") || "Default"}
              </td>
              {locations.map((l) => (
                <td key={l._id} className="px-3 py-2 text-right">
                  <NumberInput
                    value={findQty(v._id, l._id)}
                    onChange={(val) => setQty(v._id, l._id, val)}
                    emptyValue={0}
                    step="1"
                    disabled={v.trackInventory === false}
                    className="w-20 px-2 py-1 border rounded text-sm text-right disabled:bg-gray-100"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}