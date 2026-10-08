"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { collectionsApi } from "@/lib/api-client";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import DiscardChangesModal from "@/components/products/DiscardChangesModal";
import SingleImageUploader from "./SingleImageUploader";
import ProductPicker from "./ProductPicker";
import CollectionProductsList from "./CollectionProductsList";
import RuleBuilder from "./RuleBuilder";

const EMPTY = {
  name: "",
  slug: "",
  description: "",
  parentCollectionId: null,
  type: "manual",
  rules: [],
  ruleLogic: "AND",
  image: null,
  seoTitle: "",
  seoDescription: "",
  status: "active",
  published: false,
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

export default function CollectionForm({ collectionId = null }) {
  const router = useRouter();

  // Form state (metadata only — no productIds here)
  const [form, setForm] = useState(EMPTY);

  // Product membership — tracked as pending deltas.
  // For a NEW collection: pendingAdds will be POSTed after creation.
  // For an EXISTING collection: pendingAdds and pendingRemoves apply on save.
  const [pendingAdds, setPendingAdds] = useState([]);
  const [pendingRemoves, setPendingRemoves] = useState([]);
  const [productCount, setProductCount] = useState(0);
  const [productsRefreshKey, setProductsRefreshKey] = useState(0);

  const [allCollections, setAllCollections] = useState([]);
  const [loading, setLoading] = useState(Boolean(collectionId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [discardProceed, setDiscardProceed] = useState(null);
  const readyRef = useRef(false);

  const { isDirty, markDirty, clearDirty, confirmDiscard, cancelDiscard } =
    useUnsavedChanges({
      onBlocked: (proceed) => {
        setDiscardProceed(() => proceed);
        setShowDiscardModal(true);
      },
    });

  const touch = () => {
    if (!readyRef.current) return;
    markDirty();
  };

  const update = (patch) => {
    touch();
    setForm((f) => ({ ...f, ...patch }));
  };

  // Load sibling collections for parent picker
  useEffect(() => {
    collectionsApi
      .list({ limit: 500 })
      .then((data) => setAllCollections(data.collections || []))
      .catch(() => setAllCollections([]));
  }, []);

  // Load existing collection metadata
  useEffect(() => {
    if (!collectionId) {
      readyRef.current = true;
      return;
    }
    let cancelled = false;
    collectionsApi
      .get(collectionId)
      .then((data) => {
        if (cancelled) return;
        const c = data.collection;
        setForm({
          ...EMPTY,
          ...c,
          parentCollectionId: c.parentCollectionId || null,
          image: c.image || null,
          rules: c.rules || [],
          ruleLogic: c.ruleLogic || "AND",
        });
        setProductCount(c.productCount ?? (c.productIds || []).length);
        readyRef.current = true;
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [collectionId]);

  // Valid parent candidates
  const validParents = useMemo(() => {
    if (!collectionId) return allCollections;
    const descendants = new Set();
    const collectDescendants = (parentId) => {
      for (const c of allCollections) {
        if (String(c.parentCollectionId) === String(parentId)) {
          descendants.add(String(c._id));
          collectDescendants(c._id);
        }
      }
    };
    collectDescendants(collectionId);
    descendants.add(String(collectionId));
    return allCollections.filter((c) => !descendants.has(String(c._id)));
  }, [allCollections, collectionId]);

  const parentPath = (c) => {
    const byId = new Map(allCollections.map((x) => [String(x._id), x]));
    const parts = [c.name];
    let p = c.parentCollectionId;
    let guard = 0;
    while (p && guard++ < 10) {
      const par = byId.get(String(p));
      if (!par) break;
      parts.unshift(par.name);
      p = par.parentCollectionId;
    }
    return parts.join(" / ");
  };

  // Product add/remove handlers
  const handleAddProduct = (productId) => {
    touch();
    // If this product was marked for removal, cancel the removal
    setPendingRemoves((prev) =>
      prev.filter((id) => String(id) !== String(productId)),
    );
    // If not already pending an add, queue it
    setPendingAdds((prev) => {
      if (prev.some((id) => String(id) === String(productId))) return prev;
      return [...prev, productId];
    });
  };

  const handleRemoveProduct = (productId) => {
    touch();
    // If it was a pending add, just cancel the add
    setPendingAdds((prev) =>
      prev.filter((id) => String(id) !== String(productId)),
    );
    // Otherwise mark for removal on save
    setPendingRemoves((prev) => {
      if (prev.some((id) => String(id) === String(productId))) return prev;
      return [...prev, productId];
    });
  };

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name,
        slug: form.slug || undefined,
        description: form.description,
        parentCollectionId: form.parentCollectionId || null,
        type: form.type,
        rules: form.type === "automatic" ? form.rules : [],
        ruleLogic: form.type === "automatic" ? form.ruleLogic : "AND",
        image: form.image || undefined,
        seoTitle: form.seoTitle,
        seoDescription: form.seoDescription,
        status: form.status,
        published: form.published,
      };

      let collection = null;

      if (collectionId) {
        const res = await collectionsApi.update(collectionId, payload);
        collection = res.collection;
      } else {
        // Create with initial products (if any) so the two-way sync runs on the server
        const createPayload = {
          ...payload,
          productIds: form.type === "manual" ? pendingAdds : [],
        };
        const res = await collectionsApi.create(createPayload);
        collection = res.collection;
      }

      // Apply deltas to an existing collection
      if (collectionId && form.type === "manual") {
        const ops = [];
        if (pendingAdds.length > 0) {
          ops.push(collectionsApi.addProducts(collectionId, pendingAdds));
        }
        if (pendingRemoves.length > 0) {
          ops.push(collectionsApi.removeProducts(collectionId, pendingRemoves));
        }
        await Promise.all(ops);
      }

      clearDirty();
      router.push("/dashboard/products/collections");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (isDirty) {
      setDiscardProceed(
        () => () => router.push("/dashboard/products/collections"),
      );
      setShowDiscardModal(true);
      return;
    }
    router.push("/dashboard/products/collections");
  };

  if (loading) return <div className="p-6 text-gray-500">Loading…</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">
          {collectionId ? "Edit collection" : "New collection"}
        </h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 border rounded-md text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving || !form.name.trim()}
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
        <div className="lg:col-span-2 space-y-6">
          <Section title="Details">
            <div className="space-y-4">
              <Field label="Name">
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => update({ name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                />
              </Field>
              <Field
                label="Slug"
                hint="Auto-generated from name. Edit to override."
              >
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => update({ slug: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md text-sm font-mono"
                />
              </Field>
              <Field label="Description">
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(e) => update({ description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                />
              </Field>
              <Field label="Type">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => update({ type: "manual" })}
                    className={`px-3 py-1.5 rounded text-sm ${
                      form.type === "manual"
                        ? "bg-black text-white"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    Manual
                  </button>
                  <button
                    type="button"
                    onClick={() => update({ type: "automatic" })}
                    className={`px-3 py-1.5 rounded text-sm ${
                      form.type === "automatic"
                        ? "bg-black text-white"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    Automatic
                  </button>
                </div>
              </Field>
            </div>
          </Section>

          {form.type === "manual" && (
            <Section
              title={`Products (${productCount + pendingAdds.length - pendingRemoves.length})`}
              action={
                (pendingAdds.length > 0 || pendingRemoves.length > 0) && (
                  <span className="text-xs text-amber-700">
                    {pendingAdds.length > 0 && `+${pendingAdds.length} to add`}
                    {pendingAdds.length > 0 && pendingRemoves.length > 0 && " · "}
                    {pendingRemoves.length > 0 &&
                      `-${pendingRemoves.length} to remove`}
                  </span>
                )
              }
            >
              <div className="space-y-4">
                <ProductPicker
                  excludeIds={[
                    ...(collectionId ? [] : []), // populated from list below? see note
                  ]}
                  onPick={handleAddProduct}
                />

                {collectionId && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase mb-2">
                      Products in this collection
                    </p>
                    <CollectionProductsList
                      collectionId={collectionId}
                      refreshKey={productsRefreshKey}
                      onRemove={handleRemoveProduct}
                    />
                  </div>
                )}

                {pendingAdds.length > 0 && (
                  <div className="rounded border border-blue-200 bg-blue-50 p-3 text-xs">
                    <p className="font-medium text-blue-900 mb-1">
                      Pending additions ({pendingAdds.length})
                    </p>
                    <p className="text-blue-700">
                      These will be added when you save.
                    </p>
                  </div>
                )}
              </div>
            </Section>
          )}

          {form.type === "automatic" && (
            <>
              <Section title="Rules">
                <RuleBuilder
                  rules={form.rules}
                  logic={form.ruleLogic}
                  onChange={({ rules, logic }) =>
                    update({ rules, ruleLogic: logic })
                  }
                />
              </Section>

              {collectionId && (
                <Section title={`Matched products (${productCount})`}>
                  <CollectionProductsList collectionId={collectionId} />
                </Section>
              )}
            </>
          )}

          <Section title="SEO">
            <div className="space-y-4">
              <Field label="SEO title">
                <input
                  type="text"
                  value={form.seoTitle}
                  onChange={(e) => update({ seoTitle: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                />
              </Field>
              <Field label="SEO description">
                <textarea
                  rows={3}
                  value={form.seoDescription}
                  onChange={(e) => update({ seoDescription: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                />
              </Field>
            </div>
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Image">
            <SingleImageUploader
              value={form.image}
              onChange={(img) => update({ image: img })}
            />
          </Section>

          <Section title="Organization">
            <div className="space-y-4">
              <Field label="Parent collection">
                <select
                  value={form.parentCollectionId || ""}
                  onChange={(e) =>
                    update({ parentCollectionId: e.target.value || null })
                  }
                  className="w-full px-3 py-2 border rounded-md text-sm"
                >
                  <option value="">None (root)</option>
                  {validParents.map((c) => (
                    <option key={c._id} value={c._id}>
                      {parentPath(c)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Status">
                <select
                  value={form.status}
                  onChange={(e) => update({ status: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                >
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </Field>

              <Field label="Published">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.published}
                    onChange={(e) => update({ published: e.target.checked })}
                  />
                  Visible on storefront
                </label>
              </Field>
            </div>
          </Section>
        </div>
      </div>

      {showDiscardModal && (
        <DiscardChangesModal
          onConfirm={() => {
            setShowDiscardModal(false);
            const action = discardProceed;
            setDiscardProceed(null);
            confirmDiscard(action);
          }}
          onCancel={() => {
            setShowDiscardModal(false);
            setDiscardProceed(null);
            cancelDiscard();
          }}
        />
      )}
    </div>
  );
}