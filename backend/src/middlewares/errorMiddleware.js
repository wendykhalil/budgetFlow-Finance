// Express needs four arguments to recognize this as error-handling middleware.
function errorMiddleware(error, req, res, next) {
  const statusCode = error.status || 500;
  let message = 'Server error.';

  if (statusCode < 500) {
    message = 'Invalid request.';
  }

  res.status(statusCode).json({ message });
}

module.exports = errorMiddleware;
