"use client";

/**
 * Application Top Bar
 *
 * 56px white bar with a hairline bottom border.
 * Left: breadcrumb trail. Right: notifications, email (mono), Sign Out.
 */

import { useSession } from "next-auth/react";
import { Bell } from "lucide-react";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { Button } from "@/components/ui/button";
import { AppBreadcrumb, type BreadcrumbItem } from "./AppBreadcrumb";

interface AppTopBarProps {
  breadcrumbs?: BreadcrumbItem[];
}

export function AppTopBar({ breadcrumbs = [] }: AppTopBarProps) {
  const { data: session } = useSession();

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center border-b border-border bg-card px-7">
      {/* Left: breadcrumbs */}
      <AppBreadcrumb items={breadcrumbs} />

      {/* Right side actions */}
      <div className="ml-auto flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground/70 hover:text-foreground"
        >
          <Bell className="h-[17px] w-[17px]" />
        </Button>

        {session?.user && (
          <div className="flex items-center gap-4">
            <span className="hidden font-mono text-[12.5px] tracking-[-0.01em] text-muted-foreground sm:inline">
              {session.user.email}
            </span>
            <SignOutButton />
          </div>
        )}
      </div>
    </header>
  );
}
