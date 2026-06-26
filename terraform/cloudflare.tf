locals {
  upstream_hostname               = "${var.UPSTREAM_DNS_NAME}.${var.domain}"
  normalized_allowed_hosts        = trimspace(var.ALLOWED_HOSTS)
  trimmed_upstream_graphql_url    = trimspace(var.UPSTREAM_GRAPHQL_URL)
  default_upstream_graphql_url    = "https://${local.upstream_hostname}${var.UPSTREAM_GRAPHQL_PATH}"
  upstream_graphql_url            = local.trimmed_upstream_graphql_url != "" ? local.trimmed_upstream_graphql_url : local.default_upstream_graphql_url
  upstream_directus_asset_base_url = trimspace(var.UPSTREAM_DIRECTUS_ASSET_BASE_URL) != "" ? trimspace(var.UPSTREAM_DIRECTUS_ASSET_BASE_URL) : "https://${local.upstream_hostname}"
  cors_domains                    = join(",", compact([local.normalized_allowed_hosts, "*.${var.domain}"]))
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
  bindings = [
    {
      name = "CORS_DOMAINS"
      type = "plain_text"
      text = local.cors_domains
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
      name = "UPSTREAM_DIRECTUS_ASSET_BASE_URL"
      type = "plain_text"
      text = local.upstream_directus_asset_base_url
    },
    {
      name = "UPSTREAM_DIRECTUS_ASSET_PATH"
      type = "plain_text"
      text = var.UPSTREAM_DIRECTUS_ASSET_PATH
    },
    {
      name = "DIRECTUS_ASSET_PROXY_PREFIX"
      type = "plain_text"
      text = var.DIRECTUS_ASSET_PROXY_PREFIX
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
