import { Box, Text, useApp, useInput } from 'ink';
import TextInput from 'ink-text-input';
import type React from 'react';
import { useState } from 'react';
import {
  getTypeDescription,
  getTypeDisplayName,
  getTypePrefix,
  type PluginConfig,
  type PluginType,
} from './templates/index.ts';

type Step =
  | 'type'
  | 'name'
  | 'description'
  | 'author'
  | 'authorUrl'
  | 'confirm';

interface PluginCreatorProps {
  onComplete: (config: PluginConfig) => void;
  onCancel: () => void;
  /** Pre-set values for non-interactive mode */
  initialValues?: Partial<PluginConfig>;
}

const PLUGIN_TYPES: PluginType[] = ['jutsu', 'do', 'hashi'];

export const PluginCreator: React.FC<PluginCreatorProps> = ({
  onComplete,
  onCancel,
  initialValues,
}) => {
  const { exit } = useApp();
  const [step, setStep] = useState<Step>(initialValues?.type ? 'name' : 'type');
  const [selectedTypeIndex, setSelectedTypeIndex] = useState(0);
  const [pluginType, setPluginType] = useState<PluginType | null>(
    initialValues?.type ?? null
  );
  const [pluginName, setPluginName] = useState(initialValues?.name ?? '');
  const [description, setDescription] = useState(
    initialValues?.description ?? ''
  );
  const [authorName, setAuthorName] = useState(initialValues?.authorName ?? '');
  const [authorUrl, setAuthorUrl] = useState(initialValues?.authorUrl ?? '');
  const [confirmIndex, setConfirmIndex] = useState(0);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Handle type selection
  useInput(
    (_input, key) => {
      if (key.upArrow) {
        setSelectedTypeIndex(Math.max(0, selectedTypeIndex - 1));
      } else if (key.downArrow) {
        setSelectedTypeIndex(
          Math.min(PLUGIN_TYPES.length - 1, selectedTypeIndex + 1)
        );
      } else if (key.return) {
        setPluginType(PLUGIN_TYPES[selectedTypeIndex]);
        setStep('name');
      } else if (key.escape) {
        onCancel();
        exit();
      }
    },
    { isActive: step === 'type' }
  );

  // Handle confirmation
  useInput(
    (_input, key) => {
      if (key.leftArrow || key.rightArrow) {
        setConfirmIndex(confirmIndex === 0 ? 1 : 0);
      } else if (key.return) {
        if (confirmIndex === 0) {
          // Create
          if (pluginType) {
            onComplete({
              name: pluginName,
              type: pluginType,
              description,
              authorName,
              authorUrl,
            });
          }
        } else {
          // Cancel
          onCancel();
          exit();
        }
      } else if (key.escape) {
        onCancel();
        exit();
      }
    },
    { isActive: step === 'confirm' }
  );

  // Validate plugin name
  const validateName = (name: string): string | null => {
    if (!name.trim()) {
      return 'Plugin name is required';
    }
    if (!/^[a-z][a-z0-9-]*$/.test(name)) {
      return 'Name must be kebab-case (lowercase letters, numbers, hyphens)';
    }
    if (name.startsWith('-') || name.endsWith('-')) {
      return 'Name cannot start or end with a hyphen';
    }
    if (name.includes('--')) {
      return 'Name cannot contain consecutive hyphens';
    }
    return null;
  };

  // Handle name input submission
  const handleNameSubmit = (value: string) => {
    if (!pluginType) return;
    const error = validateName(value);
    if (error) {
      setValidationError(error);
      return;
    }
    setValidationError(null);
    // Add type prefix if not already present
    const prefix = getTypePrefix(pluginType);
    const finalName = value.startsWith(prefix) ? value : `${prefix}${value}`;
    setPluginName(finalName);
    setStep('description');
  };

  // Step: Type Selection
  if (step === 'type') {
    return (
      <Box flexDirection="column" paddingY={1}>
        <Box marginBottom={1}>
          <Text bold color="cyan">
            Select plugin type:
          </Text>
        </Box>

        {PLUGIN_TYPES.map((type, index) => {
          const isSelected = index === selectedTypeIndex;

          return (
            <Box key={type} marginLeft={1} flexDirection="column">
              <Text
                color={isSelected ? 'cyan' : undefined}
                bold={isSelected}
                inverse={isSelected}
              >
                {isSelected ? '> ' : '  '}
                {getTypeDisplayName(type)}
              </Text>
              {isSelected && (
                <Box marginLeft={4}>
                  <Text dimColor>{getTypeDescription(type)}</Text>
                </Box>
              )}
            </Box>
          );
        })}

        <Box marginTop={1}>
          <Text dimColor>
            Use arrow keys to navigate, Enter to select, Esc to cancel
          </Text>
        </Box>
      </Box>
    );
  }

  // Step: Name Input
  if (step === 'name' && pluginType) {
    const prefix = getTypePrefix(pluginType);
    return (
      <Box flexDirection="column" paddingY={1}>
        <Box marginBottom={1}>
          <Text bold color="cyan">
            Enter plugin name:
          </Text>
        </Box>

        <Box>
          <Text dimColor>{prefix}</Text>
          <TextInput
            value={pluginName.replace(prefix, '')}
            onChange={(value) => {
              setPluginName(value);
              setValidationError(null);
            }}
            onSubmit={handleNameSubmit}
            placeholder="my-plugin-name"
          />
        </Box>

        {validationError && (
          <Box marginTop={1}>
            <Text color="red">{validationError}</Text>
          </Box>
        )}

        <Box marginTop={1}>
          <Text dimColor>Use kebab-case (e.g., my-plugin-name)</Text>
        </Box>
      </Box>
    );
  }

  // Step: Description Input
  if (step === 'description') {
    return (
      <Box flexDirection="column" paddingY={1}>
        <Box marginBottom={1}>
          <Text bold color="cyan">
            Enter plugin description:
          </Text>
        </Box>

        <Box>
          <TextInput
            value={description}
            onChange={setDescription}
            onSubmit={(value) => {
              if (value.trim()) {
                setDescription(value);
                setStep('author');
              }
            }}
            placeholder="A brief description of what your plugin does"
          />
        </Box>

        <Box marginTop={1}>
          <Text dimColor>Creating: {pluginName}</Text>
        </Box>
      </Box>
    );
  }

  // Step: Author Name Input
  if (step === 'author') {
    return (
      <Box flexDirection="column" paddingY={1}>
        <Box marginBottom={1}>
          <Text bold color="cyan">
            Enter author name:
          </Text>
        </Box>

        <Box>
          <TextInput
            value={authorName}
            onChange={setAuthorName}
            onSubmit={(value) => {
              if (value.trim()) {
                setAuthorName(value);
                setStep('authorUrl');
              }
            }}
            placeholder="Your Name or Organization"
          />
        </Box>

        <Box marginTop={1}>
          <Text dimColor>Creating: {pluginName}</Text>
        </Box>
      </Box>
    );
  }

  // Step: Author URL Input
  if (step === 'authorUrl') {
    return (
      <Box flexDirection="column" paddingY={1}>
        <Box marginBottom={1}>
          <Text bold color="cyan">
            Enter author URL (optional):
          </Text>
        </Box>

        <Box>
          <TextInput
            value={authorUrl}
            onChange={setAuthorUrl}
            onSubmit={(value) => {
              setAuthorUrl(value);
              setStep('confirm');
            }}
            placeholder="https://your-website.com"
          />
        </Box>

        <Box marginTop={1}>
          <Text dimColor>Press Enter to skip if you don't have a URL</Text>
        </Box>
      </Box>
    );
  }

  // Step: Confirmation
  if (step === 'confirm' && pluginType) {
    return (
      <Box flexDirection="column" paddingY={1}>
        <Box marginBottom={1}>
          <Text bold color="cyan">
            Create plugin with these settings?
          </Text>
        </Box>

        <Box flexDirection="column" marginLeft={2} marginBottom={1}>
          <Text>
            <Text bold>Name:</Text> {pluginName}
          </Text>
          <Text>
            <Text bold>Type:</Text> {getTypeDisplayName(pluginType)}
          </Text>
          <Text>
            <Text bold>Description:</Text> {description}
          </Text>
          <Text>
            <Text bold>Author:</Text> {authorName}
          </Text>
          {authorUrl && (
            <Text>
              <Text bold>URL:</Text> {authorUrl}
            </Text>
          )}
        </Box>

        <Box gap={2}>
          <Text
            color={confirmIndex === 0 ? 'green' : undefined}
            bold={confirmIndex === 0}
            inverse={confirmIndex === 0}
          >
            {confirmIndex === 0 ? '> ' : '  '}Create
          </Text>
          <Text
            color={confirmIndex === 1 ? 'red' : undefined}
            bold={confirmIndex === 1}
            inverse={confirmIndex === 1}
          >
            {confirmIndex === 1 ? '> ' : '  '}Cancel
          </Text>
        </Box>

        <Box marginTop={1}>
          <Text dimColor>Use arrow keys to select, Enter to confirm</Text>
        </Box>
      </Box>
    );
  }

  return null;
};
