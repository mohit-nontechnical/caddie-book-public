/**
 * Shared auth token helper — usable in both Edge (middleware) and Node runtimes.
 * The token is the hex SHA-256 of `${passcode}:caddiebook`.
 */
export async function authToken(passcode: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${passcode}:caddiebook`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
