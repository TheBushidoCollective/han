import type { Command } from 'commander';
import {
  COORDINATOR_SHA256,
  HAN_BUILD_KIND,
  HAN_VERSION,
} from '../../build-info.generated.ts';

export function registerCoordinatorPinCommand(coordinator: Command): void {
  coordinator
    .command('pin')
    .description('Print build kind, version, and pinned coordinator SHA-256')
    .option('--json', 'Output as JSON')
    .action((options: { json?: boolean }) => {
      const data = {
        buildKind: HAN_BUILD_KIND,
        version: HAN_VERSION,
        coordinatorSha256: COORDINATOR_SHA256,
      };
      if (options.json) {
        console.log(JSON.stringify(data));
      } else {
        console.log(`Build kind: ${data.buildKind}`);
        console.log(`Version: ${data.version}`);
        console.log(`Coordinator SHA-256: ${data.coordinatorSha256 ?? 'none'}`);
      }
    });
}
