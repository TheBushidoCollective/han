import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { useEffect, useState } from 'react';
import { MarkdownWrapper } from './markdown-wrapper.ts';
import type { AgentUpdate, DetectPluginsCallbacks } from './shared.ts';

interface InstallProgressProps {
  detectPlugins: (callbacks: DetectPluginsCallbacks) => Promise<void>;
  onInstallComplete: (plugins: string[]) => void;
  onInstallError: (error: Error) => void;
}

export const InstallProgress: React.FC<InstallProgressProps> = ({
  detectPlugins,
  onInstallComplete,
  onInstallError,
}) => {
  const [phase, setPhase] = useState<
    'analyzing' | 'analyzed' | 'installing' | 'complete' | 'error'
  >('analyzing');
  const [plugins, setPlugins] = useState<string[]>([]);
  const [fullText, setFullText] = useState('');
  const [currentTool, setCurrentTool] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toolsUsed, setToolsUsed] = useState<Set<string>>(new Set());

  useEffect(() => {
    const callbacks: DetectPluginsCallbacks = {
      onUpdate: (update: AgentUpdate) => {
        if (update.type === 'text') {
          setFullText((prev) => prev + update.content);
        } else if (update.type === 'tool' && update.toolName) {
          setCurrentTool(update.toolName);
          setToolsUsed((prev) => new Set([...prev, update.toolName as string]));
        }
      },
      onComplete: (detectedPlugins: string[], analysisText: string) => {
        setPlugins(detectedPlugins);
        setFullText(analysisText);
        setCurrentTool(null);
        setPhase('analyzed');
        setTimeout(() => {
          setPhase('installing');
          setTimeout(() => {
            setPhase('complete');
            onInstallComplete(detectedPlugins);
          }, 500);
        }, 1000);
      },
      onError: (err: Error) => {
        setError(err.message);
        setPhase('error');
        onInstallError(err);
      },
    };

    detectPlugins(callbacks);
  }, [detectPlugins, onInstallComplete, onInstallError]);

  const getToolEmoji = (toolName: string): string => {
    const emojiMap: Record<string, string> = {
      web_fetch: '🌐',
      read_file: '📄',
      glob: '🔍',
      grep: '🔎',
    };
    return emojiMap[toolName] || '🔧';
  };

  return (
    <Box flexDirection="column" paddingY={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          🤖 Han Plugin Installer
        </Text>
      </Box>

      {phase === 'analyzing' && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text color="yellow">
              <Spinner type="dots" /> Analyzing codebase...
            </Text>
          </Box>
          {currentTool && (
            <Box marginBottom={1}>
              <Text color="blue">
                {getToolEmoji(currentTool)} {currentTool}
              </Text>
            </Box>
          )}
          {toolsUsed.size > 0 && (
            <Box marginBottom={1}>
              <Text dimColor>
                Tools used: {Array.from(toolsUsed).join(', ')}
              </Text>
            </Box>
          )}
          {fullText && (
            <Box
              marginTop={1}
              paddingX={1}
              borderStyle="round"
              borderColor="gray"
              flexDirection="column"
            >
              <Box marginBottom={1}>
                <Text dimColor bold>
                  <Spinner type="star" /> Agent thinking:
                </Text>
              </Box>
              <MarkdownWrapper>{fullText}</MarkdownWrapper>
            </Box>
          )}
        </Box>
      )}

      {(phase === 'analyzed' ||
        phase === 'installing' ||
        phase === 'complete') && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text color="green">✅ Analysis complete</Text>
          </Box>

          {fullText && (
            <Box
              marginBottom={1}
              paddingX={1}
              borderStyle="round"
              borderColor="cyan"
              flexDirection="column"
            >
              <Box marginBottom={1}>
                <Text bold color="cyan">
                  📋 Agent Analysis:
                </Text>
              </Box>
              <MarkdownWrapper>{fullText}</MarkdownWrapper>
            </Box>
          )}

          {plugins.length > 0 && (
            <Box flexDirection="column" marginBottom={1}>
              <Text bold color="green">
                ✨ Adding recommended plugins:
              </Text>
              {plugins.sort().map((plugin) => (
                <Box key={plugin} marginLeft={2}>
                  <Text>• {plugin}</Text>
                </Box>
              ))}
            </Box>
          )}

          {phase === 'installing' && (
            <Box marginTop={1}>
              <Text color="yellow">
                <Spinner type="dots" /> Updating Claude Code settings...
              </Text>
            </Box>
          )}

          {phase === 'complete' && (
            <Box flexDirection="column" marginTop={1}>
              <Box marginBottom={1}>
                <Text color="green">✅ Updated Claude Code settings</Text>
              </Box>
              <Box marginBottom={1}>
                <Text color="green" bold>
                  ✅ Installation complete!
                </Text>
              </Box>
              <Box>
                <Text color="blue">
                  💡 Restart Claude Code to load the new plugins.
                </Text>
              </Box>
            </Box>
          )}
        </Box>
      )}

      {phase === 'error' && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text color="red" bold>
              ❌ Error
            </Text>
          </Box>
          <Box marginBottom={1}>
            <Text color="red">{error}</Text>
          </Box>
          {fullText && (
            <Box
              marginBottom={1}
              paddingX={1}
              borderStyle="round"
              borderColor="red"
              flexDirection="column"
            >
              <Text bold color="red">
                Partial Analysis:
              </Text>
              <Box>
                <MarkdownWrapper>{fullText}</MarkdownWrapper>
              </Box>
            </Box>
          )}
          <Box marginTop={1}>
            <Text color="yellow">
              ⚠️ Falling back to installing core plugin...
            </Text>
          </Box>
        </Box>
      )}
    </Box>
  );
};
