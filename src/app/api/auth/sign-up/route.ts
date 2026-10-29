import { z } from "zod";
import { json, parseBody, route } from "@/lib/api";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { createUser, findUserByEmail } from "@/lib/auth/users";
import { conflict } from "@/lib/errors";

const SignUpSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(120, "That name is too long"),
  email: z.string().trim().max(320, "That email is too long").email("Enter a valid email address"),
  password: z
    .string()
    .min(8, "Use at least 8 characters")
    .max(200, "That password is too long")
    .regex(/[A-Za-z]/, "Include at least one letter")
    .regex(/[0-9]/, "Include at least one number"),
});

/** Creates an account and signs the new user straight in. */
export const POST = route(
  async (req) => {
    const { name, email, password } = await parseBody(req, SignUpSchema);

    if (await findUserByEmail(email)) throw conflict("An account with that email already exists");

    const user = await createUser({ email, name, passwordHash: await hashPassword(password) });
    await createSession(user.id);
    return json({ user }, 201);
  },
  { auth: false },
);
