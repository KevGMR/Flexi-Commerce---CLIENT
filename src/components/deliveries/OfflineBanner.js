/**
 * OfflineBanner - Displays current online/offline status and sync information
 * Shows at the top of the page when offline or syncing
 */
export default function OfflineBanner({
  isOnline,
  isSyncing = false,
  pendingCount = 0,
  onRetrySync = null,
}) {
  if (isOnline && !isSyncing && pendingCount === 0) {
    return null;
  }

  return (
    <div className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            {!isOnline ? (
              <>
                <div className="flex-shrink-0">
                  <svg
                    className="w-5 h-5 text-red-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-red-600">
                    You're offline
                  </p>
                  <p className="text-xs text-red-500 mt-0.5">
                    {pendingCount > 0
                      ? `${pendingCount} deliveries waiting to sync when you're back online`
                      : "Reconnect to sync your changes"}
                  </p>
                </div>
              </>
            ) : isSyncing ? (
              <>
                <div className="flex-shrink-0">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-300 border-t-blue-600"></div>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-blue-600">
                    Syncing deliveries...
                  </p>
                  {pendingCount > 0 && (
                    <p className="text-xs text-blue-500 mt-0.5">
                      {pendingCount} deliveries syncing
                    </p>
                  )}
                </div>
              </>
            ) : pendingCount > 0 ? (
              <>
                <div className="flex-shrink-0">
                  <svg
                    className="w-5 h-5 text-amber-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-amber-600">
                    Pending sync
                  </p>
                  <p className="text-xs text-amber-500 mt-0.5">
                    {pendingCount} {pendingCount === 1 ? "delivery" : "deliveries"}{" "}
                    waiting to sync
                  </p>
                </div>
              </>
            ) : null}
          </div>

          {(pendingCount > 0 || !isOnline) && onRetrySync && (
            <button
              onClick={onRetrySync}
              disabled={!isOnline}
              className="text-sm font-medium text-blue-600 hover:text-blue-700 disabled:text-gray-400 disabled:cursor-not-allowed px-4 py-2 rounded-md hover:bg-blue-50 disabled:hover:bg-transparent transition-colors"
            >
              {isOnline ? "Sync Now" : "Waiting for connection"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
