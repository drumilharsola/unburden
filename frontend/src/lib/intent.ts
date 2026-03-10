export type UserIntent = "speak" | "support";

export function parseIntent(value: string | null | undefined): UserIntent | null {
  return value === "speak" || value === "support" ? value : null;
}

export function withIntent(path: string, intent: UserIntent | null | undefined): string {
  if (!intent) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}intent=${encodeURIComponent(intent)}`;
}

export function intentLabel(intent: UserIntent | null | undefined): string {
  if (intent === "support") return "support someone";
  return "open up";
}

export function intentHeading(intent: UserIntent | null | undefined): string {
  if (intent === "support") return "Show up for someone.";
  return "Speak without holding back.";
}

export function intentBody(intent: UserIntent | null | undefined): string {
  if (intent === "support") {
    return "You will only be asked to listen, stay present, and help someone feel less alone.";
  }
  return "You will be matched with one steady person for a short anonymous conversation.";
}