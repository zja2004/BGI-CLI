/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useCallback, useState } from 'react';
import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import { RadioButtonSelect } from '../components/shared/RadioButtonSelect.js';
import {
  SettingScope,
  type LoadableSettingScope,
  type LoadedSettings,
} from '../../config/settings.js';
import {
  AuthType,
  clearCachedCredentialFile,
  type Config,
} from '@google/gemini-cli-core';
import { useKeypress } from '../hooks/useKeypress.js';
import { AuthState } from '../types.js';
import { validateAuthMethodWithSettings } from './useAuth.js';

interface AuthDialogProps {
  config: Config;
  settings: LoadedSettings;
  setAuthState: (state: AuthState) => void;
  authError: string | null;
  onAuthError: (error: string | null) => void;
  setAuthContext: (context: { requiresRestart?: boolean }) => void;
}

const AUTH_ITEMS = [
  {
    label: 'MiniMax (海螺 AI)',
    value: AuthType.USE_MINIMAX,
    key: AuthType.USE_MINIMAX,
  },
  {
    label: 'Kimi (月之暗面 Moonshot)',
    value: AuthType.USE_KIMI,
    key: AuthType.USE_KIMI,
  },
  {
    label: 'Qwen (通义千问 Alibaba)',
    value: AuthType.USE_QWEN,
    key: AuthType.USE_QWEN,
  },
  {
    label: 'DeepSeek (深度求索)',
    value: AuthType.USE_DEEPSEEK,
    key: AuthType.USE_DEEPSEEK,
  },
  {
    label: 'Gemini API Key',
    value: AuthType.USE_GEMINI,
    key: AuthType.USE_GEMINI,
  },
  {
    label: '自定义 API (Custom URL + API Key)',
    value: AuthType.USE_CUSTOM,
    key: AuthType.USE_CUSTOM,
  },
];

export function AuthDialog({
  config: _config,
  settings,
  setAuthState,
  authError,
  onAuthError,
  setAuthContext,
}: AuthDialogProps): React.JSX.Element {
  const [exiting] = useState(false);

  let items = [...AUTH_ITEMS];

  if (settings.merged.security.auth.enforcedType) {
    items = items.filter(
      (item) => item.value === settings.merged.security.auth.enforcedType,
    );
  }

  let initialAuthIndex = items.findIndex((item) => {
    if (settings.merged.security.auth.selectedType) {
      return item.value === settings.merged.security.auth.selectedType;
    }
    return item.value === AuthType.USE_DEEPSEEK;
  });

  if (initialAuthIndex < 0) initialAuthIndex = 0;
  if (settings.merged.security.auth.enforcedType) {
    initialAuthIndex = 0;
  }

  const onSelect = useCallback(
    async (authType: AuthType | undefined, scope: LoadableSettingScope) => {
      if (exiting) {
        return;
      }
      if (authType) {
        setAuthContext({});
        await clearCachedCredentialFile();
        settings.setValue(scope, 'security.auth.selectedType', authType);
        // All providers need API key entry
        setAuthState(AuthState.AwaitingApiKeyInput);
        return;
      }
      setAuthState(AuthState.Unauthenticated);
    },
    [settings, setAuthState, exiting, setAuthContext],
  );

  const handleAuthSelect = (authMethod: AuthType) => {
    const error = validateAuthMethodWithSettings(authMethod, settings);
    if (error) {
      onAuthError(error);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      onSelect(authMethod, SettingScope.User);
    }
  };

  useKeypress(
    (key) => {
      if (key.name === 'escape') {
        if (authError) {
          return true;
        }
        if (settings.merged.security.auth.selectedType === undefined) {
          onAuthError(
            'You must select an auth method to proceed. Press Ctrl+C twice to exit.',
          );
          return true;
        }
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        onSelect(undefined, SettingScope.User);
        return true;
      }
      return false;
    },
    { isActive: true },
  );

  if (exiting) {
    return (
      <Box
        borderStyle="round"
        borderColor={theme.ui.focus}
        flexDirection="row"
        padding={1}
        width="100%"
        alignItems="flex-start"
      >
        <Text color={theme.text.primary}>正在初始化... 重启 BGI CLI。</Text>
      </Box>
    );
  }

  return (
    <Box
      borderStyle="round"
      borderColor={theme.ui.focus}
      flexDirection="row"
      padding={1}
      width="100%"
      alignItems="flex-start"
    >
      <Text color={theme.text.accent}>? </Text>
      <Box flexDirection="column" flexGrow={1}>
        <Text bold color={theme.text.primary}>
          欢迎使用 BGI CLI
        </Text>
        <Box marginTop={1}>
          <Text color={theme.text.primary}>请选择您的 AI 服务提供商：</Text>
        </Box>
        <Box marginTop={1}>
          <RadioButtonSelect
            items={items}
            initialIndex={initialAuthIndex}
            onSelect={handleAuthSelect}
            onHighlight={() => {
              onAuthError(null);
            }}
          />
        </Box>
        {authError && (
          <Box marginTop={1}>
            <Text color={theme.status.error}>{authError}</Text>
          </Box>
        )}
        <Box marginTop={1}>
          <Text color={theme.text.secondary}>(按 Enter 确认选择)</Text>
        </Box>
      </Box>
    </Box>
  );
}
