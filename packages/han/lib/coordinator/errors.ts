export class CoordinatorSecurityError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'CoordinatorSecurityError';
  }
}

export class CoordinatorConnectionRefusedError extends CoordinatorSecurityError {
  constructor(message: string, options: ErrorOptions) {
    super(message, options);
    this.name = 'CoordinatorConnectionRefusedError';
  }
}
