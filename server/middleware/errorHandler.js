function notFoundHandler(req, res, next) {
  if (res.headersSent) {
    return next();
  }
  res.status(404).json({ message: `Route not found: ${req.originalUrl}` });
}

function errorHandler(err, _req, res, _next) {
  const status = err.status || 500;
  const message = err.message || "Internal server error";

  if (status >= 500) {
    console.error("Unhandled error:", err);
  }

  res.status(status).json({ message });
}

module.exports = { notFoundHandler, errorHandler };
