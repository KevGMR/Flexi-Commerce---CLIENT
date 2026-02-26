import Image from "next/image";

function getInitials(name) {
  if (!name) return "?";
  const parts = name.split(" ");
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function getColorFromString(str) {
  const colors = [
    "blue",
    "green",
    "purple",
    "pink",
    "indigo",
    "cyan",
    "teal",
    "orange",
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

const colorMap = {
  blue: "bg-blue-500",
  green: "bg-green-500",
  purple: "bg-purple-500",
  pink: "bg-pink-500",
  indigo: "bg-indigo-500",
  cyan: "bg-cyan-500",
  teal: "bg-teal-500",
  orange: "bg-orange-500",
};

export function Avatar({ user, size = "md", showName = false }) {
  const sizeClasses = {
    sm: "w-6 h-6 text-xs",
    md: "w-8 h-8 text-sm",
    lg: "w-10 h-10 text-base",
    xl: "w-12 h-12 text-lg",
  };

  const initials = getInitials(user?.fullname || user?.email);
  const color = getColorFromString(user?._id || "");
  const bgClass = colorMap[color];

  if (user?.avatarUrl) {
    return (
      <div
        className={`${sizeClasses[size]} relative rounded-full overflow-hidden`}
      >
        <Image
          src={user.avatarUrl}
          alt={user.fullname || "User avatar"}
          fill
          sizes="(max-width: 640px) 24px, (max-width: 1024px) 32px, 48px"
          className="object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} ${bgClass} rounded-full flex items-center justify-center text-white font-semibold`}
    >
      {initials}
    </div>
  );
}

export function OrgAvatar({ org, size = "md" }) {
  const sizeClasses = {
    sm: "w-6 h-6 text-xs",
    md: "w-8 h-8 text-sm",
    lg: "w-10 h-10 text-base",
    xl: "w-12 h-12 text-lg",
  };

  const initial = org?.name?.[0]?.toUpperCase() || "O";
  const color = getColorFromString(org?._id || org?.organizationId || "");
  const bgClass = colorMap[color];

  return (
    <div
      className={`${sizeClasses[size]} ${bgClass} rounded-full flex items-center justify-center text-white font-semibold`}
    >
      {initial}
    </div>
  );
}
