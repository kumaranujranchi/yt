export class ValidationError extends Error {
  public statusCode: number;
  public details?: any;

  constructor(message: string, details?: any) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.details = details;
  }
}

export class DownloadError extends Error {
  public statusCode: number;
  public details?: any;

  constructor(message: string, details?: any) {
    super(message);
    this.name = 'DownloadError';
    this.statusCode = 422;
    this.details = details;
  }
}

export class NotFoundError extends Error {
  public statusCode: number;

  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

export class RateLimitError extends Error {
  public statusCode: number;
  public retryAfter: number;

  constructor(message: string, retryAfter: number) {
    super(message);
    this.name = 'RateLimitError';
    this.statusCode = 429;
    this.retryAfter = retryAfter;
  }
}

export class AuthenticationError extends Error {
  public statusCode: number;

  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
    this.statusCode = 401;
  }
}

export class AuthorizationError extends Error {
  public statusCode: number;

  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationError';
    this.statusCode = 403;
  }
}

// Error handler middleware
export const errorHandler = (error: any, req: any, res: any, next: any) => {
  let statusCode = 500;
  let message = 'Internal server error';
  let details = undefined;

  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = error.message;
    details = error.details;
  } else if (error.name === 'DownloadError') {
    statusCode = 422;
    message = error.message;
    details = error.details;
  } else if (error.name === 'NotFoundError') {
    statusCode = 404;
    message = error.message;
  } else if (error.name === 'RateLimitError') {
    statusCode = 429;
    message = error.message;
    res.set('Retry-After', error.retryAfter.toString());
  } else if (error.name === 'AuthenticationError') {
    statusCode = 401;
    message = error.message;
  } else if (error.name === 'AuthorizationError') {
    statusCode = 403;
    message = error.message;
  }

  // Don't leak error details in production
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    details = undefined;
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(details && { details }),
    ...(process.env.NODE_ENV !== 'production' && { 
      stack: error.stack 
    })
  });
};