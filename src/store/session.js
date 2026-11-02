// client/src/store/session.js
"use client";

import { create } from "zustand";
import {
  clearClientPersistence,
  clearSessionStorage,
  loadSessionFromStorage,
  saveSessionToStorage,
} from "@/lib/storage";
import { getDeviceId, getDeviceName } from "@/lib/device";


// Module-level guard. True from the moment logout starts until a hard
// page navigation. While true, no action may write to localStorage —
// this prevents a late-resolving refreshPermissions()/setTokens() from
// resurrecting a session that has just been cleared.
let isLoggingOut = false;

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
  permissionsRefreshed: false,
});

function persistState(state) {
  if (isLoggingOut) return;
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

  // tempAuthCredentials are NEVER persisted — they contain the plaintext
  // password during the two-step login. Keeping them in memory only.
  setAuthTempCredentials(creds) {
    set((state) => ({ ...state, tempAuthCredentials: creds }));
  },

  // Called when the user clicks "Switch Organization". Clears org-scoped
  // state so the next page cannot act on the old org while the new one is
  // being selected.
  resetOrgData() {
    set((state) => {
      const next = {
        ...state,
        activeOrganization: null,
        permissions: [],
        locations: [],
        locationsMeta: [],
        selectedLocationId: null,
        permissionsRefreshed: false,
      };
      persistState(next);
      return next;
    });
  },

  async clearSession() {
    isLoggingOut = true;
    try {
      set({
        ...createDefaults({ persistDeviceId: false }),
        hydrated: true,
        permissionsRefreshed: false,
      });
      clearSessionStorage();
      await clearClientPersistence();
    } catch (error) {
      console.warn("Failed to fully clear client persistence", error);
    }
  },

  can(permission) {
    return get().permissions.includes(permission);
  },

  async refreshPermissions() {
    const state = get();
    if (isLoggingOut) return;
    if (!state.accessToken || !state.activeOrganization) {
      console.warn("Cannot refresh permissions: No access token or active organization");
      return;
    }

    if (state.permissionsRefreshed && state.permissions.length > 0) {
      return;
    }

    try {
      const { apiFetch } = await import("@/lib/api-client");

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
        persistState(get());
      }
    } catch (error) {
      console.error("Failed to refresh permissions:", error);
    }
  },
}));

export function getSessionState() {
  return useSessionStore.getState();
}

// Exported so logout.js / api-client.js can gate on it without a circular import
export function isLoggingOutNow() {
  return isLoggingOut;
} 