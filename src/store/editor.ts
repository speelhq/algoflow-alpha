// Editor-side UI state of a page: the panel tab, the selected node, whether its editor is
// open and the slot a click on it chose, the node outlined from a hovered Python line,
// whether the canvas shows the solution, and the diagnostic Run or Submit led to.
import { create } from "zustand";
import type { Diagnostic, NodeId } from "@/lang/types";

export type PanelTab = "problem" | "result" | "python";

/** The panel's tabs, in order: `Problem` only on a page with a challenge. */
export function tabsOf(challenge: boolean): readonly [PanelTab, ...PanelTab[]] {
  return challenge ? ["problem", "result", "python"] : ["result", "python"];
}

export type EditorState = {
  tab: PanelTab;
  selectedId: NodeId | null;
  /** The slot the editor opens focused on: the one clicked on the node. */
  slot: string | null;
  /** The input still to fill clicked on the node, inside that slot. */
  hole: NodeId | null;
  /** The selected node's editor is open; a press outside it closes it and keeps the selection. */
  editing: boolean;
  hoveredId: NodeId | null;
  solution: boolean;
  /** Shown beside its node until the selection changes. */
  diagnostic: Diagnostic | null;
  setTab: (tab: PanelTab) => void;
  /** Selects a node and opens its editor, on `slot` (and `hole`) when clicked; `edit: false` only selects. */
  select: (id: NodeId | null, slot?: string, edit?: boolean, hole?: NodeId) => void;
  closeEditor: () => void;
  setHovered: (id: NodeId | null) => void;
  showSolution: (shown: boolean) => void;
  /** Selects `owner`, the statement holding the diagnostic, and shows its message. */
  lead: (owner: NodeId, diagnostic: Diagnostic) => void;
  /** A page opens on its first tab, with nothing selected and its own chart shown. */
  open: (tab: PanelTab) => void;
};

export const useEditor = create<EditorState>()((set) => ({
  tab: "problem",
  selectedId: null,
  slot: null,
  hole: null,
  editing: false,
  hoveredId: null,
  solution: false,
  diagnostic: null,
  setTab: (tab) => set({ tab }),
  select: (id, slot, edit = true, hole) =>
    set({
      selectedId: id,
      slot: slot ?? null,
      hole: hole ?? null,
      editing: id !== null && edit,
      diagnostic: null,
    }),
  closeEditor: () => set({ editing: false }),
  setHovered: (id) => set({ hoveredId: id }),
  showSolution: (shown) => set({ solution: shown }),
  lead: (owner, diagnostic) =>
    set({ selectedId: owner, slot: null, hole: null, editing: true, diagnostic, solution: false }),
  open: (tab) =>
    set({
      tab,
      selectedId: null,
      slot: null,
      hole: null,
      editing: false,
      hoveredId: null,
      solution: false,
      diagnostic: null,
    }),
}));
