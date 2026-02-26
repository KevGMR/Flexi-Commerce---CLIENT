export function sanitizeNextPath(nextParam, fallback = "/dashboard/home") {
  if (typeof nextParam !== "string" || !nextParam) {
    return fallback;
  }

  if (!nextParam.startsWith("/dashboard")) {
    return fallback;
  }

  if (nextParam.startsWith("//")) {
    return fallback;
  }

  return nextParam;
}

export function buildLoginRedirect(nextPath) {
  const safeNextPath = sanitizeNextPath(nextPath);
  return `/auth/login?next=${encodeURIComponent(safeNextPath)}`;
}
