/**
 * @jest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, jest } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

// Test form schema
const testFormSchema = z.object({
  username: z.string().min(3, {
    message: 'Username must be at least 3 characters.',
  }),
  email: z.string().email({
    message: 'Please enter a valid email address.',
  }),
  age: z.coerce.number().min(18, {
    message: 'You must be at least 18 years old.',
  }),
});

type TestFormValues = z.infer<typeof testFormSchema>;

// Test component
function TestForm({ onSubmit }: { onSubmit: (data: TestFormValues) => void }) {
  const form = useForm<TestFormValues>({
    resolver: zodResolver(testFormSchema),
    defaultValues: {
      username: '',
      email: '',
      age: 0,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input placeholder="Enter username" {...field} />
              </FormControl>
              <FormDescription>
                Your public display name.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="Enter email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="age"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Age</FormLabel>
              <FormControl>
                <Input type="number" placeholder="Enter age" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit">Submit</Button>
      </form>
    </Form>
  );
}

describe('Form Component', () => {
  describe('Validation', () => {
    it('should show validation errors when form is submitted with empty fields', async () => {
      const handleSubmit = jest.fn();
      const user = userEvent.setup();

      render(<TestForm onSubmit={handleSubmit} />);

      const submitButton = screen.getByRole('button', { name: /submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/username must be at least 3 characters/i)).toBeInTheDocument();
        expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
        expect(screen.getByText(/you must be at least 18 years old/i)).toBeInTheDocument();
      });

      expect(handleSubmit).not.toHaveBeenCalled();
    });

    it('should show validation error for invalid email', async () => {
      const handleSubmit = jest.fn();
      const user = userEvent.setup();

      render(<TestForm onSubmit={handleSubmit} />);

      const usernameInput = screen.getByPlaceholderText(/enter username/i);
      const emailInput = screen.getByPlaceholderText(/enter email/i);
      const ageInput = screen.getByPlaceholderText(/enter age/i);

      // Fill in valid data for other fields to isolate email validation
      await user.type(usernameInput, 'testuser');
      await user.type(emailInput, 'notanemail');
      await user.clear(ageInput);
      await user.type(ageInput, '25');

      const submitButton = screen.getByRole('button', { name: /submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
      });

      expect(handleSubmit).not.toHaveBeenCalled();
    });

    it('should show validation error for username less than 3 characters', async () => {
      const handleSubmit = jest.fn();
      const user = userEvent.setup();

      render(<TestForm onSubmit={handleSubmit} />);

      const usernameInput = screen.getByPlaceholderText(/enter username/i);
      await user.type(usernameInput, 'ab');

      const submitButton = screen.getByRole('button', { name: /submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/username must be at least 3 characters/i)).toBeInTheDocument();
      });

      expect(handleSubmit).not.toHaveBeenCalled();
    });

    it('should show validation error for age less than 18', async () => {
      const handleSubmit = jest.fn();
      const user = userEvent.setup();

      render(<TestForm onSubmit={handleSubmit} />);

      const ageInput = screen.getByPlaceholderText(/enter age/i);
      await user.clear(ageInput);
      await user.type(ageInput, '15');

      const submitButton = screen.getByRole('button', { name: /submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/you must be at least 18 years old/i)).toBeInTheDocument();
      });

      expect(handleSubmit).not.toHaveBeenCalled();
    });

    it('should clear validation errors when valid input is entered', async () => {
      const handleSubmit = jest.fn();
      const user = userEvent.setup();

      render(<TestForm onSubmit={handleSubmit} />);

      // Submit with invalid data first
      const submitButton = screen.getByRole('button', { name: /submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/username must be at least 3 characters/i)).toBeInTheDocument();
      });

      // Now enter valid data
      const usernameInput = screen.getByPlaceholderText(/enter username/i);
      const emailInput = screen.getByPlaceholderText(/enter email/i);
      const ageInput = screen.getByPlaceholderText(/enter age/i);

      await user.type(usernameInput, 'johndoe');
      await user.type(emailInput, 'john@example.com');
      await user.clear(ageInput);
      await user.type(ageInput, '25');

      await user.click(submitButton);

      await waitFor(() => {
        expect(handleSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            username: 'johndoe',
            email: 'john@example.com',
            age: 25,
          }),
          expect.anything()
        );
      });
    });
  });

  describe('Error Messages', () => {
    it('should display error messages with proper styling', async () => {
      const handleSubmit = jest.fn();
      const user = userEvent.setup();

      render(<TestForm onSubmit={handleSubmit} />);

      const submitButton = screen.getByRole('button', { name: /submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        const errorMessage = screen.getByText(/username must be at least 3 characters/i);
        expect(errorMessage).toBeInTheDocument();
        expect(errorMessage).toHaveClass('text-destructive');
      });
    });

    it('should display FormDescription when no error', () => {
      const handleSubmit = jest.fn();

      render(<TestForm onSubmit={handleSubmit} />);

      const description = screen.getByText(/your public display name/i);
      expect(description).toBeInTheDocument();
      expect(description).toHaveClass('text-muted-foreground');
    });

    it('should mark labels as error when field has error', async () => {
      const handleSubmit = jest.fn();
      const user = userEvent.setup();

      render(<TestForm onSubmit={handleSubmit} />);

      const submitButton = screen.getByRole('button', { name: /submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        const usernameLabel = screen.getByText(/username/i, { selector: 'label' });
        expect(usernameLabel).toHaveAttribute('data-error', 'true');
      });
    });
  });

  describe('Form Submission', () => {
    it('should submit form with valid data', async () => {
      const handleSubmit = jest.fn();
      const user = userEvent.setup();

      render(<TestForm onSubmit={handleSubmit} />);

      const usernameInput = screen.getByPlaceholderText(/enter username/i);
      const emailInput = screen.getByPlaceholderText(/enter email/i);
      const ageInput = screen.getByPlaceholderText(/enter age/i);

      await user.type(usernameInput, 'johndoe');
      await user.type(emailInput, 'john@example.com');
      await user.clear(ageInput);
      await user.type(ageInput, '25');

      const submitButton = screen.getByRole('button', { name: /submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(handleSubmit).toHaveBeenCalledWith(
          {
            username: 'johndoe',
            email: 'john@example.com',
            age: 25,
          },
          expect.anything()
        );
      });
    });

    it('should not submit form when Enter is pressed with invalid data', async () => {
      const handleSubmit = jest.fn();
      const user = userEvent.setup();

      render(<TestForm onSubmit={handleSubmit} />);

      const usernameInput = screen.getByPlaceholderText(/enter username/i);
      await user.type(usernameInput, 'ab');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByText(/username must be at least 3 characters/i)).toBeInTheDocument();
      });

      expect(handleSubmit).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should associate labels with form controls', () => {
      const handleSubmit = jest.fn();

      render(<TestForm onSubmit={handleSubmit} />);

      const usernameLabel = screen.getByText(/username/i, { selector: 'label' });
      const usernameInput = screen.getByPlaceholderText(/enter username/i);

      const labelFor = usernameLabel.getAttribute('for');
      const inputId = usernameInput.getAttribute('id');

      expect(labelFor).toBe(inputId);
    });

    it('should mark invalid fields with aria-invalid', async () => {
      const handleSubmit = jest.fn();
      const user = userEvent.setup();

      render(<TestForm onSubmit={handleSubmit} />);

      const submitButton = screen.getByRole('button', { name: /submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        const usernameInput = screen.getByPlaceholderText(/enter username/i);
        expect(usernameInput).toHaveAttribute('aria-invalid', 'true');
      });
    });

    it('should associate error messages with form controls via aria-describedby', async () => {
      const handleSubmit = jest.fn();
      const user = userEvent.setup();

      render(<TestForm onSubmit={handleSubmit} />);

      const submitButton = screen.getByRole('button', { name: /submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        const usernameInput = screen.getByPlaceholderText(/enter username/i);
        const ariaDescribedBy = usernameInput.getAttribute('aria-describedby');
        expect(ariaDescribedBy).toBeTruthy();

        // Error message should have an id that matches the aria-describedby
        const errorMessage = screen.getByText(/username must be at least 3 characters/i);
        const errorMessageId = errorMessage.getAttribute('id');
        expect(ariaDescribedBy).toContain(errorMessageId);
      });
    });
  });
});
