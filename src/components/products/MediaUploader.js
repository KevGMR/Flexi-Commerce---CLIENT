"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { productImagesApi } from "@/lib/api-client";

const MAX_BYTES = 20 * 1024 * 1024;
const MAX_CONCURRENT = 3;
const ACCEPTED_EXTS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
const ACCEPT_STRING = "image/jpeg,image/png,image/webp,image/gif";

const MIME_BY_EXT = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

function extOf(name) {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i).toLowerCase();
}

function humanBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function uploadOne(file, onProgress) {
  const ext = extOf(file.name);
  const mimeType = MIME_BY_EXT[ext] || file.type || "application/octet-stream";

  onProgress("preparing");
  const staged = await productImagesApi.stagedUpload({
    filename: file.name,
    mimeType,
    fileSize: file.size,
  });

  onProgress("uploading", 0);
  const form = new FormData();
  for (const p of staged.parameters) form.append(p.name, p.value);
  form.append("file", file, file.name);

  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", staged.url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress("uploading", Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed: ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("Upload failed: network error"));
    xhr.send(form);
  });

  onProgress("finalizing");
  const finalized = await productImagesApi.finalize({
    resourceUrl: staged.resourceUrl,
    alt: "",
  });

  onProgress("done", 100);
  return {
    url: finalized.url,
    alt: "",
    isDefault: false,
    shopifyFileId: finalized.shopifyFileId,
    width: finalized.width,
    height: finalized.height,
  };
}

export default function MediaUploader({
  images = [],
  variants = [],
  onChange,
  onClearVariantImages,
}) {
  const [queue, setQueue] = useState([]);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [dragImageIndex, setDragImageIndex] = useState(null);
  const [dragOverImageIndex, setDragOverImageIndex] = useState(null);
  const [confirmRemoval, setConfirmRemoval] = useState(null);
  // { idx, url, variants: [{ label, sku }] }
  const fileInputRef = useRef(null);
  const uploadedThisSession = useRef(new Set());
  const savedRef = useRef(false);

  const savedImagesRef = useRef(images);
  useEffect(() => {
    savedImagesRef.current = images;
  }, [images]);

  // Build a map: image URL → variants that reference it
  const referencedByVariants = useMemo(() => {
    const map = new Map(); // url -> [{ _id, label, sku }]
    for (const v of variants || []) {
      for (const img of v.images || []) {
        if (!img?.url) continue;
        if (!map.has(img.url)) map.set(img.url, []);
        map.get(img.url).push({
          _id: v._id || v._temp,
          label:
            (v.selectedOptions || [])
              .map((o) => o.value)
              .join(" / ") || "Default",
          sku: v.sku || "",
        });
      }
    }
    return map;
  }, [variants]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (savedRef.current) return;
      const orphaned = [...uploadedThisSession.current].filter(
        (fileId) =>
          !(savedImagesRef.current || []).some(
            (img) => img.shopifyFileId === fileId,
          ),
      );
      for (const fileId of orphaned) {
        productImagesApi.delete(fileId).catch((err) => {
          console.warn("[MediaUploader] orphan cleanup failed:", fileId, err);
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (uploadedThisSession.current.size === 0) return;
    const currentIds = new Set(
      (images || []).map((i) => i.shopifyFileId).filter(Boolean),
    );
    let anySurvived = false;
    for (const id of uploadedThisSession.current) {
      if (currentIds.has(id)) anySurvived = true;
    }
    if (anySurvived) savedRef.current = true;
  }, [images]);

  const enqueueFiles = useCallback((fileList) => {
    const accepted = [];
    const errors = [];

    for (const file of Array.from(fileList)) {
      const ext = extOf(file.name);
      if (!ACCEPTED_EXTS.includes(ext)) {
        errors.push(`${file.name}: unsupported type (${ext || "no extension"})`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        errors.push(
          `${file.name}: ${humanBytes(file.size)} exceeds the 20MB limit`,
        );
        continue;
      }
      accepted.push(file);
    }

    if (errors.length) {
      // eslint-disable-next-line no-alert
      alert("Some files were skipped:\n\n" + errors.join("\n"));
    }
    if (accepted.length === 0) return;

    const items = accepted.map((file) => ({
      id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      name: file.name,
      size: file.size,
      status: "queued",
      progress: 0,
      error: null,
    }));

    setQueue((q) => [...q, ...items]);
    runPool(items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runPool = useCallback(
    async (items) => {
      const queue = [...items];
      let active = 0;

      return new Promise((resolve) => {
        const kick = () => {
          while (active < MAX_CONCURRENT && queue.length) {
            const item = queue.shift();
            active++;

            (async () => {
              try {
                const record = await uploadOne(
                  item.file,
                  (status, progress = 0) => {
                    setQueue((q) =>
                      q.map((it) =>
                        it.id === item.id ? { ...it, status, progress } : it,
                      ),
                    );
                  },
                );

                uploadedThisSession.current.add(record.shopifyFileId);

                setQueue((q) =>
                  q.map((it) =>
                    it.id === item.id
                      ? { ...it, status: "done", progress: 100 }
                      : it,
                  ),
                );

                onChange((prev) => {
                  const next = [...(prev || []), record];
                  if (!next.some((i) => i.isDefault) && next.length > 0) {
                    next[0] = { ...next[0], isDefault: true };
                  }
                  return next;
                });

                setTimeout(() => {
                  setQueue((q) => q.filter((it) => it.id !== item.id));
                }, 400);
              } catch (err) {
                setQueue((q) =>
                  q.map((it) =>
                    it.id === item.id
                      ? { ...it, status: "error", error: err.message }
                      : it,
                  ),
                );
              } finally {
                active--;
                if (queue.length) kick();
                else if (active === 0) resolve();
              }
            })();
          }
          if (!queue.length && active === 0) resolve();
        };
        kick();
      });
    },
    [onChange],
  );

  // -------- image mutations --------

  const removeImage = (idx) => {
    const target = images[idx];
    if (!target) return;

    // Check if any variant references this image
    const refs = target.url ? referencedByVariants.get(target.url) : null;

    if (refs && refs.length > 0) {
      setConfirmRemoval({ idx, url: target.url, variants: refs });
      return;
    }

    performRemoval(idx);
  };

  const performRemoval = (idx, clearVariantRefs = false) => {
    const target = images[idx];

    onChange((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      if (target?.isDefault && next.length > 0) {
        next[0] = { ...next[0], isDefault: true };
      }
      return next;
    });

    if (clearVariantRefs && target?.url && onClearVariantImages) {
      onClearVariantImages([target.url]);
    }

    if (target?.shopifyFileId) {
      uploadedThisSession.current.delete(target.shopifyFileId);
      productImagesApi
        .delete(target.shopifyFileId)
        .catch((err) =>
          console.warn("[MediaUploader] delete failed:", err),
        );
    }
  };

  const setAlt = (idx, alt) => {
    onChange((prev) =>
      prev.map((img, i) => (i === idx ? { ...img, alt } : img)),
    );
  };

  const setAsDefault = (idx) => {
    onChange((prev) => {
      const next = [...prev];
      const [picked] = next.splice(idx, 1);
      next.unshift({ ...picked, isDefault: true });
      return next.map((img, i) => ({ ...img, isDefault: i === 0 }));
    });
  };

  const reorder = (from, to) => {
    if (from === to) return;
    onChange((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next.map((img, i) => ({ ...img, isDefault: i === 0 }));
    });
  };

  // -------- drag & drop --------

  const onFilesDrop = (e) => {
    e.preventDefault();
    setIsDraggingFiles(false);
    if (e.dataTransfer?.files?.length) {
      enqueueFiles(e.dataTransfer.files);
    }
  };

  const onFileInput = (e) => {
    if (e.target.files?.length) enqueueFiles(e.target.files);
    e.target.value = "";
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDraggingFiles(true);
        }}
        onDragLeave={() => setIsDraggingFiles(false)}
        onDrop={onFilesDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition ${
          isDraggingFiles
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 hover:border-gray-400"
        }`}
      >
        <p className="text-sm font-medium text-gray-700">
          Drop images here or click to select
        </p>
        <p className="text-xs text-gray-500 mt-1">
          JPG, PNG, WEBP, GIF · max 20MB each
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPT_STRING}
          onChange={onFileInput}
          className="hidden"
        />
      </div>

      {queue.length > 0 && (
        <div className="space-y-2">
          {queue.map((item) => (
            <div
              key={item.id}
              className={`flex items-center gap-3 text-sm px-3 py-2 rounded border ${
                item.status === "error"
                  ? "border-red-300 bg-red-50"
                  : "border-gray-200 bg-gray-50"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium text-gray-800">
                  {item.name}
                </div>
                <div className="text-xs text-gray-500">
                  {item.status === "error"
                    ? item.error
                    : item.status === "uploading"
                      ? `Uploading ${item.progress}%`
                      : item.status === "finalizing"
                        ? "Finalizing…"
                        : item.status === "preparing"
                          ? "Preparing…"
                          : item.status === "done"
                            ? "Done"
                            : "Queued"}
                </div>
              </div>
              {item.status !== "error" && (
                <div className="w-32 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      item.status === "done" ? "bg-green-500" : "bg-blue-500"
                    }`}
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {images.map((img, idx) => {
            const refs = img.url
              ? referencedByVariants.get(img.url)
              : null;
            const refCount = refs?.length || 0;
            const isReferenced = refCount > 0;

            return (
              <div
                key={img.shopifyFileId || img.url || idx}
                draggable
                onDragStart={() => setDragImageIndex(idx)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverImageIndex(idx);
                }}
                onDragEnd={() => {
                  setDragImageIndex(null);
                  setDragOverImageIndex(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragImageIndex !== null) reorder(dragImageIndex, idx);
                  setDragImageIndex(null);
                  setDragOverImageIndex(null);
                }}
                className={`relative group border rounded-lg overflow-hidden bg-white ${
                  dragOverImageIndex === idx && dragImageIndex !== idx
                    ? "border-blue-500 ring-2 ring-blue-200"
                    : isReferenced
                      ? "border-amber-300"
                      : "border-gray-200"
                }`}
              >
                <div className="aspect-square bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={img.alt || ""}
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                </div>

                {img.isDefault && (
                  <div className="absolute top-2 left-2 px-2 py-0.5 text-[10px] font-semibold bg-blue-600 text-white rounded-full">
                    Default
                  </div>
                )}

                {isReferenced && (
                  <div
                    className="absolute top-2 left-2 px-2 py-0.5 text-[10px] font-semibold bg-amber-500 text-white rounded-full"
                    title={
                      refs.map((r) => r.label).join(", ")
                    }
                  >
                    Used by {refCount} variant{refCount === 1 ? "" : "s"}
                  </div>
                )}

                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  {!img.isDefault && (
                    <button
                      type="button"
                      onClick={() => setAsDefault(idx)}
                      title="Set as default"
                      className="bg-white rounded-full w-7 h-7 flex items-center justify-center shadow text-xs hover:bg-gray-50"
                    >
                      ★
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    title={
                      isReferenced
                        ? "This image is used by variants"
                        : "Remove"
                    }
                    className="bg-white rounded-full w-7 h-7 flex items-center justify-center shadow text-xs hover:bg-red-50 text-red-600"
                  >
                    ×
                  </button>
                </div>

                <div className="p-2">
                  <input
                    type="text"
                    value={img.alt || ""}
                    onChange={(e) => setAlt(idx, e.target.value)}
                    placeholder="Alt text"
                    className="w-full px-2 py-1 text-xs border border-gray-200 rounded"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation modal for referenced images */}
      {confirmRemoval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Image is in use
            </h2>
            <p className="text-sm text-gray-600 mb-3">
              This image is assigned to{" "}
              <strong>
                {confirmRemoval.variants.length} variant
                {confirmRemoval.variants.length === 1 ? "" : "s"}
              </strong>
              :
            </p>
            <ul className="text-sm text-gray-700 mb-4 max-h-32 overflow-auto rounded bg-gray-50 p-3 space-y-1">
              {confirmRemoval.variants.map((v) => (
                <li key={v._id} className="flex justify-between gap-2">
                  <span>{v.label}</span>
                  {v.sku && (
                    <span className="font-mono text-xs text-gray-500">
                      {v.sku}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <p className="text-sm text-gray-600 mb-5">
              Removing it will clear the image from those variants. They'll
              fall back to the product's default image in the POS.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmRemoval(null)}
                className="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const { idx } = confirmRemoval;
                  setConfirmRemoval(null);
                  performRemoval(idx, true);
                }}
                className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 text-sm font-medium"
              >
                Clear from variants & remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}