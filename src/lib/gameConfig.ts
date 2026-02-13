export const SEEDS = [
  { type: "wheat", label: "Пшеница", emoji: "🌾", cost: 3 },
  { type: "carrot", label: "Морковь", emoji: "🥕", cost: 4 },
  { type: "sunflower", label: "Подсолнух", emoji: "🌻", cost: 5 },
  { type: "potato", label: "Картофель", emoji: "🥔", cost: 4 },
] as const;

export const ANIMALS = [
  { type: "cow", label: "Корова", emoji: "🐄", cost: 25, product: "milk", productLabel: "Молоко", productEmoji: "🥛" },
  { type: "chicken", label: "Курица", emoji: "🐔", cost: 15, product: "eggs", productLabel: "Яйца", productEmoji: "🥚" },
] as const;

export const PANTRY_ITEMS: Record<string, { label: string; emoji: string }> = {
  wheat: { label: "Пшеница", emoji: "🌾" },
  carrot: { label: "Морковь", emoji: "🥕" },
  sunflower: { label: "Подсолнух", emoji: "🌻" },
  potato: { label: "Картофель", emoji: "🥔" },
  milk: { label: "Молоко", emoji: "🥛" },
  eggs: { label: "Яйца", emoji: "🥚" },
};

export const PLOT_COST = 10;
export const PEN_COST = 15;
export const GROW_TIME_MS = 60 * 60 * 1000; // 1 hour
export const COLLECT_TIME_MS = 2 * 60 * 60 * 1000; // 2 hours

export function getTimeRemaining(startTime: string, durationMs: number): { ready: boolean; minutes: number } {
  const elapsed = Date.now() - new Date(startTime).getTime();
  if (elapsed >= durationMs) return { ready: true, minutes: 0 };
  return { ready: false, minutes: Math.ceil((durationMs - elapsed) / 60000) };
}
