/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useRef, useEffect } from 'react';
import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import { TextInput } from '../components/shared/TextInput.js';
import { useTextBuffer } from '../components/shared/text-buffer.js';
import { useUIState } from '../contexts/UIStateContext.js';
import {
  clearApiKey,
  debugLogger,
  AuthType,
  PROVIDER_BASE_URLS,
} from '@google/gemini-cli-core';
import { useKeypress } from '../hooks/useKeypress.js';
import { Command } from '../key/keyMatchers.js';
import { useKeyMatchers } from '../hooks/useKeyMatchers.js';
import { useSettings } from '../contexts/SettingsContext.js';

interface ApiAuthDialogProps {
  onSubmit: (apiKey: string, baseUrl?: string) => void;
  onCancel: () => void;
  error?: string | null;
  defaultValue?: string;
  defaultBaseUrl?: string;
}

/** Provider label map */
const PROVIDER_LABELS: Partial<Record<AuthType, string>> = {
  [AuthType.USE_MINIMAX]: 'MiniMax (海螺 AI)',
  [AuthType.USE_KIMI]: 'Kimi (月之暗面 Moonshot)',
  [AuthType.USE_QWEN]: 'Qwen (通义千问 Alibaba)',
  [AuthType.USE_DEEPSEEK]: 'DeepSeek (深度求索)',
  [AuthType.USE_CUSTOM]: '自定义 API',
};

export function ApiAuthDialog({
  onSubmit,
  onCancel,
  error,
  defaultValue = '',
  defaultBaseUrl = '',
}: ApiAuthDialogProps): React.JSX.Element {
  const keyMatchers = useKeyMatchers();
  const { terminalWidth } = useUIState();
  const settings = useSettings();
  const viewportWidth = terminalWidth - 8;

  const pendingPromise = useRef<{ cancel: () => void } | null>(null);

  useEffect(
    () => () => {
      pendingPromise.current?.cancel();
    },
    [],
  );

  const selectedAuthType = settings.merged.security.auth.selectedType;
  const isCustomProvider = selectedAuthType === AuthType.USE_CUSTOM;
  const providerLabel =
    (selectedAuthType && PROVIDER_LABELS[selectedAuthType]) ?? '服务商';

  const preConfiguredUrl =
    selectedAuthType && !isCustomProvider
      ? (PROVIDER_BASE_URLS[selectedAuthType] ?? '')
      : defaultBaseUrl;

  const apiKeyBuffer = useTextBuffer({
    initialText: defaultValue || '',
    initialCursorOffset: defaultValue?.length || 0,
    viewport: { width: viewportWidth, height: 4 },
    inputFilter: (text) =>
      text.replace(/[^a-zA-Z0-9_\-./]/g, '').replace(/[\r\n]/g, ''),
    singleLine: true,
  });

  const baseUrlBuffer = useTextBuffer({
    initialText: preConfiguredUrl,
    initialCursorOffset: preConfiguredUrl.length,
    viewport: { width: viewportWidth, height: 4 },
    inputFilter: (text) => text.replace(/[\r\n]/g, ''),
    singleLine: true,
  });

  const handleSubmit = (value: string) => {
    const url = isCustomProvider ? baseUrlBuffer.text.trim() : preConfiguredUrl;
    onSubmit(value, url || undefined);
  };

  const handleClear = () => {
    pendingPromise.current?.cancel();

    let isCancelled = false;
    const wrappedPromise = new Promise<void>((resolve, reject) => {
      clearApiKey().then(
        () => !isCancelled && resolve(),
        (e) => !isCancelled && reject(e),
      );
    });

    pendingPromise.current = {
      cancel: () => {
        isCancelled = true;
      },
    };

    return wrappedPromise
      .then(() => {
        apiKeyBuffer.setText('');
      })
      .catch((err) => {
        debugLogger.debug('Failed to clear API key:', err);
      });
  };

  useKeypress(
    (key) => {
      if (keyMatchers[Command.CLEAR_INPUT](key)) {
        void handleClear();
        return true;
      }
      return false;
    },
    { isActive: true },
  );

  return (
    <Box
      borderStyle="round"
      borderColor={theme.ui.focus}
      flexDirection="column"
      padding={1}
      width="100%"
    >
      <Text bold color={theme.text.primary}>
        {providerLabel} — 输入 API Key
      </Text>

      {!isCustomProvider && preConfiguredUrl && (
        <Box marginTop={1}>
          <Text color={theme.text.secondary}>
            {'API 端点：'}
            <Text color={theme.text.link}>{preConfiguredUrl}</Text>
          </Text>
        </Box>
      )}

      {isCustomProvider && (
        <Box marginTop={1} flexDirection="column">
          <Text color={theme.text.primary}>
            {'自定义 API 地址 (Base URL)：'}
          </Text>
          <Box
            marginTop={1}
            borderStyle="round"
            borderColor={theme.border.default}
            paddingX={1}
            flexGrow={1}
          >
            <TextInput
              buffer={baseUrlBuffer}
              onSubmit={() => {
                // no-op — user will submit via the API key field
              }}
              onCancel={onCancel}
              placeholder="https://your-api-endpoint/v1"
            />
          </Box>
        </Box>
      )}

      <Box marginTop={1} flexDirection="column">
        <Text color={theme.text.primary}>{'API Key：'}</Text>
        <Box
          marginTop={1}
          borderStyle="round"
          borderColor={theme.border.default}
          paddingX={1}
          flexGrow={1}
        >
          <TextInput
            buffer={apiKeyBuffer}
            onSubmit={handleSubmit}
            onCancel={onCancel}
            placeholder="粘贴您的 API Key"
          />
        </Box>
      </Box>

      {error && (
        <Box marginTop={1}>
          <Text color={theme.status.error}>{error}</Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text color={theme.text.secondary}>
          {'(按 Enter 确认，Esc 取消，Ctrl+C 清除已保存的 Key)'}
        </Text>
      </Box>
    </Box>
  );
}
