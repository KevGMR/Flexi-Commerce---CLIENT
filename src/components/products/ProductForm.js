"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { productsApi } from "@/lib/api-client";
import VariantEditor from "./VariantEditor";
import InventoryGrid from "./InventoryGrid";

const EMPTY = {
  name: "",
  description: "",
  status: "active",
  productType: "",
  vendor: "",
  tags: [],
  handle: "",
  options: [],
  metafields: [],
  images: [],
  price: 0,
  compareAtPrice: null,
  trackInventory: true,
  variants: [],
};

function Section({ title, children, action }) {
  return (
    <div className="border rounded-lg bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h2 className="text-sm font-medium">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Field({ label, children, hint }) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

export default function ProductForm({ productId = null }) {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [variants, setVariants] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(Boolean(productId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    if (!productId) {
      // new product — seed one default variant
      setVariants([
        {
          _temp: "new-default",
          sku: "",
          price: 0,
          compareAtPrice: null,
          trackInventory: true,
          selectedOptions: [],
        },
      ]);
      return;
    }

    let cancelled = false;
    productsApi
      .get(productId)
      .then((data) => {
        if (cancelled) return;
        const p = data.product;
        setForm({
          ...EMPTY,
          ...p,
          tags: p.tags || [],
          options: p.options || [],
          metafields: p.metafields || [],
          images: p.images || [],
        });
        setVariants(data.variants || []);
        setInventory(data.inventory || []);
        setLocations(data.locations || []);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
  }, [productId]);

  const update = (patch) => setForm((f) => ({ ...f, ...patch }));

  const addTag = () => {
    const t = tagInput.trim();
    if (!t || form.tags.includes(t)) return;
    update({ tags: [...form.tags, t] });
    setTagInput("");
  };

  const removeTag = (t) => update({ tags: form.tags.filter((x) => x !== t) });

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        variants,
        inventory,
      };

      const result = productId
        ? await productsApi.update(productId, payload)
        : await productsApi.create(payload);

      router.push(`/dashboard/products/${result.product._id}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6 text-gray-500">Loading…</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">
          {productId ? "Edit product" : "Add product"}
        </h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 border rounded-md text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="px-4 py-2 bg-black text-white rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ---- main column ---- */}
        <div className="lg:col-span-2 space-y-6">
          <Section title="Title & description">
            <div className="space-y-4">
              <Field label="Title">
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => update({ name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                />
              </Field>
              <Field label="Description">
                <textarea
                  rows={6}
                  value={form.description}
                  onChange={(e) => update({ description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                />
              </Field>
            </div>
          </Section>

          <Section title="Media">
            {form.images.length === 0 ? (
              <div className="border-2 border-dashed rounded-lg p-8 text-center text-sm text-gray-500">
                No media yet. Image uploads will be added in a later pass.
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-3">
                {form.images.map((img, i) => (
                  <div key={img.shopifyImageId || i} className="relative group">
                    <img
                      src={img.url}
                      alt={img.alt || ""}
                      className="w-full aspect-square object-cover rounded border"
                    />
                    <button
                      type="button"
                      onClick={() => update({ images: form.images.filter((_, xi) => xi !== i) })}
                      className="absolute top-1 right-1 bg-white rounded-full w-6 h-6 text-xs opacity-0 group-hover:opacity-100"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Pricing">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Price (KES)">
                <input
                  type="number"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => update({ price: Number(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                />
              </Field>
              <Field label="Compare at price (KES)">
                <input
                  type="number"
                  step="0.01"
                  value={form.compareAtPrice ?? ""}
                  onChange={(e) =>
                    update({ compareAtPrice: e.target.value === "" ? null : Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 border rounded-md text-sm"
                />
              </Field>
            </div>
          </Section>

          <Section title="Variants">
            <VariantEditor
              options={form.options}
              onOptionsChange={(o) => update({ options: o })}
              variants={variants}
              onVariantsChange={setVariants}
            />
          </Section>

          <Section title="Inventory">
            <InventoryGrid
              locations={locations}
              inventory={inventory}
              variants={variants}
              onChange={setInventory}
            />
          </Section>

          <Section title="Metafields">
            {form.metafields.length === 0 ? (
              <p className="text-sm text-gray-500">No metafields.</p>
            ) : (
              <div className="space-y-2">
                {form.metafields.map((m, i) => (
                  <div key={i} className="flex gap-2 items-center text-sm">
                    <span className="font-mono text-xs text-gray-500">
                      {m.namespace}.{m.key}
                    </span>
                    <span className="text-gray-400">→</span>
                    <span className="flex-1 truncate">{m.value}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* ---- right rail ---- */}
        <div className="space-y-6">
          <Section title="Status">
            <select
              value={form.status}
              onChange={(e) => update({ status: e.target.value })}
              className="w-full px-3 py-2 border rounded-md text-sm"
            >
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="unlisted">Unlisted</option>
              <option value="archived">Archived</option>
            </select>
          </Section>

          <Section title="Product organization">
            <div className="space-y-4">
              <Field label="Type">
                <input
                  type="text"
                  value={form.productType}
                  onChange={(e) => update({ productType: e.target.value })}
                  placeholder="e.g. Dress, Jumpsuit"
                  className="w-full px-3 py-2 border rounded-md text-sm"
                />
              </Field>
              <Field label="Vendor">
                <input
                  type="text"
                  value={form.vendor}
                  onChange={(e) => update({ vendor: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                />
              </Field>
              <Field label="Tags">
                <div className="flex gap-1 flex-wrap mb-2">
                  {form.tags.map((t) => (
                    <span key={t} className="px-2 py-1 bg-gray-100 rounded-full text-xs flex items-center gap-1">
                      {t}
                      <button type="button" onClick={() => removeTag(t)} className="text-gray-500 hover:text-black">×</button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                    className="flex-1 px-3 py-2 border rounded-md text-sm"
                    placeholder="Add tag"
                  />
                  <button type="button" onClick={addTag} className="px-3 py-2 border rounded-md text-sm">
                    Add
                  </button>
                </div>
              </Field>
              <Field label="Handle" hint="URL slug. Leave blank to auto-generate.">
                <input
                  type="text"
                  value={form.handle}
                  onChange={(e) => update({ handle: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md text-sm font-mono"
                />
              </Field>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}