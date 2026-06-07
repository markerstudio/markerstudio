import { redirect } from "next/navigation";

// Login moved to /login (shared by admins and clients). Keep this path working.
export default function AdminLoginRedirect() {
  redirect("/login");
}
