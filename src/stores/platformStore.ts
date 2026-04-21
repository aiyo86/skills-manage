import { create } from "zustand";
import { invoke, isTauriRuntime } from "@/lib/tauri";
import { AgentWithStatus, ScanResult } from "@/types";

// ─── Web mode API helpers ──────────────────────────────────────────────────────
// When running in browser (not Tauri), call the backend API via Vite proxy.

async function webGetAgents(): Promise<AgentWithStatus[]> {
  const res = await fetch("/api/agents");
  return res.json();
}

async function webScanAll(): Promise<ScanResult> {
  const res = await fetch("/api/scan", { method: "POST" });
  return res.json();
}

async function loadAgentsAndScan(): Promise<{
  agents: AgentWithStatus[];
  scanResult: ScanResult;
}> {
  if (isTauriRuntime()) {
    const [agents, scanResult] = await Promise.all([
      invoke<AgentWithStatus[]>("get_agents"),
      invoke<ScanResult>("scan_all_skills"),
    ]);
    return { agents, scanResult };
  }
  // Web mode — call backend API
  const [agents, scanResult] = await Promise.all([
    webGetAgents(),
    webScanAll(),
  ]);
  return { agents, scanResult };
}

// ─── State ────────────────────────────────────────────────────────────────────

interface PlatformState {
  agents: AgentWithStatus[];
  skillsByAgent: Record<string, number>;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;

  // Actions
  initialize: () => Promise<void>;
  rescan: () => Promise<void>;
  refreshCounts: () => Promise<void>;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const usePlatformStore = create<PlatformState>((set) => ({
  agents: [],
  skillsByAgent: {},
  isLoading: false,
  isRefreshing: false,
  error: null,

  /**
   * Initialize the store on app mount: load agents then trigger a full scan.
   * Called once from AppShell's useEffect.
   */
  initialize: async () => {
    set({ isLoading: true, error: null });
    try {
      const { agents, scanResult } = await loadAgentsAndScan();
      set({
        agents,
        skillsByAgent: scanResult.skills_by_agent,
        isLoading: false,
      });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  /**
   * Re-trigger a full scan and refresh agent list.
   * Called from manual refresh button.
   */
  rescan: async () => {
    set({ isLoading: true, error: null });
    try {
      const { agents, scanResult } = await loadAgentsAndScan();
      set({
        agents,
        skillsByAgent: scanResult.skills_by_agent,
        isLoading: false,
      });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  refreshCounts: async () => {
    set({ isRefreshing: true, error: null });
    try {
      const { agents, scanResult } = await loadAgentsAndScan();
      set((state) => ({
        agents,
        skillsByAgent: scanResult.skills_by_agent,
        isRefreshing: false,
        isLoading: state.isLoading,
      }));
    } catch (err) {
      set({ error: String(err), isRefreshing: false });
    }
  },
}));
