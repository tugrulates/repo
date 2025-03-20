export class CommandFailed extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "CommandFailed";
  }
}

export class InvalidConfig extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "InvalidConfig";
  }
}

export class RequestError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "RequestError";
  }
}
