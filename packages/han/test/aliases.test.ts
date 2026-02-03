/**
 * Tests for command aliases
 */
import { describe, expect, test } from 'bun:test';
import { Command } from 'commander';

describe('aliases', () => {
  describe('registerAliasCommands', () => {
    test('exports registerAliasCommands function', async () => {
      const { registerAliasCommands } = await import(
        '../lib/commands/aliases.ts'
      );

      expect(typeof registerAliasCommands).toBe('function');
    });

    test('registers install command', async () => {
      const { registerAliasCommands } = await import(
        '../lib/commands/aliases.ts'
      );

      const program = new Command();
      registerAliasCommands(program);

      // Find the install command
      const installCmd = program.commands.find(
        (cmd) => cmd.name() === 'install'
      );
      expect(installCmd).toBeDefined();
    });

    test('registers uninstall command', async () => {
      const { registerAliasCommands } = await import(
        '../lib/commands/aliases.ts'
      );

      const program = new Command();
      registerAliasCommands(program);

      // Find the uninstall command
      const uninstallCmd = program.commands.find(
        (cmd) => cmd.name() === 'uninstall'
      );
      expect(uninstallCmd).toBeDefined();
    });

    test('registers validate command', async () => {
      const { registerAliasCommands } = await import(
        '../lib/commands/aliases.ts'
      );

      const program = new Command();
      registerAliasCommands(program);

      // Find the validate command
      const validateCmd = program.commands.find(
        (cmd) => cmd.name() === 'validate'
      );
      expect(validateCmd).toBeDefined();
    });

    test('install command has description', async () => {
      const { registerAliasCommands } = await import(
        '../lib/commands/aliases.ts'
      );

      const program = new Command();
      registerAliasCommands(program);

      const installCmd = program.commands.find(
        (cmd) => cmd.name() === 'install'
      );
      expect(installCmd?.description()).toContain('plugin install');
    });

    test('install command has --scope option', async () => {
      const { registerAliasCommands } = await import(
        '../lib/commands/aliases.ts'
      );

      const program = new Command();
      registerAliasCommands(program);

      const installCmd = program.commands.find(
        (cmd) => cmd.name() === 'install'
      );
      expect(installCmd).toBeDefined();

      // Check options
      const options = installCmd?.options || [];
      const scopeOption = options.find((opt) => opt.long === '--scope');
      expect(scopeOption).toBeDefined();
    });

    test('uninstall command has description', async () => {
      const { registerAliasCommands } = await import(
        '../lib/commands/aliases.ts'
      );

      const program = new Command();
      registerAliasCommands(program);

      const uninstallCmd = program.commands.find(
        (cmd) => cmd.name() === 'uninstall'
      );
      expect(uninstallCmd?.description()).toContain('Remove');
    });

    test('validate command has description', async () => {
      const { registerAliasCommands } = await import(
        '../lib/commands/aliases.ts'
      );

      const program = new Command();
      registerAliasCommands(program);

      const validateCmd = program.commands.find(
        (cmd) => cmd.name() === 'validate'
      );
      expect(validateCmd?.description()).toContain('Stop hooks');
    });

    test('validate command has --all-files option', async () => {
      const { registerAliasCommands } = await import(
        '../lib/commands/aliases.ts'
      );

      const program = new Command();
      registerAliasCommands(program);

      const validateCmd = program.commands.find(
        (cmd) => cmd.name() === 'validate'
      );
      expect(validateCmd).toBeDefined();

      const options = validateCmd?.options || [];
      const allFilesOption = options.find((opt) => opt.long === '--all-files');
      expect(allFilesOption).toBeDefined();
    });

    test('validate command has --verbose option', async () => {
      const { registerAliasCommands } = await import(
        '../lib/commands/aliases.ts'
      );

      const program = new Command();
      registerAliasCommands(program);

      const validateCmd = program.commands.find(
        (cmd) => cmd.name() === 'validate'
      );
      expect(validateCmd).toBeDefined();

      const options = validateCmd?.options || [];
      const verboseOption = options.find((opt) => opt.long === '--verbose');
      expect(verboseOption).toBeDefined();
    });

    test('validate command has --check option', async () => {
      const { registerAliasCommands } = await import(
        '../lib/commands/aliases.ts'
      );

      const program = new Command();
      registerAliasCommands(program);

      const validateCmd = program.commands.find(
        (cmd) => cmd.name() === 'validate'
      );
      expect(validateCmd).toBeDefined();

      const options = validateCmd?.options || [];
      const checkOption = options.find((opt) => opt.long === '--check');
      expect(checkOption).toBeDefined();
    });

    test('validate-legacy command has --dirs-with option', async () => {
      const { registerAliasCommands } = await import(
        '../lib/commands/aliases.ts'
      );

      const program = new Command();
      registerAliasCommands(program);

      const validateLegacyCmd = program.commands.find(
        (cmd) => cmd.name() === 'validate-legacy'
      );
      expect(validateLegacyCmd).toBeDefined();

      const options = validateLegacyCmd?.options || [];
      const dirsWithOption = options.find((opt) => opt.long === '--dirs-with');
      expect(dirsWithOption).toBeDefined();
    });

    test('validate-legacy command allows unknown options', async () => {
      const { registerAliasCommands } = await import(
        '../lib/commands/aliases.ts'
      );

      const program = new Command();
      registerAliasCommands(program);

      const validateLegacyCmd = program.commands.find(
        (cmd) => cmd.name() === 'validate-legacy'
      );
      expect(validateLegacyCmd).toBeDefined();

      // Commander stores this as _allowUnknownOption
      expect(
        (validateLegacyCmd as Command & { _allowUnknownOption?: boolean })
          ?._allowUnknownOption
      ).toBe(true);
    });
  });

  describe('command structure', () => {
    test('all alias commands are registered', async () => {
      const { registerAliasCommands } = await import(
        '../lib/commands/aliases.ts'
      );

      const program = new Command();
      registerAliasCommands(program);

      const commandNames = program.commands.map((cmd) => cmd.name());

      expect(commandNames).toContain('install');
      expect(commandNames).toContain('uninstall');
      expect(commandNames).toContain('validate');
      expect(commandNames).toContain('validate-legacy');
      expect(commandNames.length).toBe(4);
    });

    test('commands have actions attached', async () => {
      const { registerAliasCommands } = await import(
        '../lib/commands/aliases.ts'
      );

      const program = new Command();
      registerAliasCommands(program);

      for (const cmd of program.commands) {
        // Commander stores actions in _actionHandler
        expect(
          (cmd as Command & { _actionHandler?: unknown })._actionHandler
        ).toBeDefined();
      }
    });
  });

  describe('scope option behavior', () => {
    test('install command scope option defaults to project', async () => {
      const { registerAliasCommands } = await import(
        '../lib/commands/aliases.ts'
      );

      const program = new Command();
      registerAliasCommands(program);

      const installCmd = program.commands.find(
        (cmd) => cmd.name() === 'install'
      );
      const scopeOption = installCmd?.options.find(
        (opt) => opt.long === '--scope'
      );

      expect(scopeOption?.defaultValue).toBe('project');
    });
  });
});
