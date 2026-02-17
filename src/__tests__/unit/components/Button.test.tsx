/**
 * @jest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '@/components/ui/button';

describe('Button Component', () => {
  describe('Rendering', () => {
    it('should render with default variant', () => {
      render(<Button>Click me</Button>);
      const button = screen.getByRole('button', { name: /click me/i });
      expect(button).toBeInTheDocument();
    });

    it('should render with destructive variant', () => {
      render(<Button variant="destructive">Delete</Button>);
      const button = screen.getByRole('button', { name: /delete/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass('bg-destructive');
    });

    it('should render with outline variant', () => {
      render(<Button variant="outline">Outline</Button>);
      const button = screen.getByRole('button', { name: /outline/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass('border');
    });

    it('should render with secondary variant', () => {
      render(<Button variant="secondary">Secondary</Button>);
      const button = screen.getByRole('button', { name: /secondary/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass('bg-secondary');
    });

    it('should render with ghost variant', () => {
      render(<Button variant="ghost">Ghost</Button>);
      const button = screen.getByRole('button', { name: /ghost/i });
      expect(button).toBeInTheDocument();
    });

    it('should render with link variant', () => {
      render(<Button variant="link">Link</Button>);
      const button = screen.getByRole('button', { name: /link/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass('underline-offset-4');
    });

    it('should render with small size', () => {
      render(<Button size="sm">Small</Button>);
      const button = screen.getByRole('button', { name: /small/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass('h-8');
    });

    it('should render with large size', () => {
      render(<Button size="lg">Large</Button>);
      const button = screen.getByRole('button', { name: /large/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass('h-10');
    });

    it('should render with icon size', () => {
      render(<Button size="icon">X</Button>);
      const button = screen.getByRole('button', { name: /x/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass('size-9');
    });

    it('should render as disabled', () => {
      render(<Button disabled>Disabled</Button>);
      const button = screen.getByRole('button', { name: /disabled/i });
      expect(button).toBeDisabled();
    });

    it('should render with custom className', () => {
      render(<Button className="custom-class">Custom</Button>);
      const button = screen.getByRole('button', { name: /custom/i });
      expect(button).toHaveClass('custom-class');
    });
  });

  describe('Interactions', () => {
    it('should call onClick handler when clicked', async () => {
      const handleClick = jest.fn();
      const user = userEvent.setup();

      render(<Button onClick={handleClick}>Click me</Button>);
      const button = screen.getByRole('button', { name: /click me/i });

      await user.click(button);

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should not call onClick when disabled', async () => {
      const handleClick = jest.fn();
      const user = userEvent.setup();

      render(<Button onClick={handleClick} disabled>Disabled</Button>);
      const button = screen.getByRole('button', { name: /disabled/i });

      await user.click(button);

      expect(handleClick).not.toHaveBeenCalled();
    });

    it('should handle multiple clicks', async () => {
      const handleClick = jest.fn();
      const user = userEvent.setup();

      render(<Button onClick={handleClick}>Click me</Button>);
      const button = screen.getByRole('button', { name: /click me/i });

      await user.click(button);
      await user.click(button);
      await user.click(button);

      expect(handleClick).toHaveBeenCalledTimes(3);
    });
  });

  describe('Accessibility', () => {
    it('should have proper button role', () => {
      render(<Button>Accessible</Button>);
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      const handleClick = jest.fn();
      const user = userEvent.setup();

      render(<Button onClick={handleClick}>Keyboard</Button>);
      const button = screen.getByRole('button', { name: /keyboard/i });

      button.focus();
      expect(button).toHaveFocus();

      await user.keyboard('{Enter}');
      expect(handleClick).toHaveBeenCalledTimes(1);

      await user.keyboard(' ');
      expect(handleClick).toHaveBeenCalledTimes(2);
    });

    it('should support aria-label', () => {
      render(<Button aria-label="Close dialog">X</Button>);
      const button = screen.getByRole('button', { name: /close dialog/i });
      expect(button).toBeInTheDocument();
    });
  });

  describe('As Child', () => {
    it('should render as child component when asChild prop is true', () => {
      render(
        <Button asChild>
          <a href="/test">Link Button</a>
        </Button>
      );
      const link = screen.getByRole('link', { name: /link button/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', '/test');
    });
  });
});
