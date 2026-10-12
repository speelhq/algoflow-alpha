// `NodeDef.category`: the block menu's groups, in this order.
export const CATEGORIES = ["basic", "control", "list", "function", "dict"] as const;

export type Category = (typeof CATEGORIES)[number];
