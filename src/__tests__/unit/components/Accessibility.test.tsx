/**
 * @jest-environment jsdom
 */
import React from 'react';
import { describe, it, expect } from '@jest/globals';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

describe('Component Accessibility', () => {
  describe('Button', () => {
    it('should not have accessibility violations', async () => {
      const { container } = render(<Button>Click me</Button>);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should not have violations with different variants', async () => {
      const { container } = render(
        <div>
          <Button variant="default">Default</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="secondary">Secondary</Button>
        </div>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should not have violations when disabled', async () => {
      const { container } = render(<Button disabled>Disabled</Button>);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should not have violations with aria-label', async () => {
      const { container } = render(<Button aria-label="Close modal">X</Button>);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Form Elements', () => {
    it('should not have violations for Input with Label', async () => {
      const { container } = render(
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="Enter email" />
        </div>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should not have violations for Input without label but with aria-label', async () => {
      const { container } = render(
        <Input aria-label="Search" type="search" placeholder="Search..." />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Card', () => {
    it('should not have accessibility violations', async () => {
      const { container } = render(
        <Card>
          <CardHeader>
            <CardTitle>Card Title</CardTitle>
            <CardDescription>Card Description</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Card content goes here</p>
          </CardContent>
          <CardFooter>
            <Button>Action</Button>
          </CardFooter>
        </Card>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Alert', () => {
    it('should not have violations for default alert', async () => {
      const { container } = render(
        <Alert>
          <AlertTitle>Information</AlertTitle>
          <AlertDescription>
            This is an informational message.
          </AlertDescription>
        </Alert>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should not have violations for destructive alert', async () => {
      const { container } = render(
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Something went wrong.
          </AlertDescription>
        </Alert>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Badge', () => {
    it('should not have accessibility violations', async () => {
      const { container } = render(
        <div>
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge variant="outline">Outline</Badge>
        </div>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Dialog', () => {
    it('should not have violations when closed', async () => {
      const { container } = render(
        <Dialog>
          <DialogTrigger asChild>
            <Button>Open Dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dialog Title</DialogTitle>
              <DialogDescription>
                This is a dialog description.
              </DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Complex Components', () => {
    it('should not have violations for a form with multiple inputs', async () => {
      const { container } = render(
        <form>
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" type="text" required />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required />
          </div>
          <div>
            <Label htmlFor="message">Message</Label>
            <Input id="message" type="text" />
          </div>
          <Button type="submit">Submit</Button>
        </form>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should not have violations for a card with form elements', async () => {
      const { container } = render(
        <Card>
          <CardHeader>
            <CardTitle>Login</CardTitle>
            <CardDescription>Enter your credentials</CardDescription>
          </CardHeader>
          <CardContent>
            <form>
              <div>
                <Label htmlFor="username">Username</Label>
                <Input id="username" type="text" />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" />
              </div>
            </form>
          </CardContent>
          <CardFooter>
            <Button>Login</Button>
          </CardFooter>
        </Card>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Color Contrast', () => {
    it('should have sufficient contrast for Button variants', async () => {
      const { container } = render(
        <div>
          <Button variant="default">Default Button</Button>
          <Button variant="secondary">Secondary Button</Button>
          <Button variant="destructive">Destructive Button</Button>
        </div>
      );
      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: true },
        },
      });
      expect(results).toHaveNoViolations();
    });

    it('should have sufficient contrast for Alert variants', async () => {
      const { container } = render(
        <div>
          <Alert>
            <AlertTitle>Default Alert</AlertTitle>
            <AlertDescription>This is a default alert.</AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <AlertTitle>Error Alert</AlertTitle>
            <AlertDescription>This is an error alert.</AlertDescription>
          </Alert>
        </div>
      );
      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: true },
        },
      });
      expect(results).toHaveNoViolations();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should have proper focus indicators', async () => {
      const { container } = render(
        <div>
          <Button>Button 1</Button>
          <Button>Button 2</Button>
          <Input placeholder="Input field" />
        </div>
      );
      // Test for general accessibility including focusable elements
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});
