export interface AuthConfig {
  enable_sso: boolean;
  oidc_provider_name: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface UserProfile {
  id: string;
  email: string;
  created_at: string;
}
export interface MessageResponse {
  detail: string;
}
