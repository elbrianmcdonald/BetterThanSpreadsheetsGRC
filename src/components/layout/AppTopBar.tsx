"use client";

/**
 * Application Top Bar
 *
 * Minimal top bar with sign out functionality.
 * Works alongside the sidebar navigation.
 */

import { useSession } from "next-auth/react";
import { Bell } from "lucide-react";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { Button } from "@/components/ui/button";

export function AppTopBar() {
  const { data: session } = useSession();

  return (
    <header className="h-14 bg-white border-b flex items-center justify-end px-6">
      {/* Right side actions */}
      <div className="flex items-center gap-4">
        {/* Notifications placeholder */}
        <Button variant="ghost" size="icon" className="text-gray-500 hover:text-gray-700">
          <Bell className="h-5 w-5" />
        </Button>

        {/* User info and sign out */}
        {session?.user && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 hidden sm:inline">
              {session.user.email}
            </span>
            <SignOutButton />
          </div>
        )}
      </div>
    </header>
  );
}
