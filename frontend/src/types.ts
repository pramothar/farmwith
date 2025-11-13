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
  mfa_enabled: boolean;
  created_at: string;
}

export interface MFASetupResponse {
  secret: string;
  otpauth_url: string;
}

export interface MessageResponse {
  detail: string;
}
