variable "cloudflare_account_id" {
  description = "Cloudflare account id"
  type        = string
  nullable    = false
}

variable "domain" {
  description = "domain"
  type        = string
  nullable    = false
}

variable "cloudflare_zone_id" {
  description = "cloudflare worker zone id"
  type        = string
  nullable    = false
}

variable "cloudflare_token" {
  description = "cloudflare token"
  type        = string
  nullable    = false
}

variable "project_name" {
  description = "project name"
  type        = string
  nullable    = false
}

variable "UPSTREAM_GRAPHQL_URL" {
  description = "HTTPS URL for upstream GraphQL endpoint in k8s"
  type        = string
  nullable    = false
}

variable "ALLOWED_HOSTS" {
  description = "Comma-separated allowed CORS origins"
  type        = string
  nullable    = false
}

variable "CACHE_ENABLED" {
  description = "Enable cache for unauthenticated query operations"
  type        = bool
  nullable    = false
  default     = true
}

variable "CACHE_TTL_SECONDS" {
  description = "Edge cache ttl in seconds"
  type        = number
  nullable    = false
  default     = 60
}

variable "CACHE_STALE_WHILE_REVALIDATE_SECONDS" {
  description = "stale-while-revalidate window in seconds"
  type        = number
  nullable    = false
  default     = 30
}

variable "CACHE_INCLUDE_GRAPHQL_ERRORS" {
  description = "Whether 200 responses containing GraphQL errors should be cached"
  type        = bool
  nullable    = false
  default     = false
}

variable "environment" {
  description = "Environment"
  type        = string
  nullable    = false
}

variable "VERSION" {
  description = "Version"
  type        = string
  nullable    = false
}
