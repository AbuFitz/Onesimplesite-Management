import { ForgotForm } from "@/components/password-forms";
import { AuthShell } from "@/components/auth-shell";
export const metadata = { title: "Forgot password" };
export default function Forgot() {
  return <AuthShell title="Forgot your password?" intro="Enter your email and we'll send you a link to choose a new one."><ForgotForm /></AuthShell>;
}
