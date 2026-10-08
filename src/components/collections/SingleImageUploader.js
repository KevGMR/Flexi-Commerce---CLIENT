"use client";

import { useRef, useState } from "react";
import { productImagesApi } from "@/lib/api-client";

const MAX_BYTES = 20 * 1024 * 1024;
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

/**
 * Single-image uploader using the same Shopify Files pipeline as MediaUploader.
 * Value shape: { url, alt, shopifyFileId }
 */
export default function SingleImageUploader({ value, onChange, label = "Image" }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  const pick = () => fileRef.current?.click();

  const handleFile = async (file) => {
    setError("");
    const ext = extOf(file.name);
    if (!ACCEPTED_EXTS.includes(ext)) {
      setError(`Unsupported file type ${ext || "(none)"}`);
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`${humanBytes(file.size)} exceeds the 20MB limit`);
      return;
    }

    const mimeType = MIME_BY_EXT[ext] || file.type || "application/octet-stream";
    setUploading(true);
    setProgress(0);

    try {
      const staged = await productImagesApi.stagedUpload({
        filename: file.name,
        mimeType,
        fileSize: file.size,
      });

      const form = new FormData();
      for (const p of staged.parameters) form.append(p.name, p.value);
      form.append("file", file, file.name);

      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", staged.url);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload failed: ${xhr.status}`));
        };
        xhr.onerror = () => reject(new Error("Upload failed: network error"));
        xhr.send(form);
      });

      const finalized = await productImagesApi.finalize({
        resourceUrl: staged.resourceUrl,
        alt: "",
      });

      onChange({
        url: finalized.url,
        alt: "",
        shopifyFileId: finalized.shopifyFileId,
      });
    } catch (err) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const clear = () => {
    onChange(null);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        {value?.url && (
          <button
            type="button"
            onClick={clear}
            className="text-xs text-red-600 hover:text-red-800"
          >
            Remove
          </button>
        )}
      </div>

      <div
        onClick={pick}
        className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-gray-400 transition"
      >
        {value?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value.url}
            alt={value.alt || ""}
            className="w-full aspect-video object-cover rounded"
          />
        ) : (
          <div className="aspect-video flex flex-col items-center justify-center text-gray-500">
            <p className="text-sm">Click to select an image</p>
            <p className="text-xs mt-1">JPG, PNG, WEBP, GIF · max 20MB</p>
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT_STRING}
          onChange={(e) => {
            if (e.target.files?.[0]) handleFile(e.target.files[0]);
            e.target.value = "";
          }}
          className="hidden"
        />
      </div>

      {uploading && (
        <div className="text-xs text-gray-600 flex items-center gap-2">
          <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span>Uploading {progress}%</span>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}

      {value?.url && (
        <input
          type="text"
          value={value.alt || ""}
          onChange={(e) => onChange({ ...value, alt: e.target.value })}
          placeholder="Alt text"
          className="w-full px-2 py-1 text-xs border border-gray-200 rounded"
        />
      )}
    </div>
  );
}