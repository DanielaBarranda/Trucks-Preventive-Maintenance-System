import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// jsdom has no object URLs (used for photo previews)
if (!URL.createObjectURL) {
  URL.createObjectURL = () => 'blob:preview';
  URL.revokeObjectURL = () => {};
}
