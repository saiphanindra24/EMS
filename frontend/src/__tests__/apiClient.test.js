import { describe, it, expect, beforeEach } from "vitest";
import { formatApiError, setAccessToken, getAccessToken } from "../services/apiClient";

describe("apiClient and formatApiError", () => {
  beforeEach(() => {
    setAccessToken(null);
  });

  it("manages in-memory access token correctly", () => {
    expect(getAccessToken()).toBeNull();
    setAccessToken("test-jwt-token-xyz");
    expect(getAccessToken()).toBe("test-jwt-token-xyz");
    setAccessToken(null);
    expect(getAccessToken()).toBeNull();
  });

  it("formats string errors directly", () => {
    expect(formatApiError("Direct error message")).toBe("Direct error message");
  });

  it("handles null or undefined error with fallback", () => {
    expect(formatApiError(null)).toBe("An unexpected error occurred.");
    expect(formatApiError(undefined)).toBe("An unexpected error occurred.");
  });

  it("extracts detail from DRF response data", () => {
    const error = {
      response: {
        data: {
          detail: "Invalid credentials provided.",
        },
      },
    };
    expect(formatApiError(error)).toBe("Invalid credentials provided.");
  });

  it("extracts non_field_errors array from DRF response", () => {
    const error = {
      response: {
        data: {
          non_field_errors: ["Account is temporarily deactivated.", "Contact administrator."],
        },
      },
    };
    expect(formatApiError(error)).toBe("Account is temporarily deactivated. Contact administrator.");
  });

  it("formats field-specific validation dictionary errors", () => {
    const error = {
      response: {
        data: {
          email: ["Enter a valid email address."],
          password: ["Password must be at least 8 characters."],
        },
      },
    };
    const result = formatApiError(error);
    expect(result).toContain("email: Enter a valid email address.");
    expect(result).toContain("password: Password must be at least 8 characters.");
  });

  it("falls back to error.message if response data is missing", () => {
    const error = new Error("Network timeout connecting to server");
    expect(formatApiError(error)).toBe("Network timeout connecting to server");
  });
});
