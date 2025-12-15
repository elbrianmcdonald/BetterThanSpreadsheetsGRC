"use client";

import { useState } from "react";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function TestPage() {
  const [inputText, setInputText] = useState("World");

  // Test tRPC query with type safety
  const helloQuery = api.post.hello.useQuery(
    { text: inputText },
    { enabled: inputText.length > 0 }
  );

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-4xl font-bold mb-8">T3 Stack Test Page</h1>

      <div className="grid gap-6 max-w-2xl">
        {/* Test Card 1: tRPC Query Test */}
        <Card>
          <CardHeader>
            <CardTitle>tRPC Query Test</CardTitle>
            <CardDescription>
              Testing type-safe API calls with tRPC
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="test-input">Enter text:</Label>
              <Input
                id="test-input"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type something..."
              />
            </div>

            <div className="p-4 bg-muted rounded-md">
              <p className="font-semibold mb-2">Response from tRPC:</p>
              {helloQuery.isLoading && <p className="text-muted-foreground">Loading...</p>}
              {helloQuery.error && (
                <p className="text-destructive">Error: {helloQuery.error.message}</p>
              )}
              {helloQuery.data && (
                <p className="text-lg font-mono">{helloQuery.data.greeting}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Test Card 2: shadcn/ui Components Test */}
        <Card>
          <CardHeader>
            <CardTitle>shadcn/ui Components Test</CardTitle>
            <CardDescription>
              Testing UI component library integration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button variant="default">Default Button</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="destructive">Destructive</Button>
            </div>

            <div className="flex gap-2">
              <Button size="sm">Small</Button>
              <Button size="default">Default</Button>
              <Button size="lg">Large</Button>
            </div>
          </CardContent>
        </Card>

        {/* Test Card 3: Type Safety Verification */}
        <Card>
          <CardHeader>
            <CardTitle>Type Safety Verification</CardTitle>
            <CardDescription>
              Verifying end-to-end type safety
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span>TypeScript strict mode enabled</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span>tRPC provides full autocomplete</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span>Zod schemas validate input/output</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span>shadcn/ui components fully typed</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span>Tailwind CSS JIT compiler active</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
