/** An error thrown when a command fails. */
export class CommandFailed extends Error {
  /** Construct CommandFailed. */
  constructor(msg: string) {
    super(msg);
    this.name = "CommandFailed";
  }
}

/** An error thrown when the configuration is invalid. */
export class InvalidConfig extends Error {
  /** Construct InvalidConfig. */
  constructor(msg: string) {
    super(msg);
    this.name = "InvalidConfig";
  }
}

/** An error thrown by the Exercism client. */
export class RequestError extends Error {
  /** Construct RequestError. */
  constructor(msg: string) {
    super(msg);
    this.name = "RequestError";
  }
}
