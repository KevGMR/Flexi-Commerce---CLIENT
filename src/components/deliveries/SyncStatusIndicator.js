/**
 * SyncStatusIndicator - Shows sync status for a single delivery
 * Displayed on delivery cards when in offline queue
 */
export default function SyncStatusIndicator({
  isSynced = false,
  isQueued = false,
  isError = false,
  errorMessage = null,
  retryCount = 0,
  maxRetries = 3,
  size = "sm",
}) {
  if (isSynced) {
    return null; // No indicator for synced items
  }

  const sizeClasses = {
    xs: "px-2 py-1 text-xs",
    sm: "px-2.5 py-1 text-xs",
    md: "px-3 py-1.5 text-sm",
  };

  if (isError && retryCount >= maxRetries) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 rounded-full border-2 border-red-200 bg-red-50 text-red-700 font-medium ${sizeClasses[size]}`}
        title={errorMessage || "Sync failed - max retries exceeded"}
      >
        <span className="block w-2 h-2 rounded-full bg-red-600"></span>
        <span>Sync Failed</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 rounded-full border-2 border-orange-200 bg-orange-50 text-orange-700 font-medium ${sizeClasses[size]}`}
        title={errorMessage || "Retrying sync"}
      >
        <span className="block w-2 h-2 rounded-full bg-orange-600 animate-pulse"></span>
        <span>Retrying</span>
      </div>
    );
  }

  if (isQueued) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 rounded-full border-2 border-amber-200 bg-amber-50 text-amber-700 font-medium ${sizeClasses[size]}`}
        title="Queued for sync when online"
      >
        <span className="block w-2 h-2 rounded-full bg-amber-600 animate-pulse"></span>
        <span>Offline</span>
      </div>
    );
  }

  return null;
}
