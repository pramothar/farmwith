import type { AuthConfig, MessageResponse, TokenResponse, UserProfile } from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "https://api.farmwith.online";

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

export async function login(data: { email: string; password: string; remember: boolean }): Promise<TokenResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<TokenResponse>(response);
}

export async function forgotPassword(email: string): Promise<MessageResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/forgot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return handleResponse<MessageResponse>(response);
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
