"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import { useSessionStore } from "@/store/session";
import { SectionList } from "@/components/homepage-editor/section-list";
import { AddSectionModal } from "@/components/homepage-editor/add-section-modal";

export default function HomepageEditorPage() {
  const { activeOrganization, setActiveOrganization } = useSessionStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [sections, setSections] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!activeOrganization?._id) {
        setLoading(false);
        return;
      }
      try {
        const res = await apiFetch(
          `/organizations/${activeOrganization._id}`,
        );
        const org = res?.organization;
        const existing = org?.website?.homepage?.sections;
        setSections(Array.isArray(existing) ? existing : []);
      } catch (err) {
        setError(err?.message || "Failed to load homepage.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [activeOrganization?._id]);

  const updateSections = (next) => {
    setSections(next);
    setDirty(true);
  };

  const handleAdd = (section) => {
    updateSections([...sections, section]);
    setAddOpen(false);
  };

  const handleUpdate = (id, next) => {
    updateSections(sections.map((s) => (s.id === id ? next : s)));
  };

  const handleRemove = (id) => {
    updateSections(sections.filter((s) => s.id !== id));
  };

  const handleMove = (id, direction) => {
    const idx = sections.findIndex((s) => s.id === id);
    if (idx === -1) return;
    const target = direction === "up" ? idx - 1 : idx + 1;
    if (target < 0 || target >= sections.length) return;
    const next = [...sections];
    [next[idx], next[target]] = [next[target], next[idx]];
    updateSections(next);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setStatus("");
    try {
      const res = await apiFetch(
        `/organizations/${activeOrganization._id}`,
        {
          method: "PUT",
          body: {
            website: {
              homepage: { sections },
            },
          },
        },
      );
      const updated = res?.organization;
      if (updated) setActiveOrganization(updated);
      setDirty(false);
      setStatus("Homepage saved.");
      setTimeout(() => setStatus(""), 3000);
    } catch (err) {
      setError(err?.message || "Failed to save homepage.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/dashboard/settings/storefront"
              className="text-sm text-gray-500 hover:text-gray-900"
            >
              ← Storefront
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Homepage sections
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Build your homepage by adding, editing, and reordering sections.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            + Add section
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !dirty}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}
      {status && (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-4">
          <p className="text-sm text-green-800">{status}</p>
        </div>
      )}

      {sections.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-sm text-gray-500">
            No sections yet. Your storefront is using the default homepage.
          </p>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="mt-4 inline-block rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Add your first section
          </button>
        </div>
      ) : (
        <SectionList
          sections={sections}
          orgId={activeOrganization._id}
          onUpdate={handleUpdate}
          onRemove={handleRemove}
          onMove={handleMove}
        />
      )}

      {addOpen && (
        <AddSectionModal
          onClose={() => setAddOpen(false)}
          onSelect={handleAdd}
        />
      )}
    </div>
  );
}