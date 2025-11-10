/** biome-ignore-all lint/suspicious/noExplicitAny: <> */
import { tool } from "ai";
import axios from "axios";
import { z } from "zod";

// simple in Memory Cache to avoid duplicate requests
const cache = new Map<string, { data: string; expires: number }>();

const weatherSchema = z.object({
  city: z
    .string()
    .min(2, "City name must be at least 2 characters long.")
    .refine(
      (city) => /^[a-zA-Z\s-]+$/.test(city),
      "City name must contain only letters, spaces, or hyphens.",
    )
    .describe("The city to get the weather for."),
});

export const getWeather = tool({
  name: "get_weather_tool",
  description:
    "Get the current weather conditions and temperature for a specific city",
  inputSchema: weatherSchema,
  execute: async ({ city }) => {
    const normalizedCity = city.trim().toLowerCase();
    const cacheKey = normalizedCity;

    // 1. Check cache
    const cached = cache.get(cacheKey);
    const now = Date.now();

    if (cached && cached.expires > now) {
      return {
        city,
        result: cached.data,
        source: "cache",
      };
    }

    // 2. Timeout + Retry logic
    const maxRetries = 3;
    const backoffBase = 200; // ms
    const timeoutMs = 5000; // 5 secconds

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => {
          controller.abort();
        }, timeoutMs);

        const response = await axios.get(
          `https://wttr.in/${encodeURIComponent(normalizedCity)}?format=%C+%t`,
          {
            responseType: "text",
            signal: controller.signal,
            validateStatus: (status) => status >= 200 && status < 500, // reject 5xx
          },
        );
        clearTimeout(timeout);

        // 3. Validate Response
        if (response.status >= 400) {
          if (response.status === 404) {
            return {
              city,
              error: `No weather data found for ${city}. Please check the spelling or try a major city`,
            };
          }
          throw new Error(`Weather API error: ${response.status}`);
        }

        const result = response.data.trim();
        if (!result || result.toLowerCase().includes("unknown")) {
          return {
            city,
            erro: `No Weather data available for ${city}`,
          };
        }

        // 4. Cached the successfull result (15 min)
        cache.set(cacheKey, {
          data: result,
          expires: now + 15 * 60 * 1000,
        });

        return {
          city,
          result,
          source: "api",
        };
      } catch (error: any) {
        lastError = error;
        const isTimeout =
          error.name === "CanceledError" || // Axios throws this when a request is aborted using an AbortController
          error.code === "ECONNABORTED"; // Axios sets this code when a timeout occurs (common in Node.js)

        // Determine whether the error is "transient" — i.e., temporary and worth retrying.
        // Transient errors usually mean the network or remote server had a hiccup rather than a fatal problem.
        // Common transient cases include:
        //   429 → Too Many Requests (rate-limited)
        //   500 → Internal Server Error
        //   502 → Bad Gateway (intermediate server failed)
        //   503 → Service Unavailable (temporary outage)
        //   504 → Gateway Timeout
        // The expression `error.response?.status ?? 0` safely reads the HTTP status code,
        // defaulting to 0 if no response object exists (e.g., when the connection never opened).
        const isTransient =
          isTimeout ||
          [429, 500, 502, 503, 504].includes(error.response?.status ?? 0);

        // If the error looks transient (e.g., timeout or 5xx) and we still have retries left,
        // wait briefly before trying again. This uses "exponential backoff":
        // each retry waits twice as long as the previous one to avoid hammering the API.
        // Example with backoffBase = 200 ms:
        //   attempt 1 → wait 200 ms
        //   attempt 2 → wait 400 ms
        //   attempt 3 → wait 800 ms
        // This strategy gives unreliable networks or overloaded servers time to recover,
        // reducing the chance of repeated identical failures.
        if (attempt < maxRetries && isTransient) {
          const delay = backoffBase * 2 ** (attempt - 1);
          await new Promise((res) => setTimeout(res, delay));
          continue; // try the request again after the delay
        }
        if (!isTransient)
          // If not transient, fail gracefully
          break;
      }
    }

    // 5. Graceful fallback
    const code = (lastError as any)?.code;

    return {
      city,
      error: `Unable to fetch weather for "${city}". ${
        lastError?.message?.includes("abort") || code === "ECONNABORTED"
          ? "Request timed out."
          : "The weather service is currently unavailable."
      } Please try again later.`,
    };
  },
});
