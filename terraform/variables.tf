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
  description = "Optional full upstream GraphQL URL override. When empty, Terraform derives this from UPSTREAM_DNS_NAME, domain, and UPSTREAM_GRAPHQL_PATH."
  type        = string
  nullable    = false
  default     = ""
  validation {
    condition     = trimspace(var.UPSTREAM_GRAPHQL_URL) == "" || can(regex("^https://", trimspace(var.UPSTREAM_GRAPHQL_URL)))
    error_message = "UPSTREAM_GRAPHQL_URL must be empty or an https URL."
  }
}

variable "MANAGE_UPSTREAM_DNS_RECORD" {
  description = "Deprecated compatibility variable. Upstream DNS records are owned by global-terraform-workspace and are not managed by this workspace."
  type        = bool
  nullable    = false
  default     = false
}

variable "UPSTREAM_SHARED_OWNER_ENVIRONMENT" {
  description = "Deprecated compatibility variable. Shared upstream DNS and tunnel resources are owned by global-terraform-workspace."
  type        = string
  nullable    = false
  default     = "dev"
}

variable "UPSTREAM_DNS_NAME" {
  description = "Relative DNS name for the externally managed upstream GraphQL record in this zone."
  type        = string
  nullable    = false
  default     = "graphql-origin"
}

variable "UPSTREAM_TUNNEL_ID" {
  description = "Deprecated compatibility variable. The upstream tunnel is owned by global-terraform-workspace."
  type        = string
  nullable    = false
  default     = "69517d80-2079-43f1-97f7-cfd716298c50"
}

variable "MANAGE_UPSTREAM_TUNNEL_CONFIG" {
  description = "Deprecated compatibility variable. Upstream tunnel ingress config is owned by global-terraform-workspace and is not managed by this workspace."
  type        = bool
  nullable    = false
  default     = false
}

variable "UPSTREAM_TUNNEL_SERVICE" {
  description = "Deprecated compatibility variable. The upstream tunnel service is configured in global-terraform-workspace."
  type        = string
  nullable    = false
  default     = "http://hasura.graphql.svc.cluster.local:8080"
}

variable "UPSTREAM_ORIGIN_IP" {
  description = "Deprecated compatibility variable. The upstream origin record is configured in global-terraform-workspace."
  type        = string
  nullable    = false
  default     = "64.251.17.245"
}

variable "UPSTREAM_GRAPHQL_PATH" {
  description = "Path appended to the managed upstream hostname"
  type        = string
  nullable    = false
  default     = "/v1/graphql"
  validation {
    condition     = startswith(var.UPSTREAM_GRAPHQL_PATH, "/")
    error_message = "UPSTREAM_GRAPHQL_PATH must start with '/'."
  }
}

variable "UPSTREAM_DIRECTUS_ASSET_BASE_URL" {
  description = "Base URL for Directus asset passthrough (used by /directus/assets/* proxy route)."
  type        = string
  nullable    = false
  default     = ""
}

variable "UPSTREAM_DIRECTUS_ASSET_PATH" {
  description = "Path prefix appended to UPSTREAM_DIRECTUS_ASSET_BASE_URL for asset passthrough requests."
  type        = string
  nullable    = false
  default     = "/assets"

  validation {
    condition     = startswith(var.UPSTREAM_DIRECTUS_ASSET_PATH, "/")
    error_message = "UPSTREAM_DIRECTUS_ASSET_PATH must start with '/'."
  }
}

variable "DIRECTUS_ASSET_PROXY_PREFIX" {
  description = "Public path prefix exposed by this Worker for Directus asset passthrough."
  type        = string
  nullable    = false
  default     = "/directus/assets"

  validation {
    condition     = startswith(var.DIRECTUS_ASSET_PROXY_PREFIX, "/")
    error_message = "DIRECTUS_ASSET_PROXY_PREFIX must start with '/'."
  }
}

variable "UPSTREAM_TIMEOUT_MS" {
  description = "Upstream fetch timeout in milliseconds"
  type        = number
  nullable    = false
  default     = 120000
}

variable "ALLOWED_HOSTS" {
  description = "Comma-separated additional CORS origins (exact or wildcard patterns); Terraform also appends *.<domain> automatically"
  type        = string
  nullable    = false
  default     = "*.suncoast.systems"
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
