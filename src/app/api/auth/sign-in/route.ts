import { z } from "zod";
import { parseBody, route } from "@/lib/api";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { findUserByEmail } from "@/lib/auth/users";
import { ApiError } from "@/lib/errors";

const SignInSchema = z.object({
  email: z.string().trim().max(320).email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password").max(200),
});

/** Verifies credentials, creates a database session and sets the HttpOnly cookie. */
export const POST = route(
  async (req) => {
    const { email, password } = await parseBody(req, SignInSchema);

    const user = await findUserByEmail(email);
    const valid = user ? await verifyPassword(password, user.passwordHash) : false;
    if (!user || !valid) throw new ApiError(401, "invalid_credentials", "Invalid email or password");

    await createSession(user.id);
    return { user: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt } };
  },
  { auth: false },
);
