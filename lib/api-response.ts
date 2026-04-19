import { NextResponse } from "next/server";
import { type ZodError } from "zod";

type FieldErrors = Record<string, string[] | undefined>;

export function errorResponse(
  message: string,
  status: number,
  options?: {
    fieldErrors?: FieldErrors;
  }
) {
  return NextResponse.json(
    {
      message,
      fieldErrors: options?.fieldErrors ?? {}
    },
    { status }
  );
}

export function zodErrorResponse(message: string, error: ZodError, status = 400) {
  return errorResponse(message, status, {
    fieldErrors: error.flatten().fieldErrors
  });
}

export async function readApiMessage(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as {
      message?: unknown;
      error?: unknown;
    };

    if (typeof payload.message === "string" && payload.message.trim()) {
      return payload.message.trim();
    }

    if (typeof payload.error === "string" && payload.error.trim()) {
      return payload.error.trim();
    }
  } catch {
    return fallback;
  }

  return fallback;
}

export async function readApiError(
  response: Response,
  fallback: string
): Promise<{
  message: string;
  fieldErrors: Record<string, string[]>;
}> {
  try {
    const payload = (await response.json()) as {
      message?: unknown;
      error?: unknown;
      fieldErrors?: Record<string, unknown>;
    };

    const message =
      typeof payload.message === "string" && payload.message.trim()
        ? payload.message.trim()
        : typeof payload.error === "string" && payload.error.trim()
          ? payload.error.trim()
          : fallback;

    const fieldErrors = Object.fromEntries(
      Object.entries(payload.fieldErrors ?? {}).map(([key, value]) => [
        key,
        Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
      ])
    );

    return {
      message,
      fieldErrors
    };
  } catch {
    return {
      message: fallback,
      fieldErrors: {}
    };
  }
}
