"use client";

import { useState } from "react";
import { Dropdown } from "@/components/ui/Dropdown";
import { Bell, Check } from "@/components/icons/Icon";

// Mock notifications data
const mockNotifications = [
  {
    id: 1,
    title: "Sale Synced",
    message: "Your sale has been synced to the server",
    time: "2 mins ago",
    read: false,
  },
  {
    id: 2,
    title: "Inventory Updated",
    message: "Product inventory has been updated",
    time: "1 hour ago",
    read: false,
  },
  {
    id: 3,
    title: "Permission Changed",
    message: "Your account permissions were modified",
    time: "1 day ago",
    read: true,
  },
];

export function NotificationBell() {
  const [notifications, setNotifications] = useState(mockNotifications);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAsRead = (id) => {
    setNotifications((prev) =>
      prev.map((notif) =>
        notif.id === id ? { ...notif, read: true } : notif
      )
    );
  };

  const trigger = (
    <button className="relative flex items-center hover:bg-zinc-50 rounded-md px-2 py-1 transition-colors">
      <Bell className="w-5 h-5 text-zinc-600" />
      {unreadCount > 0 && (
        <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full" />
      )}
    </button>
  );

  return (
    <Dropdown trigger={trigger} align="right">
      <div className="w-80 max-h-96 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-zinc-200">
          <div className="text-sm font-semibold text-zinc-900">
            Notifications
          </div>
        </div>

        {/* Notifications List */}
        <div className="overflow-y-auto flex-1">
          {notifications.length > 0 ? (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className={`px-4 py-3 border-b border-zinc-100 hover:bg-zinc-50 transition-colors cursor-pointer ${
                  !notif.read ? "bg-blue-50" : ""
                }`}
                onClick={() => handleMarkAsRead(notif.id)}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-zinc-900">
                      {notif.title}
                    </div>
                    <div className="text-xs text-zinc-600 mt-1">
                      {notif.message}
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">
                      {notif.time}
                    </div>
                  </div>
                  {!notif.read && (
                    <div className="w-2.5 h-2.5 bg-blue-500 rounded-full mt-1 flex-shrink-0" />
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="px-4 py-6 text-center text-sm text-zinc-500">
              No notifications
            </div>
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="px-4 py-3 border-t border-zinc-200">
            <button className="w-full text-sm text-blue-600 hover:text-blue-700 font-medium">
              View All Notifications
            </button>
          </div>
        )}
      </div>
    </Dropdown>
  );
}
