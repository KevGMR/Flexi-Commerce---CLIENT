"use client";

import { useRouter } from "next/navigation";
import { switchOrganization } from "@/lib/orgs";
import { Dropdown } from "@/components/ui/Dropdown";
import { OrgAvatar } from "@/components/ui/Avatar";
import { ChevronDown } from "@/components/icons/Icon";

export function OrgSwitcher({
  activeOrganization,
  organizations,
  onOrgChange,
}) {
  const router = useRouter();

  if (!activeOrganization) {
    return <div className="text-sm text-zinc-600">Select organization</div>;
  }

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
    <div className="flex items-center gap-2 hover:bg-zinc-50 rounded-md px-2 py-1 transition-colors cursor-pointer">
      <OrgAvatar org={activeOrganization} size="sm" />
      <span className="text-sm font-medium text-zinc-700">
        {activeOrganization.name}
      </span>
      <ChevronDown className="w-4 h-4 text-zinc-600" />
    </div>
  );

  return (
    <Dropdown trigger={trigger} align="left">
      <div className="p-4 space-y-3">
        {/* Current Organization */}
        <div className="border-b border-zinc-200 pb-3">
          <div className="text-xs font-semibold uppercase text-zinc-500 mb-2">
            Current Organization
          </div>
          <button className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-zinc-50">
            <OrgAvatar org={activeOrganization} size="sm" />
            <div className="flex-1 text-left">
              <div className="text-sm font-medium text-zinc-900">
                {activeOrganization.name}
              </div>
            </div>
          </button>
        </div>

        {/* Switch Organization */}
        <button
          onClick={() => router.push("/auth/select-organization")}
          className="w-full text-left text-sm text-blue-600 hover:text-blue-700 font-medium py-2 px-2 rounded-md hover:bg-blue-50"
        >
          Switch Organization
        </button>

        {/* Divider */}
        <div className="border-t border-zinc-200" />

        {/* Organization List */}
        {organizations.length > 0 && (
          <div>
            <div className="text-xs font-semibold uppercase text-zinc-500 mb-2">
              Your Organizations
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {organizations.map((org) => (
                <button
                  key={org._id || org.organizationId || org.id}
                  onClick={() =>
                    handleOrgSwitch(org._id || org.organizationId || org.id)
                  }
                  className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-zinc-50 text-left"
                >
                  <OrgAvatar org={org} size="sm" />
                  <div className="flex-1">
                    <div className="text-sm text-zinc-700">{org.name}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Dropdown>
  );
}
