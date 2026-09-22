/**
 * WorkflowProgress - Visual representation of delivery workflow status
 * Shows progression through custom category workflow steps
 */
export default function WorkflowProgress({ workflow, currentStatus }) {
  if (!workflow || workflow.length === 0) {
    return null;
  }

  const currentIndex = workflow.findIndex(
    (step) => step.status === currentStatus,
  );

  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        {workflow.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isPending = index > currentIndex;

          let stepColor = "bg-gray-300 text-gray-500";
          let lineColor = "bg-gray-300";

          if (isCompleted) {
            stepColor = "bg-green-500 text-white";
            lineColor = "bg-green-500";
          } else if (isCurrent) {
            // Use custom color from workflow if available
            const customColor = step.color || "#3B82F6";
            stepColor = `text-white`;
            lineColor = "bg-blue-500";
          }

          return (
            <div key={step.status} className="flex-1 flex items-center">
              {/* Step Circle */}
              <div className="flex flex-col items-center flex-shrink-0">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${stepColor} transition-all`}
                  style={
                    isCurrent && step.color
                      ? { backgroundColor: step.color }
                      : {}
                  }
                >
                  {isCompleted ? (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>
                <p
                  className={`mt-2 text-xs text-center max-w-[80px] ${
                    isCurrent ? "font-semibold text-gray-900" : "text-gray-600"
                  }`}
                >
                  {step.label || step.status.replace(/_/g, " ")}
                </p>
              </div>

              {/* Connecting Line */}
              {index < workflow.length - 1 && (
                <div className="flex-1 h-1 mx-2">
                  <div
                    className={`h-full ${lineColor} transition-all`}
                    style={{ width: isCompleted ? "100%" : "0%" }}
                  />
                  {!isCompleted && (
                    <div className="h-full bg-gray-300 -mt-1" />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile: Vertical layout for small screens */}
      <div className="md:hidden mt-4 space-y-3">
        {workflow.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <div
              key={step.status}
              className={`flex items-center p-3 rounded-lg ${
                isCurrent
                  ? "bg-blue-50 border-2 border-blue-500"
                  : isCompleted
                    ? "bg-green-50 border border-green-300"
                    : "bg-gray-50 border border-gray-200"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                  isCompleted
                    ? "bg-green-500 text-white"
                    : isCurrent
                      ? "text-white"
                      : "bg-gray-300 text-gray-500"
                }`}
                style={
                  isCurrent && step.color
                    ? { backgroundColor: step.color }
                    : {}
                }
              >
                {isCompleted ? "✓" : index + 1}
              </div>
              <p className="ml-3 font-medium text-sm">
                {step.label || step.status.replace(/_/g, " ")}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
