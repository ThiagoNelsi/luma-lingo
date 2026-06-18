variable "project_name" {
  description = "Short project name used in AWS resource names."
  type        = string
  default     = "luma-lingo"
}

variable "environment" {
  description = "Deployment environment name."
  type        = string
  default     = "dev"
}

variable "aws_region" {
  description = "AWS region for Cognito resources."
  type        = string
  default     = "us-east-1"
}

variable "cognito_domain_prefix" {
  description = "Globally unique Cognito prefix domain. Do not include aws, amazon, or cognito."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$", var.cognito_domain_prefix))
    error_message = "Use 3-63 lowercase letters, numbers, and hyphens, starting and ending with a letter or number."
  }
}

variable "callback_urls" {
  description = "Allowed backend OAuth callback URLs."
  type        = list(string)
}

variable "logout_urls" {
  description = "Allowed app URLs Cognito can redirect to after logout."
  type        = list(string)
}

variable "frontend_origin" {
  description = "Browser origin for the web app."
  type        = string
}

variable "api_origin" {
  description = "Browser origin for the backend API."
  type        = string
}

variable "session_cookie_name" {
  description = "Name of the app-owned opaque session id cookie."
  type        = string
  default     = "luma_lingo_session"
}

variable "session_cookie_secure" {
  description = "Whether the app session cookie must be marked Secure. Use false only for localhost development."
  type        = bool
  default     = true
}

variable "enable_google_idp" {
  description = "Enable Google as a Cognito social identity provider."
  type        = bool
  default     = false
}

variable "google_client_id" {
  description = "Google OAuth client id for Cognito federation. Required when enable_google_idp is true."
  type        = string
  default     = null
  sensitive   = true
}

variable "google_client_secret" {
  description = "Google OAuth client secret for Cognito federation. Required when enable_google_idp is true."
  type        = string
  default     = null
  sensitive   = true
}
