/**
 * NoteGenius – Utility to generate UUIDs locally (offline-safe).
 * Uses expo-crypto for cryptographically secure random bytes.
 */
import * as Crypto from "expo-crypto";

export function generateId(): string {
  return Crypto.randomUUID();
}
