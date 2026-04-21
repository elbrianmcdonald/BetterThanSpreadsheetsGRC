"use client";

import Link from "next/link";
import { Globe, Settings as SettingsIcon, ArrowRight } from "lucide-react";
import { AppLayout } from "@/components/layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface SettingCard {
  href: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SETTINGS: SettingCard[] = [
  {
    href: "/admin/settings/hostname",
    title: "Hostname & HTTPS",
    description:
      "Configure the public DNS name and TLS certificate (Let's Encrypt or bring-your-own).",
    icon: Globe,
  },
];

export function SettingsHubClient() {
  return (
    <AppLayout
      breadcrumbs={[{ label: "Administration" }, { label: "Settings" }]}
    >
      <div className="container max-w-4xl mx-auto py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <SettingsIcon className="h-6 w-6" />
            Deployment Settings
          </h1>
          <p className="text-muted-foreground mt-1">
            Configuration that applies to this deployment as a whole, not a
            single organization.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SETTINGS.map((s) => {
            const Icon = s.icon;
            return (
              <Link key={s.href} href={s.href} className="group">
                <Card className="h-full transition-colors hover:border-primary">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <Icon className="h-5 w-5" />
                        {s.title}
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{s.description}</CardDescription>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
