"use client";

import { create } from "zustand";
import {
  clearClientPersistence,
  clearSessionStorage,
  loadSessionFromStorage,
  saveSessionToStorage,
} from "@/lib/storage";
import { getDeviceId, getDeviceName } from "@/lib/device";

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
      const next = { ...state, accessToken, refreshToken };
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
      const next = { ...state, activeOrganization };
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
    set({ ...createDefaults({ persistDeviceId: false }), hydrated: true });

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
}));

export function getSessionState() {
  return useSessionStore.getState();
}
