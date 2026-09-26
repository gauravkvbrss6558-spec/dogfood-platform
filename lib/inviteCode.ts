import crypto from "crypto";

// Generates something like "K7QX-9F2P" — easy to read aloud or type,
// without ambiguous characters like 0/O or 1/I.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateInviteCode(): string {
  const bytes = crypto.randomBytes(8);
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
    if (i === 3) code += "-";
  }
  return code;
}
