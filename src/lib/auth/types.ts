/** Identity shapes shared by server auth code and client components. */

/** The authenticated user, without anything sensitive. */
export interface SessionUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

/** The small subset the dashboard shell needs. Safe to cross the server/client boundary. */
export interface ShellUser {
  name: string;
  firstName: string;
  initial: string;
}

export function toShellUser(user: Pick<SessionUser, "name" | "email">): ShellUser {
  const name = user.name.trim() || user.email.split("@")[0] || "Account";
  const firstName = name.split(/\s+/)[0] || name;
  return { name, firstName, initial: (firstName[0] || "A").toUpperCase() };
}
