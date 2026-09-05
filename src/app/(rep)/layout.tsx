import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/auth";

export default async function RepLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <AppShell role={user.profile.role} fullName={user.profile.full_name}>
      {children}
    </AppShell>
  );
}
