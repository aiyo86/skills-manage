import { create } from "zustand";
import { invoke, isTauriRuntime } from "@/lib/tauri";
import { AgentWithStatus, BatchInstallResult, SkillWithLinks } from "@/types";

// ─── Web mode API helpers ──────────────────────────────────────────────────────

async function webGetAgents(): Promise<AgentWithStatus[]> {
  const res = await fetch("/api/agents");
  return res.json();
}

async function webGetCentralSkills(): Promise<SkillWithLinks[]> {
  const res = await fetch("/api/skills/codex");
  const raw = await res.json();
  // Map ScannedSkill[] → SkillWithLinks[] for the central view
  return (raw ?? []).map((s: any) => ({
    id: s.id,
    name: s.name,
    description: s.description ?? null,
    file_path: s.file_path,
    canonical_path: s.dir_path,
    is_central: true,
    source: s.link_type ?? "native",
    scanned_at: new Date().toISOString(),
    linked_agents: [], // link info not available in simple API
  }));
}

async function loadCentralSkillsAndAgents(): Promise<{
  skills: SkillWithLinks[];
  agents: AgentWithStatus[];
}> {
  if (isTauriRuntime()) {
    const [skills, agents] = await Promise.all([
      invoke<SkillWithLinks[]>("get_central_skills"),
      invoke<AgentWithStatus[]>("get_agents"),
    ]);
    return { skills: skills ?? [], agents: agents ?? [] };
  }
  // Web mode
  const [skills, agents] = await Promise.all([
    webGetCentralSkills(),
    webGetAgents(),
  ]);
  return { skills, agents };
}

// ─── State ────────────────────────────────────────────────────────────────────

interface CentralSkillsState {
  skills: SkillWithLinks[];
  agents: AgentWithStatus[];
  isLoading: boolean;
  isInstalling: boolean;
  /** Agent ID currently being toggled (null = idle). */
  togglingAgentId: string | null;
  error: string | null;

  // Actions
  loadCentralSkills: () => Promise<void>;
  installSkill: (
    skillId: string,
    agentIds: string[],
    method: string
  ) => Promise<BatchInstallResult>;
  togglePlatformLink: (skillId: string, agentId: string) => Promise<void>;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useCentralSkillsStore = create<CentralSkillsState>((set, get) => ({
  skills: [],
  agents: [],
  isLoading: false,
  isInstalling: false,
  togglingAgentId: null,
  error: null,

  /**
   * Load all Central Skills with per-platform link status, along with the
   * list of all registered agents. Called when navigating to /central.
   */
  loadCentralSkills: async () => {
    set({ isLoading: true, error: null });
    try {
      const { skills, agents } = await loadCentralSkillsAndAgents();
      set({ skills, agents, isLoading: false });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  /**
   * Install a skill to one or more agents. Refreshes the skill list after
   * a successful (or partial) install so link status icons update.
   */
  installSkill: async (skillId, agentIds, method) => {
    set({ isInstalling: true, error: null });
    try {
      const result = await invoke<BatchInstallResult>("batch_install_to_agents", {
        skillId,
        agentIds,
        method,
      });

      // Refresh central skills to get updated link status.
      const skills = await invoke<SkillWithLinks[]>("get_central_skills");
      set({ skills, isInstalling: false });

      return result;
    } catch (err) {
      set({ error: String(err), isInstalling: false });
      throw err;
    }
  },

  /**
   * Toggle a single platform link for a skill.
   * If linked, uninstalls; if not linked, installs via symlink.
   * Refreshes the skill list afterward so linked_agents updates.
   */
  togglePlatformLink: async (skillId, agentId) => {
    set({ togglingAgentId: agentId, error: null });
    try {
      const skill = get().skills.find((s) => s.id === skillId);
      const isLinked = skill?.linked_agents.includes(agentId) ?? false;

      if (isLinked) {
        await invoke("uninstall_skill_from_agent", { skillId, agentId });
      } else {
        await invoke("install_skill_to_agent", { skillId, agentId, method: "symlink" });
      }

      const skills = await invoke<SkillWithLinks[]>("get_central_skills");
      set({ skills, togglingAgentId: null });
    } catch (err) {
      set({ error: String(err), togglingAgentId: null });
      throw err;
    }
  },
}));
