export function getDeviceId() {
  if (typeof window === "undefined") return "web-dashboard-001";
  
  let deviceId = localStorage.getItem("flexi_device_id");
  
  if (!deviceId) {
    // Generate unique ID: timestamp + random
    deviceId = `web-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem("flexi_device_id", deviceId);
  }
  
  return deviceId;
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
