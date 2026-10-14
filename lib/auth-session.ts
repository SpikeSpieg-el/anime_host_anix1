/** Bound logout even when the auth client is waiting on a lock or the network. */
export async function signOutLocalWithTimeout(
  auth: { signOut: (options: { scope: "local" }) => Promise<{ error?: unknown } | void> },
  timeoutMs = 8000,
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const result = await Promise.race([
      // No preliminary getSession(): signOut already acquires/reads the session.
      auth.signOut({ scope: "local" }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Sign out timed out")), timeoutMs)
      }),
    ])
    if (result?.error) throw result.error
  } finally {
    clearTimeout(timer)
  }
}
