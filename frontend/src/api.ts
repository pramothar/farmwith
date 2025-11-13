import type { AuthConfig, MFASetupResponse, MessageResponse, TokenResponse, UserProfile } from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://15.207.115.64:8000";

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Request failed");
  }
  if (response.status === 204) {
    return null as T;
  }
  return (await response.json()) as T;
}

export async function register(data: { email: string; password: string }): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  await handleResponse(response);
}

export async function login(data: { email: string; password: string; totp_code?: string }): Promise<TokenResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<TokenResponse>(response);
}

export async function fetchConfig(): Promise<AuthConfig> {
  const response = await fetch(`${API_BASE_URL}/auth/config`);
  return handleResponse<AuthConfig>(response);
}

export async function fetchProfile(token: string): Promise<UserProfile> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<UserProfile>(response);
}

export function getSsoLoginUrl() {
  return `${API_BASE_URL}/auth/sso/login`;
}

export async function initiateMfa(token: string): Promise<MFASetupResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/mfa/setup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  return handleResponse<MFASetupResponse>(response);
}

export async function verifyMfa(token: string, code: string): Promise<MessageResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/mfa/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ code }),
  });
  return handleResponse<MessageResponse>(response);
}
