export const SEEDS = [
  { type: "wheat", label: "Пшеница", emoji: "🌾", cost: 3 },
  { type: "carrot", label: "Морковь", emoji: "🥕", cost: 4 },
  { type: "sunflower", label: "Подсолнух", emoji: "🌻", cost: 5 },
  { type: "potato", label: "Картофель", emoji: "🥔", cost: 4 },
  { type: "clover", label: "Клевер", emoji: "🍀", cost: 2 },
] as const;

export const TREES = [
  { type: "apple", label: "Яблоня", emoji: "🍎", cost: 8 },
] as const;

export const ANIMALS = [
  {
    type: "cow",
    label: "Корова",
    emoji: "🐄",
    cost: 25,
    product: "milk",
    productLabel: "Молоко",
    productEmoji: "🥛",
    feedType: "clover",
    feedLabel: "Клевер",
    feedEmoji: "🍀",
    feedPerProduct: 3,
    maxPerPen: 3,
  },
  {
    type: "chicken",
    label: "Курица",
    emoji: "🐔",
    cost: 15,
    product: "eggs",
    productLabel: "Яйца",
    productEmoji: "🥚",
    feedType: "wheat",
    feedLabel: "Пшеница",
    feedEmoji: "🌾",
    feedPerProduct: 1,
    maxPerPen: 10,
  },
] as const;

export const PANTRY_ITEMS: Record<string, { label: string; emoji: string }> = {
  wheat: { label: "Пшеница", emoji: "🌾" },
  carrot: { label: "Морковь", emoji: "🥕" },
  sunflower: { label: "Подсолнух", emoji: "🌻" },
  potato: { label: "Картофель", emoji: "🥔" },
  clover: { label: "Клевер", emoji: "🍀" },
  apple: { label: "Яблоки", emoji: "🍎" },
  milk: { label: "Молоко", emoji: "🥛" },
  eggs: { label: "Яйца", emoji: "🥚" },
};

export const SELL_PRICES: Record<string, number> = {
  wheat: 2,
  carrot: 3,
  sunflower: 4,
  potato: 3,
  clover: 1,
  apple: 4,
  milk: 5,
  eggs: 3,
};

export const PLOT_COST = 10;
export const PEN_COST = 15;
export const TREE_COST = 12;
export const GROW_TIME_MS = 60 * 60 * 1000; // 1 hour
export const COLLECT_TIME_MS = 2 * 60 * 60 * 1000; // 2 hours

export function getTimeRemaining(startTime: string, durationMs: number): { ready: boolean; minutes: number } {
  const elapsed = Date.now() - new Date(startTime).getTime();
  if (elapsed >= durationMs) return { ready: true, minutes: 0 };
  return { ready: false, minutes: Math.ceil((durationMs - elapsed) / 60000) };
}
