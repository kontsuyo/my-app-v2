"use client";

import { getAccessToken } from "@/lib/auth-tokens";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1"
).replace(/\/+$/, "");

type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

export class ApiError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(status: number, details: unknown) {
    const message =
      typeof details === "object" &&
      details !== null &&
      "detail" in details &&
      typeof details.detail === "string"
        ? details.detail
        : typeof details === "string" && details.length > 0
          ? details
          : `API request failed with status ${status}`;

    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { body, headers: requestHeaders, ...requestOptions } = options;
  const headers = new Headers(requestHeaders);
  const accessToken = getAccessToken();

  if (accessToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  let requestBody: BodyInit | undefined;
  if (body !== undefined) {
    if (
      typeof body === "string" ||
      body instanceof Blob ||
      body instanceof FormData ||
      body instanceof URLSearchParams
    ) {
      requestBody = body;
    } else {
      headers.set("Content-Type", "application/json");
      requestBody = JSON.stringify(body);
    }
  }

  const response = await fetch(
    `${API_BASE_URL}/${path.replace(/^\/+/, "")}`,
    {
      ...requestOptions,
      headers,
      body: requestBody,
    },
  );

  if (response.status === 204) {
    return undefined as T;
  }

  const responseText = await response.text();
  const contentType = response.headers.get("Content-Type") ?? "";
  const payload =
    responseText.length === 0
      ? null
      : contentType.includes("json")
        ? JSON.parse(responseText)
        : responseText;

  if (!response.ok) {
    throw new ApiError(response.status, payload);
  }

  return payload as T;
}
