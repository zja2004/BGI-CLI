/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthType, isCustomProviderAuthType } from '@google/gemini-cli-core';
import { loadEnvironment, loadSettings } from './settings.js';

export function validateAuthMethod(authMethod: string): string | null {
  loadEnvironment(loadSettings().merged, process.cwd());

  // All API-key-based providers (including USE_GEMINI for backward compat)
  // are validated via the API key input dialog, not via env vars.
  if (
    authMethod === AuthType.USE_GEMINI ||
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    isCustomProviderAuthType(authMethod as AuthType)
  ) {
    return null;
  }

  return 'Invalid auth method selected.';
}
