/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box, Text } from 'ink';
import { UserIdentity } from './UserIdentity.js';
import { Tips } from './Tips.js';
import { useSettings } from '../contexts/SettingsContext.js';
import { useConfig } from '../contexts/ConfigContext.js';
import { useUIState } from '../contexts/UIStateContext.js';
import { Banner } from './Banner.js';
import { useBanner } from '../hooks/useBanner.js';
import { useTips } from '../hooks/useTips.js';
import { theme } from '../semantic-colors.js';
import { ThemedGradient } from './ThemedGradient.js';
import { CliSpinner } from './CliSpinner.js';

interface AppHeaderProps {
  version: string;
  showDetails?: boolean;
}

/**
 * BGI logo rendered as a multi-line ASCII art block.
 * Line 0 gets the gradient, remaining lines use secondary colour.
 *
 * Each line is kept to ≤ 40 chars so it fits even in narrow terminals.
 */
const BGI_LOGO = [
  '██████╗  ██████╗ ██╗',
  '██╔══██╗██╔════╝ ██║',
  '██████╔╝██║  ███╗██║',
  '██╔══██╗██║   ██║██║',
  '██████╔╝╚██████╔╝██║',
  '╚═════╝  ╚═════╝ ╚═╝',
];

function BgiLogo() {
  return (
    <Box flexDirection="column">
      {BGI_LOGO.map((line, i) =>
        i === 0 ? (
          <ThemedGradient key={i}>
            <Text>{line}</Text>
          </ThemedGradient>
        ) : (
          <Text key={i} color={theme.text.accent}>
            {line}
          </Text>
        ),
      )}
    </Box>
  );
}

export const AppHeader = ({ version, showDetails = true }: AppHeaderProps) => {
  const settings = useSettings();
  const config = useConfig();
  const { terminalWidth, bannerData, bannerVisible, updateInfo } = useUIState();

  const { bannerText } = useBanner(bannerData);
  const { showTips } = useTips();

  const showHeader = !(
    settings.merged.ui.hideBanner || config.getScreenReader()
  );

  if (!showDetails) {
    return (
      <Box flexDirection="column">
        {showHeader && (
          <Box
            flexDirection="row"
            marginTop={1}
            marginBottom={1}
            paddingLeft={2}
          >
            <Box flexShrink={0}>
              <BgiLogo />
            </Box>
            <Box marginLeft={3} flexDirection="column" justifyContent="center">
              <Box>
                <Text bold color={theme.text.primary}>
                  BGI CLI
                </Text>
                <Text color={theme.text.secondary}> v{version}</Text>
              </Box>
            </Box>
          </Box>
        )}
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {showHeader && (
        <Box flexDirection="row" marginTop={1} marginBottom={1} paddingLeft={2}>
          <Box flexShrink={0}>
            <BgiLogo />
          </Box>
          <Box marginLeft={3} flexDirection="column" justifyContent="center">
            {/* Line 1: BGI CLI vVersion [Updating] */}
            <Box>
              <Text bold color={theme.text.primary}>
                BGI CLI
              </Text>
              <Text color={theme.text.secondary}> v{version}</Text>
              {updateInfo && (
                <Box marginLeft={2}>
                  <Text color={theme.text.secondary}>
                    <CliSpinner /> Updating
                  </Text>
                </Box>
              )}
            </Box>

            {/* Blank line */}
            <Box height={1} />

            {/* User Identity info */}
            {settings.merged.ui.showUserIdentity !== false && (
              <UserIdentity config={config} />
            )}
          </Box>
        </Box>
      )}

      {bannerVisible && bannerText && (
        <Banner
          width={terminalWidth}
          bannerText={bannerText}
          isWarning={bannerData.warningText !== ''}
        />
      )}

      {!(settings.merged.ui.hideTips || config.getScreenReader()) &&
        showTips && <Tips config={config} />}
    </Box>
  );
};
