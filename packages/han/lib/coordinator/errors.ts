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

export class CoordinatorPortOccupiedError extends CoordinatorSecurityError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'CoordinatorPortOccupiedError';
  }
}

export class CoordinatorBinaryMissingError extends CoordinatorSecurityError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'CoordinatorBinaryMissingError';
  }
}
