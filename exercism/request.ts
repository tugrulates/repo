// deno-lint-ignore-file no-console
/* eslint-disable @typescript-eslint/naming-convention */

import { retry, type RetryOptions } from "@std/async";
import { name, version } from "./app.ts";
import { RequestError } from "./error.ts";
import { messages } from "./strings.ts";

const TOO_MANY_REQUESTS = 429;

export type RequestMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
export interface RequestOptions {
  token?: string;
  body?: string;
  allowedErrors?: string[];
  retry?: RetryOptions;
}

interface ResponseError {
  type: string;
  message: string;
}

export async function request(
  url: string,
  method: RequestMethod,
  options: RequestOptions = {},
): Promise<{
  response: Response;
  error?: ResponseError;
}> {
  const { allowedErrors = [] } = options;
  const auth = options.token !== undefined
    ? { Authorization: `Bearer ${options.token}` }
    : {};

  const response = await retry(async () => {
    const response = await fetch(url, {
      method,
      headers: {
        ...auth,
        "Content-Type": "application/json",
        "User-Agent": `${name} ${version}`,
      },
      body: options.body ?? null,
    });
    if (response.status === TOO_MANY_REQUESTS) {
      await response.body?.cancel();
      throw new Error("Too many requests");
    }
    return response;
  }, options.retry);
  console.debug(messages.request.made({ method, url }, response));

  if (!response.ok) {
    const error = await responseError(response);
    if (allowedErrors.includes(error.type)) {
      return { response, error };
    }
    throw new RequestError(messages.request.error(error));
  }

  return { response };
}

async function responseError(response: Response): Promise<ResponseError> {
  const text = await response.text();
  try {
    const { error } = JSON.parse(text) as {
      error: { type: string; message: string };
    };
    return error;
  } catch {
    return {
      type: response.status.toString(),
      message: response.statusText,
    };
  }
}
