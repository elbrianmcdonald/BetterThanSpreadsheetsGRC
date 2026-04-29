"use client";

/**
 * Create Asset Client Component
 *
 * Epic 14: Asset Registry & BIA Integration
 * Story 14.4: Create/Edit Asset Forms
 */

import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/trpc/react";
import { toast } from "react-hot-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Server } from "lucide-react";
import { AssetForm, type AssetFormValues } from "@/components/asset/AssetForm";

export function CreateAssetClient() {
  const router = useRouter();

  const createMutation = api.asset.create.useMutation({
    onSuccess: (asset) => {
      toast.success("Asset created successfully");
      router.push(`/assets/${asset.id}`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (values: AssetFormValues) => {
    createMutation.mutate({
      name: values.name,
      type: values.type,
      description: values.description || undefined,
      ownerId: values.ownerId || undefined,
      businessUnitId: values.businessUnitId || undefined,
      lossMinimum: values.lossMinimum ?? null,
      lossProbable: values.lossProbable ?? null,
      lossMaximum: values.lossMaximum ?? null,
    });
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      {/* Back Link */}
      <Link href="/assets">
        <Button variant="ghost" size="sm" className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Assets
        </Button>
      </Link>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Create New Asset
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AssetForm
            mode="create"
            onSubmit={handleSubmit}
            isSubmitting={createMutation.isPending}
          />
        </CardContent>
      </Card>
    </div>
  );
}
