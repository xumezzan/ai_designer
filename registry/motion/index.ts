import type { MotionId } from "../keys";

export const motions: Partial<Record<MotionId, { entrance: boolean }>> = {
  still: { entrance: false },
  unfold: { entrance: true },
  drift: { entrance: true },
};

export function getMotion(id: MotionId) { return motions[id]; }
