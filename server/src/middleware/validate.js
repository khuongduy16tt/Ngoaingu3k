/**
 * Simple request validation middleware.
 * Checks required body fields and returns 400 if any are missing.
 *
 * Usage:
 *   app.post('/api/foo', validate(['email', 'password']), handler);
 */
export function validate(requiredFields) {
  return (req, res, next) => {
    const missing = requiredFields.filter((field) => {
      const value = req.body?.[field];
      return value === undefined || value === null || value === '';
    });

    if (missing.length > 0) {
      return res.status(400).json({
        message: 'Thiếu dữ liệu bắt buộc.',
        missingFields: missing,
      });
    }

    return next();
  };
}
