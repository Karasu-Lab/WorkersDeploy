export type JsonObject = Record<string, unknown>;

export function isRecord(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function asRecord(value: unknown): JsonObject {
  return isRecord(value) ? value : {};
}

export function parseObject(text: string, label: string): JsonObject {
  const value: unknown = JSON.parse(text);
  if (!isRecord(value)) {
    throw new Error(`${label} must be a JSON object`);
  }
  return value;
}

export function stringValues(object: JsonObject): Record<string, string> {
  return Object.fromEntries(Object.entries(object).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
}
