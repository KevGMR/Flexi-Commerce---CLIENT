"use client";

import { create } from "zustand";
import {
  clearClientPersistence,
  clearSessionStorage,
  loadSessionFromStorage,
  saveSessionToStorage,
} from "@/lib/storage";
import { getDeviceId, getDeviceName } from "@/lib/device";
import { apiFetch } from "@/lib/api-client";

const createDefaults = ({ persistDeviceId = true } = {}) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  organizations: [],
  activeOrganization: null,
  permissions: [],
  locations: [],
  locationsMeta: [],
  selectedLocationId: null,
  tempAuthCredentials: null,
  deviceId: getDeviceId({ persist: persistDeviceId }),
  deviceName: getDeviceName(),
  permissionsRefreshed: false, // NEW: flag to prevent repeated refreshes
});

function persistState(state) {
  saveSessionToStorage({
    accessToken: state.accessToken,
    refreshToken: state.refreshToken,
    user: state.user,
    organizations: state.organizations,
    activeOrganization: state.activeOrganization,
    permissions: state.permissions,
    locations: state.locations,
    locationsMeta: state.locationsMeta,
    selectedLocationId: state.selectedLocationId,
    deviceId: state.deviceId,
    deviceName: state.deviceName,
    permissionsRefreshed: state.permissionsRefreshed,
  });
}

export const useSessionStore = create((set, get) => ({
  ...createDefaults(),
  hydrated: false,
  hydrate() {
    if (get().hydrated) return;
    const stored = loadSessionFromStorage();
    if (stored) {
      set({ ...createDefaults(), ...stored, hydrated: true });
    } else {
      set({ ...createDefaults(), hydrated: true });
    }
  },
  setTokens({ accessToken, refreshToken }) {
    set((state) => {
      const next = { ...state, accessToken, refreshToken, permissionsRefreshed: false };
      persistState(next);
      return next;
    });
  },
  setUser(user) {
    set((state) => {
      const next = { ...state, user };
      persistState(next);
      return next;
    });
  },
  setOrganizations(organizations) {
    set((state) => {
      const next = { ...state, organizations };
      persistState(next);
      return next;
    });
  },
  setActiveOrganization(activeOrganization) {
    set((state) => {
      const next = { ...state, activeOrganization, permissionsRefreshed: false };
      persistState(next);
      return next;
    });
  },
  setPermissions(permissions) {
    set((state) => {
      const next = { ...state, permissions };
      persistState(next);
      return next;
    });
  },
  setLocations(locations) {
    set((state) => {
      const next = { ...state, locations };
      persistState(next);
      return next;
    });
  },
  setAuthTempCredentials(creds) {
    set((state) => ({
      ...state,
      tempAuthCredentials: creds,
    }));
  },
  setLocationsMeta(locationsMeta) {
    set((state) => {
      const next = { ...state, locationsMeta };
      persistState(next);
      return next;
    });
  },
  setSelectedLocationId(selectedLocationId) {
    set((state) => {
      const next = { ...state, selectedLocationId };
      persistState(next);
      return next;
    });
  },
  async clearSession() {
    set({ ...createDefaults({ persistDeviceId: false }), hydrated: true, permissionsRefreshed: false });

    try {
      clearSessionStorage();
      await clearClientPersistence();
    } catch (error) {
      console.warn("Failed to fully clear client persistence", error);
    }
  },
  can(permission) {
    return get().permissions.includes(permission);
  },

  // Refresh permissions from the server
  async refreshPermissions() {
    const state = get();
    if (!state.accessToken || !state.activeOrganization) {
      console.warn("Cannot refresh permissions: No access token or active organization");
      return;
    }

    // If already refreshed, skip (but only if we have permissions)
    if (state.permissionsRefreshed && state.permissions.length > 0) {
      console.log("Permissions already refreshed, skipping");
      return;
    }

    try {
      const response = await apiFetch(`/organizations/${state.activeOrganization._id}`);
      const orgData = response?.organization || response?.data?.organization;
      if (orgData) {
        set({
          permissions: orgData.permissions || [],
          locations: orgData.locations || [],
          activeOrganization: {
            ...state.activeOrganization,
            permissions: orgData.permissions,
            locations: orgData.locations,
          },
          permissionsRefreshed: true,
        });
        // Persist the updated state
        persistState(get());
        console.log("✅ Permissions refreshed successfully");
      } else {
        console.warn("No organization data returned from refresh");
      }
    } catch (error) {
      console.error("Failed to refresh permissions:", error);
    }
  },
}));

export function getSessionState() {
  return useSessionStore.getState();
}