import { ZodError } from "zod";

export function errorHandler(error, _request, response, _next) {
  if (error instanceof ZodError) {
    response.status(400).json({
      error: "Validation failed",
      details: error.issues
    });
    return;
  }

  response.status(error.status ?? 500).json({
    error: error.message ?? "Internal server error",
    ...(error.code ? { code: error.code } : {}),
    ...(error.payment ? { payment: error.payment } : {}),
    ...(error.subscription ? { subscription: error.subscription } : {})
  });
}
