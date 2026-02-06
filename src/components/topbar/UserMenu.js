"use client";

import { useRouter } from "next/navigation";
import { switchOrganization } from "@/lib/orgs";
import { Dropdown } from "@/components/ui/Dropdown";
import { Avatar, OrgAvatar } from "@/components/ui/Avatar";
import { ChevronDown, LogOut } from "@/components/icons/Icon";

export function UserMenu({
  user,
  activeOrganization,
  organizations,
  onOrgChange,
  onLogout,
}) {
  const router = useRouter();

  const handleOrgSwitch = async (orgId) => {
    try {
      const res = await switchOrganization(orgId);
      if (res?.organization) {
        onOrgChange?.(res.organization);
      }
    } catch (err) {
      console.error("Failed to switch organization:", err);
    }
  };

  const trigger = (
    <button className="flex items-center gap-2 hover:bg-zinc-50 rounded-md px-2 py-1 transition-colors">
      <Avatar user={user} size="sm" />
      <span className="text-sm font-medium text-zinc-700 hidden sm:inline max-w-[150px] truncate">
        {user?.fullname || user?.email}
      </span>
      <ChevronDown className="w-4 h-4 text-zinc-600" />
    </button>
  );

  return (
    <Dropdown trigger={trigger} align="right">
      <div className="p-4 space-y-3 w-72">
        {/* Organization Section */}
        {activeOrganization && (
          <div className="border-b border-zinc-200 pb-3">
            <div className="text-xs font-semibold uppercase text-zinc-500 mb-2">
              Current Organization
            </div>
            <div className="flex items-center gap-2 p-2 rounded-md bg-zinc-50">
              <OrgAvatar org={activeOrganization} size="sm" />
              <div className="flex-1">
                <div className="text-sm font-medium text-zinc-900">
                  {activeOrganization.name}
                </div>
              </div>
            </div>

            {organizations && organizations.length > 1 && (
              <div className="mt-3">
                <div className="text-xs font-semibold uppercase text-zinc-500 mb-2">
                  Switch to
                </div>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {organizations
                    .filter((org) => {
                      const orgId = org._id || org.organizationId || org.id;
                      const activeId =
                        activeOrganization._id ||
                        activeOrganization.organizationId ||
                        activeOrganization.id;
                      return orgId !== activeId;
                    })
                    .map((org) => (
                      <button
                        key={org._id || org.organizationId || org.id}
                        onClick={() =>
                          handleOrgSwitch(
                            org._id || org.organizationId || org.id,
                          )
                        }
                        className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-zinc-100 text-left"
                      >
                        <OrgAvatar org={org} size="sm" />
                        <div className="flex-1">
                          <div className="text-sm text-zinc-700">
                            {org.name}
                          </div>
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            )}

            <button
              onClick={() => router.push("/auth/select-organization")}
              className="w-full text-left text-sm text-blue-600 hover:text-blue-700 font-medium py-2 px-2 rounded-md hover:bg-blue-50 mt-2"
            >
              Manage Organizations
            </button>
          </div>
        )}

        {/* User Section */}
        <div className="border-b border-zinc-200 pb-3">
          <div className="text-xs font-semibold uppercase text-zinc-500 mb-2">
            Account
          </div>
          <div className="flex items-center gap-2 p-2 rounded-md hover:bg-zinc-50">
            <Avatar user={user} size="md" />
            <div className="flex-1">
              <div className="text-sm font-medium text-zinc-900">
                {user?.fullname || "User"}
              </div>
              <div className="text-xs text-zinc-500">{user?.email}</div>
            </div>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={() => {
            onLogout?.();
            router.push("/auth/login");
          }}
          className="w-full flex items-center gap-2 text-sm text-red-600 hover:text-red-700 font-medium py-2 px-2 rounded-md hover:bg-red-50"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </Dropdown>
  );
}
