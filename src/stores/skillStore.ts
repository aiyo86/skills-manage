import { create } from "zustand";
import { invoke, isTauriRuntime } from "@/lib/tauri";
import { ScannedSkill } from "@/types";

// ─── Web mode API helper ───────────────────────────────────────────────────────

async function webGetSkillsByAgent(agentId: string): Promise<ScannedSkill[]> {
  const res = await fetch(`/api/skills/${agentId}`);
  return res.json();
}

// ─── State ────────────────────────────────────────────────────────────────────

interface SkillState {
  skillsByAgent: Record<string, ScannedSkill[]>;
  loadingByAgent: Record<string, boolean>;
  error: string | null;

  // Actions
  getSkillsByAgent: (agentId: string) => Promise<void>;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useSkillStore = create<SkillState>((set) => ({
  skillsByAgent: {},
  loadingByAgent: {},
  error: null,

  /**
   * Fetch skills for a specific agent.
   * In Tauri mode calls the backend command; in web mode calls the REST API.
   * Results are cached per agentId in skillsByAgent.
   */
  getSkillsByAgent: async (agentId: string) => {
    set((state) => ({
      loadingByAgent: { ...state.loadingByAgent, [agentId]: true },
      error: null,
    }));
    try {
      const skills = isTauriRuntime()
        ? await invoke<ScannedSkill[]>("get_skills_by_agent", { agentId })
        : await webGetSkillsByAgent(agentId);
      set((state) => ({
        skillsByAgent: { ...state.skillsByAgent, [agentId]: skills },
        loadingByAgent: { ...state.loadingByAgent, [agentId]: false },
      }));
    } catch (err) {
      set((state) => ({
        error: String(err),
        loadingByAgent: { ...state.loadingByAgent, [agentId]: false },
      }));
    }
  },
}));
