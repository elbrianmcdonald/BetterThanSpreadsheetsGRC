"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";

export default function ComponentExamplesPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(33);

  const handleToast = (type: "success" | "error" | "info") => {
    switch (type) {
      case "success":
        toast.success("Success!", {
          description: "Your action was completed successfully.",
        });
        break;
      case "error":
        toast.error("Error!", {
          description: "Something went wrong. Please try again.",
        });
        break;
      case "info":
        toast.info("Information", {
          description: "Here's some information for you.",
        });
        break;
    }
  };

  return (
    <div className="container mx-auto p-8 space-y-12">
      <div>
        <h1 className="text-4xl font-bold mb-2">shadcn/ui Component Examples</h1>
        <p className="text-muted-foreground">
          Comprehensive showcase of all installed shadcn/ui components
        </p>
      </div>

      <Separator />

      {/* Buttons */}
      <Card>
        <CardHeader>
          <CardTitle>Button Variants</CardTitle>
          <CardDescription>
            Different button styles and sizes available
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <Button variant="default">Default</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
        </CardContent>
      </Card>

      {/* Form Inputs */}
      <Card>
        <CardHeader>
          <CardTitle>Form Inputs</CardTitle>
          <CardDescription>Text inputs, selects, checkboxes, and radio buttons</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="you@example.com" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea id="message" placeholder="Type your message here" />
          </div>

          <div className="space-y-2">
            <Label>Select Framework</Label>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Select a framework" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nist">NIST 800-53</SelectItem>
                <SelectItem value="iso27001">ISO 27001</SelectItem>
                <SelectItem value="soc2">SOC 2</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox id="terms" />
            <Label htmlFor="terms">Accept terms and conditions</Label>
          </div>

          <div className="space-y-2">
            <Label>Risk Severity</Label>
            <RadioGroup defaultValue="medium">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="low" id="low" />
                <Label htmlFor="low">Low</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="medium" id="medium" />
                <Label htmlFor="medium">Medium</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="high" id="high" />
                <Label htmlFor="high">High</Label>
              </div>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Tabs</CardTitle>
          <CardDescription>Organize content into sections</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="space-y-4">
              <p>This is the overview tab content.</p>
            </TabsContent>
            <TabsContent value="details">
              <p>This is the details tab content.</p>
            </TabsContent>
            <TabsContent value="settings">
              <p>This is the settings tab content.</p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Dialog */}
      <Card>
        <CardHeader>
          <CardTitle>Dialog</CardTitle>
          <CardDescription>Modal dialogs for user interaction</CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Open Dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Are you sure?</DialogTitle>
                <DialogDescription>
                  This action cannot be undone. This will permanently delete your data.
                </DialogDescription>
              </DialogHeader>
              <div className="flex gap-2 justify-end mt-4">
                <Button variant="outline">Cancel</Button>
                <Button variant="destructive">Delete</Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* Dropdown Menu */}
      <Card>
        <CardHeader>
          <CardTitle>Dropdown Menu</CardTitle>
          <CardDescription>Context menus and dropdowns</CardDescription>
        </CardHeader>
        <CardContent>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">Open Menu</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Profile</DropdownMenuItem>
              <DropdownMenuItem>Settings</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">Logout</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Table</CardTitle>
          <CardDescription>Data tables for displaying information</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableCaption>A list of recent risks</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>RISK-001</TableCell>
                <TableCell>Database Encryption Missing</TableCell>
                <TableCell>
                  <Badge variant="destructive">High</Badge>
                </TableCell>
                <TableCell>
                  <Badge>Open</Badge>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>RISK-002</TableCell>
                <TableCell>Outdated Dependencies</TableCell>
                <TableCell>
                  <Badge>Medium</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">In Progress</Badge>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>RISK-003</TableCell>
                <TableCell>Missing MFA</TableCell>
                <TableCell>
                  <Badge variant="destructive">High</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">Closed</Badge>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Badges & Avatars */}
      <Card>
        <CardHeader>
          <CardTitle>Badges & Avatars</CardTitle>
          <CardDescription>Status indicators and user profiles</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="destructive">Destructive</Badge>
            <Badge variant="outline">Outline</Badge>
          </div>

          <div className="flex gap-4">
            <Avatar>
              <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
              <AvatarFallback>CN</AvatarFallback>
            </Avatar>
            <Avatar>
              <AvatarFallback>AB</AvatarFallback>
            </Avatar>
            <Avatar>
              <AvatarFallback>JD</AvatarFallback>
            </Avatar>
          </div>
        </CardContent>
      </Card>

      {/* Skeleton */}
      <Card>
        <CardHeader>
          <CardTitle>Skeleton Loaders</CardTitle>
          <CardDescription>Loading state placeholders</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-[250px]" />
              <Skeleton className="h-4 w-[200px]" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alerts */}
      <Card>
        <CardHeader>
          <CardTitle>Alerts</CardTitle>
          <CardDescription>Informational messages and notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTitle>Information</AlertTitle>
            <AlertDescription>
              This is an informational alert message.
            </AlertDescription>
          </Alert>

          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              Something went wrong. Please try again later.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Toast Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>Toast Notifications</CardTitle>
          <CardDescription>Temporary notifications using Sonner</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Button onClick={() => handleToast("success")}>Success Toast</Button>
          <Button onClick={() => handleToast("error")} variant="destructive">
            Error Toast
          </Button>
          <Button onClick={() => handleToast("info")} variant="outline">
            Info Toast
          </Button>
        </CardContent>
      </Card>

      {/* Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Progress Indicator</CardTitle>
          <CardDescription>Visual progress bars</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={progress} />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => setProgress(Math.max(0, progress - 10))}
            >
              Decrease
            </Button>
            <Button
              size="sm"
              onClick={() => setProgress(Math.min(100, progress + 10))}
            >
              Increase
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
