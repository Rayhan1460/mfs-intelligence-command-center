import type { ReactNode } from "react";

import { AppShell } from "@/components/ui";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
