import { apiPost } from "./client";
import type { RegisterInput, User } from "./types";

export function registerUser(input: RegisterInput): Promise<User> {
  return apiPost<User>("/auth/register", input);
}
