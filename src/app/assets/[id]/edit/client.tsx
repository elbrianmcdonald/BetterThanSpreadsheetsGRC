"use client";

/**
 * Edit Asset Client Component
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
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Server } from "lucide-react";
import { AssetForm, type AssetFormValues } from "@/components/asset/AssetForm";

interface Props {
  assetId: string;
}

export function EditAssetClient({ assetId }: Props) {
  const router = useRouter();

  // Fetch existing asset
  const { data, isLoading, error } = api.asset.getById.useQuery({ id: assetId });

  const updateMutation = api.asset.update.useMutation({
    onSuccess: () => {
      toast.success("Asset updated successfully");
      router.push(`/assets/${assetId}`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (values: AssetFormValues) => {
    updateMutation.mutate({
      id: assetId,
      name: values.name,
      type: values.type,
      description: values.description ?? null,
      ownerId: values.ownerId ?? null,
      businessUnitId: values.businessUnitId ?? null,
      lossMinimum: values.lossMinimum ?? null,
      lossProbable: values.lossProbable ?? null,
      lossMaximum: values.lossMaximum ?? null,
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <Skeleton className="h-10 w-32 mb-6" />
        <Card className="max-w-2xl">
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <p className="text-red-500">
            {error?.message || "Asset not found"}
          </p>
          <Link href="/assets">
            <Button variant="link">Return to Assets</Button>
          </Link>
        </div>
      </div>
    );
  }

  const { asset, permissions } = data;

  // Permission check
  if (!permissions.canEdit) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <p className="text-red-500">
            You don't have permission to edit this asset.
          </p>
          <Link href={`/assets/${assetId}`}>
            <Button variant="link">Return to Asset</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      {/* Back Link */}
      <Link href={`/assets/${assetId}`}>
        <Button variant="ghost" size="sm" className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Asset
        </Button>
      </Link>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Edit Asset: {asset.name}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AssetForm
            mode="edit"
            defaultValues={{
              name: asset.name,
              type: asset.type,
              status: asset.status,
              description: asset.description || "",
              ownerId: asset.ownerId || "",
              businessUnitId: asset.businessUnitId || "",
              lossMinimum: asset.lossMinimum ? Number(asset.lossMinimum) : null,
              lossProbable: asset.lossProbable ? Number(asset.lossProbable) : null,
              lossMaximum: asset.lossMaximum ? Number(asset.lossMaximum) : null,
            }}
            onSubmit={handleSubmit}
            isSubmitting={updateMutation.isPending}
          />
        </CardContent>
      </Card>
    </div>
  );
}
