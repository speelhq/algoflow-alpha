// NodeId: 12 characters from the nanoid URL alphabet, generated without the
// nanoid package because src/lang imports no third-party code.

const ALPHABET = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";
const NODE_ID_LENGTH = 12;
const NODE_ID = /^[A-Za-z0-9_-]{12}$/;

export function newId(): string {
  const bytes = new Uint8Array(NODE_ID_LENGTH);
  crypto.getRandomValues(bytes);
  let id = "";
  for (const byte of bytes) id += ALPHABET[byte & 63];
  return id;
}

export function isNodeId(value: unknown): value is string {
  return typeof value === "string" && NODE_ID.test(value);
}
