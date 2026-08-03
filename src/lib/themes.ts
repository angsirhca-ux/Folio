import type { ThemeId } from "./types";

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  description: string;
  paper: string;
  ink: string;
  inkMuted: string;
  inkFaint: string;
  accent: string;
  accentSoft: string;
  border: string;
  shadow: string;
  sidebar: string;
  selection: string;
  cursor: string;
}

export const themes: Record<ThemeId, ThemeDefinition> = {
  classic: {
    id: "classic",
    name: "Classic Novel",
    description: "Warm ivory paper and dark ink",
    paper: "#F7F3EA",
    ink: "#2D2A26",
    inkMuted: "#6B645C",
    inkFaint: "#A39B90",
    accent: "#B08D57",
    accentSoft: "rgba(176, 141, 87, 0.12)",
    border: "rgba(45, 42, 38, 0.08)",
    shadow: "rgba(45, 42, 38, 0.06)",
    sidebar: "#F1EBE0",
    selection: "rgba(176, 141, 87, 0.22)",
    cursor: "#B08D57",
  },
  midnight: {
    id: "midnight",
    name: "Midnight Library",
    description: "Charcoal depths and warm gray text",
    paper: "#1A1917",
    ink: "#D4CFC6",
    inkMuted: "#9A948A",
    inkFaint: "#6A655E",
    accent: "#B08D57",
    accentSoft: "rgba(176, 141, 87, 0.14)",
    border: "rgba(212, 207, 198, 0.08)",
    shadow: "rgba(0, 0, 0, 0.35)",
    sidebar: "#141311",
    selection: "rgba(176, 141, 87, 0.28)",
    cursor: "#C4A46A",
  },
  parchment: {
    id: "parchment",
    name: "Parchment",
    description: "Aged paper and sepia ink",
    paper: "#EDE4D3",
    ink: "#3E3226",
    inkMuted: "#7A6A56",
    inkFaint: "#A8947C",
    accent: "#9A7340",
    accentSoft: "rgba(154, 115, 64, 0.14)",
    border: "rgba(62, 50, 38, 0.1)",
    shadow: "rgba(62, 50, 38, 0.08)",
    sidebar: "#E6DBCA",
    selection: "rgba(154, 115, 64, 0.24)",
    cursor: "#9A7340",
  },
};

export const themeList = Object.values(themes);
