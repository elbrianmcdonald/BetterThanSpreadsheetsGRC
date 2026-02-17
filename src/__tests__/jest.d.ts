/// <reference types="@testing-library/jest-dom" />
/// <reference types="jest-axe" />

import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';
import type { axe } from 'jest-axe';

declare global {
  namespace jest {
    interface Matchers<R = void, T = {}> extends TestingLibraryMatchers<typeof expect.stringContaining, R> {
      toHaveNoViolations(): R;
    }
  }
}
