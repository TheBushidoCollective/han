/**
 * Config validation for han-plugin.yml files
 * Lightweight validation without external dependencies
 */

export interface ValidationError {
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validate a plugin han-plugin.yml file
 */
export function validatePluginConfig(config: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  if (typeof config !== 'object' || config === null) {
    return {
      valid: false,
      errors: [{ path: '', message: 'Config must be an object' }],
    };
  }

  const configObj = config as Record<string, unknown>;

  // Check required 'hooks' property
  if (!('hooks' in configObj)) {
    errors.push({ path: '', message: "Missing required property 'hooks'" });
    return { valid: false, errors };
  }

  if (typeof configObj.hooks !== 'object' || configObj.hooks === null) {
    errors.push({ path: 'hooks', message: "'hooks' must be an object" });
    return { valid: false, errors };
  }

  const hooks = configObj.hooks as Record<string, unknown>;

  // Validate each hook definition
  for (const [hookName, hookDef] of Object.entries(hooks)) {
    const hookPath = `hooks.${hookName}`;

    if (typeof hookDef !== 'object' || hookDef === null) {
      errors.push({
        path: hookPath,
        message: 'Hook definition must be an object',
      });
      continue;
    }

    const hook = hookDef as Record<string, unknown>;

    // Required: command
    if (!('command' in hook) || typeof hook.command !== 'string') {
      errors.push({
        path: `${hookPath}.command`,
        message: "'command' is required and must be a string",
      });
    }

    // Optional: dirsWith (array of strings)
    if ('dirsWith' in hook) {
      if (!Array.isArray(hook.dirsWith)) {
        errors.push({
          path: `${hookPath}.dirsWith`,
          message: "'dirsWith' must be an array",
        });
      } else if (!hook.dirsWith.every((item) => typeof item === 'string')) {
        errors.push({
          path: `${hookPath}.dirsWith`,
          message: "'dirsWith' must contain only strings",
        });
      }
    }

    // Optional: dirTest (string)
    if ('dirTest' in hook && typeof hook.dirTest !== 'string') {
      errors.push({
        path: `${hookPath}.dirTest`,
        message: "'dirTest' must be a string",
      });
    }

    // Optional: description (string)
    if ('description' in hook && typeof hook.description !== 'string') {
      errors.push({
        path: `${hookPath}.description`,
        message: "'description' must be a string",
      });
    }

    // Optional: ifChanged (array of strings)
    if ('ifChanged' in hook) {
      if (!Array.isArray(hook.ifChanged)) {
        errors.push({
          path: `${hookPath}.ifChanged`,
          message: "'ifChanged' must be an array",
        });
      } else if (!hook.ifChanged.every((item) => typeof item === 'string')) {
        errors.push({
          path: `${hookPath}.ifChanged`,
          message: "'ifChanged' must contain only strings",
        });
      }
    }

    // Optional: idleTimeout (positive integer, in seconds)
    if ('idleTimeout' in hook) {
      if (
        typeof hook.idleTimeout !== 'number' ||
        !Number.isInteger(hook.idleTimeout) ||
        hook.idleTimeout < 0
      ) {
        errors.push({
          path: `${hookPath}.idleTimeout`,
          message: "'idleTimeout' must be a non-negative integer (seconds)",
        });
      }
    }

    // Optional: dependsOn (array of dependencies)
    if ('dependsOn' in hook) {
      if (!Array.isArray(hook.dependsOn)) {
        errors.push({
          path: `${hookPath}.dependsOn`,
          message: "'dependsOn' must be an array",
        });
      } else {
        for (const [idx, dep] of hook.dependsOn.entries()) {
          const depPath = `${hookPath}.dependsOn[${idx}]`;

          if (typeof dep !== 'object' || dep === null) {
            errors.push({
              path: depPath,
              message: 'Dependency must be an object',
            });
            continue;
          }

          const depObj = dep as Record<string, unknown>;

          // Required: plugin (string)
          if (!('plugin' in depObj) || typeof depObj.plugin !== 'string') {
            errors.push({
              path: `${depPath}.plugin`,
              message: "'plugin' is required and must be a string",
            });
          }

          // Required: hook (string)
          if (!('hook' in depObj) || typeof depObj.hook !== 'string') {
            errors.push({
              path: `${depPath}.hook`,
              message: "'hook' is required and must be a string",
            });
          }

          // Optional: optional (boolean)
          if ('optional' in depObj && typeof depObj.optional !== 'boolean') {
            errors.push({
              path: `${depPath}.optional`,
              message: "'optional' must be a boolean",
            });
          }

          // Check for unknown properties in dependency
          const validDepProperties = ['plugin', 'hook', 'optional'];
          for (const key of Object.keys(depObj)) {
            if (!validDepProperties.includes(key)) {
              errors.push({
                path: `${depPath}.${key}`,
                message: `Unknown property '${key}' in dependency`,
              });
            }
          }
        }
      }
    }

    // Check for unknown properties (support both camelCase and snake_case)
    const validProperties = [
      'command',
      'dirsWith',
      'dirs_with',
      'dirTest',
      'dir_test',
      'description',
      'ifChanged',
      'if_changed',
      'idleTimeout',
      'idle_timeout',
      'dependsOn',
      'depends_on',
      'tip',
      'event',
      'toolFilter',
      'tool_filter',
      'mcp',
      'silent',
      'test_dir',
      'file_test',
      'sync',
    ];
    for (const key of Object.keys(hook)) {
      if (!validProperties.includes(key)) {
        errors.push({
          path: `${hookPath}.${key}`,
          message: `Unknown property '${key}'`,
        });
      }
    }
  }

  // Check for unknown top-level properties - strict validation
  // Valid properties: hooks (required), mcp_servers, memory
  const validTopLevel = ['hooks', 'mcp_servers', 'memory'];
  for (const key of Object.keys(configObj)) {
    if (!validTopLevel.includes(key)) {
      errors.push({ path: key, message: `Unknown property '${key}'` });
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a user han-config.yml file
 */
export function validateUserConfig(config: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  if (typeof config !== 'object' || config === null) {
    return {
      valid: false,
      errors: [{ path: '', message: 'Config must be an object' }],
    };
  }

  const configObj = config as Record<string, unknown>;

  // Validate each plugin's overrides
  for (const [pluginName, pluginOverrides] of Object.entries(configObj)) {
    const pluginPath = pluginName;

    if (typeof pluginOverrides !== 'object' || pluginOverrides === null) {
      errors.push({
        path: pluginPath,
        message: 'Plugin overrides must be an object',
      });
      continue;
    }

    const overrides = pluginOverrides as Record<string, unknown>;

    // Validate each hook override
    for (const [hookName, hookOverride] of Object.entries(overrides)) {
      const hookPath = `${pluginPath}.${hookName}`;

      if (typeof hookOverride !== 'object' || hookOverride === null) {
        errors.push({
          path: hookPath,
          message: 'Hook override must be an object',
        });
        continue;
      }

      const override = hookOverride as Record<string, unknown>;

      // Optional: enabled (boolean)
      if ('enabled' in override && typeof override.enabled !== 'boolean') {
        errors.push({
          path: `${hookPath}.enabled`,
          message: "'enabled' must be a boolean",
        });
      }

      // Optional: command (string)
      if ('command' in override && typeof override.command !== 'string') {
        errors.push({
          path: `${hookPath}.command`,
          message: "'command' must be a string",
        });
      }

      // Optional: if_changed (array of strings)
      if ('if_changed' in override) {
        if (!Array.isArray(override.if_changed)) {
          errors.push({
            path: `${hookPath}.if_changed`,
            message: "'if_changed' must be an array",
          });
        } else if (
          !override.if_changed.every((item) => typeof item === 'string')
        ) {
          errors.push({
            path: `${hookPath}.if_changed`,
            message: "'if_changed' must contain only strings",
          });
        }
      }

      // Optional: idle_timeout (positive integer in seconds, false, or 0)
      if ('idle_timeout' in override) {
        const timeout = override.idle_timeout;
        const isValidNumber =
          typeof timeout === 'number' &&
          Number.isInteger(timeout) &&
          timeout >= 0;
        const isValidFalse = timeout === false;

        if (!isValidNumber && !isValidFalse) {
          errors.push({
            path: `${hookPath}.idle_timeout`,
            message:
              "'idle_timeout' must be a non-negative integer (seconds) or false to disable",
          });
        }
      }

      // Check for unknown properties
      const validProperties = [
        'enabled',
        'command',
        'if_changed',
        'idle_timeout',
      ];
      for (const key of Object.keys(override)) {
        if (!validProperties.includes(key)) {
          errors.push({
            path: `${hookPath}.${key}`,
            message: `Unknown property '${key}'`,
          });
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(
  filename: string,
  result: ValidationResult
): string {
  if (result.valid) {
    return `${filename}: Valid`;
  }

  const lines = [`${filename}: Invalid configuration`];
  for (const error of result.errors) {
    const path = error.path ? ` at '${error.path}'` : '';
    lines.push(`  - ${error.message}${path}`);
  }
  return lines.join('\n');
}
