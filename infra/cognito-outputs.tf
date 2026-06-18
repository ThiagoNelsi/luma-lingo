output "application_id" {
  description = "Service Catalog AppRegistry application id."
  value       = aws_servicecatalogappregistry_application.luma_lingo.id
}

output "application_name" {
  description = "Service Catalog AppRegistry application name."
  value       = aws_servicecatalogappregistry_application.luma_lingo.name
}

output "aws_region" {
  description = "AWS region containing the Cognito resources."
  value       = var.aws_region
}

output "cognito_user_pool_id" {
  description = "Cognito user pool id."
  value       = aws_cognito_user_pool.this.id
}

output "cognito_user_pool_arn" {
  description = "Cognito user pool ARN."
  value       = aws_cognito_user_pool.this.arn
}

output "cognito_app_client_id" {
  description = "Cognito app client id used to start managed-login redirects."
  value       = aws_cognito_user_pool_client.web.id
}

output "cognito_app_client_secret" {
  description = "Cognito app client secret for backend token exchange. Store in the API secret manager, not frontend config."
  value       = aws_cognito_user_pool_client.web.client_secret
  sensitive   = true
}

output "cognito_domain" {
  description = "Cognito managed-login domain."
  value       = "https://${aws_cognito_user_pool_domain.managed_login.domain}.auth.${var.aws_region}.amazoncognito.com"
}

output "oauth_callback_urls" {
  description = "Backend OAuth callback URLs registered with Cognito."
  value       = var.callback_urls
}

output "oauth_logout_urls" {
  description = "Logout return URLs registered with Cognito."
  value       = var.logout_urls
}

output "frontend_origin" {
  description = "Frontend browser origin."
  value       = var.frontend_origin
}

output "api_origin" {
  description = "API browser origin."
  value       = var.api_origin
}

output "session_cookie_name" {
  description = "App-owned opaque session id cookie name."
  value       = var.session_cookie_name
}

output "session_cookie_secure" {
  description = "Whether the app should mark the session cookie Secure."
  value       = var.session_cookie_secure
}