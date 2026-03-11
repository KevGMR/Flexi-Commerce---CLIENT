export const DEVICE_STORAGE_KEY = "flexi_device_id";

export function getDeviceId({ persist = true } = {}) {
  if (typeof window === "undefined") return "web-dashboard-001";
  
  let deviceId = localStorage.getItem(DEVICE_STORAGE_KEY);
  
  if (!deviceId) {
    // Generate unique ID: timestamp + random
    deviceId = `web-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    if (persist) {
      localStorage.setItem(DEVICE_STORAGE_KEY, deviceId);
    }
  }
  
  return deviceId;
}

export function clearStoredDeviceId() {
  if (typeof window === "undefined") return;

  localStorage.removeItem(DEVICE_STORAGE_KEY);
}

export function getDeviceName() {
  if (typeof window === "undefined") return "Web Dashboard";
  
  const ua = navigator.userAgent;
  let browser = "Unknown Browser";
  let os = "Unknown OS";
  
  // Detect browser
  if (ua.includes("Chrome") && !ua.includes("Edg")) browser = "Chrome";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";
  else if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Edg")) browser = "Edge";
  
  // Detect OS
  if (ua.includes("Win")) os = "Windows";
  else if (ua.includes("Mac")) os = "macOS";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iOS")) os = "iOS";
  
  return `${browser} on ${os}`;
}
