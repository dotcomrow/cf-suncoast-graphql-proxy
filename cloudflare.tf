locals {
  upstream_hostname               = "${var.UPSTREAM_DNS_NAME}.${var.domain}"
  normalized_environment          = lower(trimspace(var.environment))
  normalized_shared_owner_env     = lower(trimspace(var.UPSTREAM_SHARED_OWNER_ENVIRONMENT))
  is_shared_upstream_owner        = local.normalized_environment == local.normalized_shared_owner_env
  manage_shared_upstream_dns      = var.MANAGE_UPSTREAM_DNS_RECORD && local.is_shared_upstream_owner
  manage_shared_upstream_tunnel   = var.MANAGE_UPSTREAM_TUNNEL_CONFIG && local.is_shared_upstream_owner
  trimmed_upstream_tunnel_id      = trimspace(var.UPSTREAM_TUNNEL_ID)
  trimmed_upstream_tunnel_service = trimspace(var.UPSTREAM_TUNNEL_SERVICE)
  use_upstream_tunnel             = length(local.trimmed_upstream_tunnel_id) > 0
  upstream_dns_record_type        = local.use_upstream_tunnel ? "CNAME" : "A"
  upstream_dns_record_value       = local.use_upstream_tunnel ? "${local.trimmed_upstream_tunnel_id}.cfargotunnel.com" : var.UPSTREAM_ORIGIN_IP
  upstream_graphql_url            = var.MANAGE_UPSTREAM_DNS_RECORD ? "https://${local.upstream_hostname}${var.UPSTREAM_GRAPHQL_PATH}" : var.UPSTREAM_GRAPHQL_URL
}

resource "cloudflare_dns_record" "upstream_origin" {
  count   = local.manage_shared_upstream_dns ? 1 : 0
  zone_id = var.cloudflare_zone_id
  name    = var.UPSTREAM_DNS_NAME
  type    = local.upstream_dns_record_type
  content = local.upstream_dns_record_value
  proxied = true
  ttl     = 1
}

resource "cloudflare_workers_custom_domain" "project_domain" {
  account_id = var.cloudflare_account_id
  hostname   = "${var.project_name}.${var.environment}.${var.domain}"
  service    = cloudflare_workers_script.project_script.script_name
  zone_id    = var.cloudflare_zone_id
}

resource "cloudflare_zero_trust_tunnel_cloudflared_config" "upstream_tunnel" {
  count      = local.manage_shared_upstream_tunnel ? 1 : 0
  account_id = var.cloudflare_account_id
  tunnel_id  = local.trimmed_upstream_tunnel_id

  config = {
    ingress = [
      {
        hostname = local.upstream_hostname
        service  = local.trimmed_upstream_tunnel_service
      },
      {
        service = "http_status:404"
      }
    ]
  }

  depends_on = [cloudflare_dns_record.upstream_origin]
}

resource "cloudflare_workers_route" "project_route" {
  zone_id  = var.cloudflare_zone_id
  pattern  = "${var.project_name}.${var.environment}.${var.domain}/*"
  script   = cloudflare_workers_script.project_script.script_name
}

resource "cloudflare_workers_script" "project_script" {
  account_id         = var.cloudflare_account_id
  script_name        = "${var.project_name}-${var.environment}"
  content_file       = "${path.module}/dist/index.mjs"
  content_sha256     = filesha256("${path.module}/dist/index.mjs")
  compatibility_date = "2023-08-28"
  main_module        = "index.mjs"
  depends_on         = [cloudflare_dns_record.upstream_origin]
  bindings = [
    {
      name = "CORS_DOMAINS"
      type = "plain_text"
      text = var.ALLOWED_HOSTS
    },
    {
      name = "VERSION"
      type = "plain_text"
      text = var.VERSION
    },
    {
      name = "UPSTREAM_GRAPHQL_URL"
      type = "plain_text"
      text = local.upstream_graphql_url
    },
    {
      name = "UPSTREAM_TIMEOUT_MS"
      type = "plain_text"
      text = tostring(var.UPSTREAM_TIMEOUT_MS)
    },
    {
      name = "CACHE_ENABLED"
      type = "plain_text"
      text = tostring(var.CACHE_ENABLED)
    },
    {
      name = "CACHE_TTL_SECONDS"
      type = "plain_text"
      text = tostring(var.CACHE_TTL_SECONDS)
    },
    {
      name = "CACHE_STALE_WHILE_REVALIDATE_SECONDS"
      type = "plain_text"
      text = tostring(var.CACHE_STALE_WHILE_REVALIDATE_SECONDS)
    },
    {
      name = "CACHE_INCLUDE_GRAPHQL_ERRORS"
      type = "plain_text"
      text = tostring(var.CACHE_INCLUDE_GRAPHQL_ERRORS)
    }
  ]
}
