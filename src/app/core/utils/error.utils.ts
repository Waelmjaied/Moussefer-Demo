/**
 * Centralized HTTP-error message extraction for the Moussefer
 * frontend.
 *
 * <p>The backend (Spring Boot 3) responds with RFC 7807
 * {@link https://datatracker.ietf.org/doc/html/rfc7807 | ProblemDetail}
 * for {@code @RestControllerAdvice}-handled exceptions. The body
 * shape is:</p>
 *
 * <pre>
 * {
 *   "type":   "about:blank",
 *   "title":  "Bad Request",
 *   "status": 400,
 *   "detail": "You already have an open dispute on this reservation",
 *   "timestamp": "2026-06-09T17:43:11Z"
 * }
 * </pre>
 *
 * <p>The user-facing message lives in {@code detail}, not
 * {@code message} — which is why the previous frontend code
 * ({@code err.error?.message}) always fell through to its generic
 * fallback string. Bean Validation errors additionally surface a
 * {@code errors[]} array with field-level messages.</p>
 *
 * <p>Use {@link extractErrorMessage} everywhere we used to write
 * {@code err.error?.message || 'fallback'}.</p>
 */
import { HttpErrorResponse } from '@angular/common/http';

interface ProblemDetail {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  message?: string; // legacy / non-Spring errors
  errors?: Array<{ field?: string; defaultMessage?: string; message?: string }>;
  timestamp?: string;
}

/**
 * Returns a human-readable error message from any HttpErrorResponse,
 * preferring (in order):
 *   1. Bean Validation field errors joined as bullets
 *   2. ProblemDetail.detail
 *   3. Legacy .message
 *   4. The supplied fallback
 */
export function extractErrorMessage(err: unknown, fallback = 'Une erreur est survenue'): string {
  if (!err) return fallback;

  // Plain string thrown somewhere
  if (typeof err === 'string') return err;

  // Angular HttpErrorResponse
  if (err instanceof HttpErrorResponse) {
    return readProblemDetail(err.error) ?? fallback;
  }

  // Anything else that looks like { error: ... }
  const anyErr = err as { error?: unknown; message?: string };
  if (anyErr.error) {
    const msg = readProblemDetail(anyErr.error);
    if (msg) return msg;
  }
  if (anyErr.message) return anyErr.message;

  return fallback;
}

function readProblemDetail(body: unknown): string | null {
  if (!body) return null;
  if (typeof body === 'string') return body;

  const pd = body as ProblemDetail;

  // Bean Validation: surface every field error
  if (Array.isArray(pd.errors) && pd.errors.length > 0) {
    return pd.errors
      .map((e) => e.defaultMessage || e.message || '')
      .filter(Boolean)
      .join(' • ');
  }

  return pd.detail ?? pd.message ?? null;
}
