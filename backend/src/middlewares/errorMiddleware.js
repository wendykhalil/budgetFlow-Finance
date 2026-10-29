// Express needs four arguments to recognize this as error-handling middleware.
function errorMiddleware(error, req, res, next) {
  let statusCode = error.statusCode || error.status || 500;
  let message = error.message || 'Server error.';

  if (error.type === 'entity.too.large') {
    statusCode = 413;
    message = 'Request body is too large.';
  } else if (error instanceof SyntaxError && error.status === 400) {
    statusCode = 400;
    message = 'Invalid request JSON.';
  } else if (error.name === 'ValidationError' || error.name === 'CastError') {
    statusCode = 400;
    message = error.name === 'ValidationError' ? 'Invalid input.' : 'Invalid identifier.';
  } else if (error.code === 11000) {
    statusCode = 409;
    message = 'An account with this email already exists.';
  } else if (statusCode >= 500) {
    message = 'Server error.';
  }

  res.status(statusCode).json({ message });
}

module.exports = errorMiddleware;
