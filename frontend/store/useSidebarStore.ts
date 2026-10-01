"use client";

import { create } from "zustand";

export interface SidebarState {
  // Mobile drawer state
  isDrawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;

  // Desktop rail collapse state
  isCollapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  toggleCollapsed: () => void;

  // Collapsible dropdown sections state (sectionKey/title -> boolean)
  expandedSections: Record<string, boolean>;
  toggleSection: (key: string) => void;
  setSectionExpanded: (key: string, expanded: boolean) => void;
  expandAllSections: () => void;

  // Search filter query
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  clearSearch: () => void;

  // Workspace / Tenant dropdown open state
  isTenantMenuOpen: boolean;
  setTenantMenuOpen: (open: boolean) => void;
  toggleTenantMenu: () => void;
}

export const useSidebarStore = create<SidebarState>((set) => ({
  isDrawerOpen: false,
  setDrawerOpen: (open) => set({ isDrawerOpen: open }),
  openDrawer: () => set({ isDrawerOpen: true }),
  closeDrawer: () => set({ isDrawerOpen: false }),
  toggleDrawer: () => set((state) => ({ isDrawerOpen: !state.isDrawerOpen })),

  isCollapsed: false,
  setCollapsed: (collapsed) => set({ isCollapsed: collapsed }),
  toggleCollapsed: () => set((state) => ({ isCollapsed: !state.isCollapsed })),

  expandedSections: {},
  toggleSection: (key) =>
    set((state) => {
      // Default to true if key not tracked yet
      const current = state.expandedSections[key] !== false;
      return {
        expandedSections: {
          ...state.expandedSections,
          [key]: !current,
        },
      };
    }),
  setSectionExpanded: (key, expanded) =>
    set((state) => ({
      expandedSections: {
        ...state.expandedSections,
        [key]: expanded,
      },
    })),
  expandAllSections: () =>
    set(() => ({
      expandedSections: {},
    })),

  searchQuery: "",
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  clearSearch: () => set({ searchQuery: "" }),

  isTenantMenuOpen: false,
  setTenantMenuOpen: (open) => set({ isTenantMenuOpen: open }),
  toggleTenantMenu: () => set((state) => ({ isTenantMenuOpen: !state.isTenantMenuOpen })),
}));
