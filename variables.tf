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
  description = "Full upstream GraphQL URL (used only when MANAGE_UPSTREAM_DNS_RECORD=false)"
  type        = string
  nullable    = false
  default     = ""
  validation {
    condition     = var.MANAGE_UPSTREAM_DNS_RECORD || can(regex("^https://", trimspace(var.UPSTREAM_GRAPHQL_URL)))
    error_message = "UPSTREAM_GRAPHQL_URL must be an https URL when MANAGE_UPSTREAM_DNS_RECORD is false."
  }
}

variable "MANAGE_UPSTREAM_DNS_RECORD" {
  description = "Whether Terraform should manage a proxied Cloudflare DNS record for upstream GraphQL"
  type        = bool
  nullable    = false
  default     = true
}

variable "UPSTREAM_DNS_NAME" {
  description = "Relative DNS name for upstream GraphQL record in this zone (example: graphql-origin)"
  type        = string
  nullable    = false
  default     = "graphql-origin"
}

variable "UPSTREAM_TUNNEL_ID" {
  description = "Cloudflare Tunnel UUID used for managed upstream DNS CNAME (<uuid>.cfargotunnel.com). Leave empty to use A record to UPSTREAM_ORIGIN_IP."
  type        = string
  nullable    = false
  default     = "69517d80-2079-43f1-97f7-cfd716298c50"
  validation {
    condition = (
      length(trimspace(var.UPSTREAM_TUNNEL_ID)) == 0 ||
      can(regex("^[0-9a-fA-F-]{36}$", trimspace(var.UPSTREAM_TUNNEL_ID)))
    )
    error_message = "UPSTREAM_TUNNEL_ID must be a valid tunnel UUID (or empty)."
  }
}

variable "MANAGE_UPSTREAM_TUNNEL_CONFIG" {
  description = "Whether Terraform should manage Cloudflare Tunnel ingress config for UPSTREAM_DNS_NAME on UPSTREAM_TUNNEL_ID"
  type        = bool
  nullable    = false
  default     = true
  validation {
    condition     = !var.MANAGE_UPSTREAM_TUNNEL_CONFIG || length(trimspace(var.UPSTREAM_TUNNEL_ID)) > 0
    error_message = "UPSTREAM_TUNNEL_ID is required when MANAGE_UPSTREAM_TUNNEL_CONFIG is true."
  }
}

variable "UPSTREAM_TUNNEL_SERVICE" {
  description = "Tunnel origin service URL for upstream hostname (example: http://apisix.gateway.svc.cluster.local:80)"
  type        = string
  nullable    = false
  default     = "http://hasura.graphql.svc.cluster.local:8080"
  validation {
    condition     = !var.MANAGE_UPSTREAM_TUNNEL_CONFIG || length(trimspace(var.UPSTREAM_TUNNEL_SERVICE)) > 0
    error_message = "UPSTREAM_TUNNEL_SERVICE is required when MANAGE_UPSTREAM_TUNNEL_CONFIG is true."
  }
  validation {
    condition = (
      !var.MANAGE_UPSTREAM_TUNNEL_CONFIG ||
      can(regex("^https?://", trimspace(var.UPSTREAM_TUNNEL_SERVICE)))
    )
    error_message = "UPSTREAM_TUNNEL_SERVICE must start with http:// or https:// when MANAGE_UPSTREAM_TUNNEL_CONFIG is true."
  }
}

variable "UPSTREAM_ORIGIN_IP" {
  description = "Origin IPv4 address for managed upstream A record fallback (used when UPSTREAM_TUNNEL_ID is empty)"
  type        = string
  nullable    = false
  default     = "64.251.17.245"
  validation {
    condition = (
      !var.MANAGE_UPSTREAM_DNS_RECORD ||
      length(trimspace(var.UPSTREAM_TUNNEL_ID)) > 0 ||
      length(trimspace(var.UPSTREAM_ORIGIN_IP)) > 0
    )
    error_message = "When MANAGE_UPSTREAM_DNS_RECORD is true, set UPSTREAM_TUNNEL_ID or UPSTREAM_ORIGIN_IP."
  }
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

variable "UPSTREAM_TIMEOUT_MS" {
  description = "Upstream fetch timeout in milliseconds"
  type        = number
  nullable    = false
  default     = 15000
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
