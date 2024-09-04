export class ResponseStatusException extends Error {
  status: number;
  detail?: string;

  constructor(status: number, message: string, detail?: string) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

export class BadRequestException extends ResponseStatusException {
  constructor(detail: string) {
    super(400, "Bad request", detail);
  }
}

export class NotFoundException extends ResponseStatusException {
  constructor(detail: string) {
    super(404, "Not found", detail);
  }
}

export class InternalServerErrorException extends ResponseStatusException {
  constructor(detail: string) {
    super(500, "Internal server error", detail);
  }
}