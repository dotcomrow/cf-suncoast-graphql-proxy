locals {
  upstream_hostname    = "${var.UPSTREAM_DNS_NAME}.${var.domain}"
  upstream_graphql_url = var.MANAGE_UPSTREAM_DNS_RECORD ? "https://${local.upstream_hostname}${var.UPSTREAM_GRAPHQL_PATH}" : var.UPSTREAM_GRAPHQL_URL
}

resource "cloudflare_dns_record" "upstream_origin" {
  count   = var.MANAGE_UPSTREAM_DNS_RECORD ? 1 : 0
  zone_id = var.cloudflare_zone_id
  name    = var.UPSTREAM_DNS_NAME
  type    = "A"
  content = var.UPSTREAM_ORIGIN_IP
  proxied = true
  ttl     = 1
}

resource "cloudflare_workers_custom_domain" "project_domain" {
  account_id = var.cloudflare_account_id
  hostname   = "${var.project_name}.${var.environment}.${var.domain}"
  service    = cloudflare_workers_script.project_script.script_name
  zone_id    = var.cloudflare_zone_id
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
