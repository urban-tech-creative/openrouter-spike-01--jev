export type Vec = { x: number; y: number };

export type Enemy = { id: number; pos: Vec; health: number };

export type World = {
  player: { pos: Vec; health: number };
  enemies: Enemy[];
  exit: Vec;
  status: "ready" | "running" | "escaped" | "dead";
  elapsedMs: number;
};
