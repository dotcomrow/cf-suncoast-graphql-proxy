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

resource "cloudflare_r2_bucket" "schemas_bucket" {
  account_id = var.cloudflare_account_id
  name       = "schemas-pulsedb-${var.environment}"
}

resource "null_resource" "project_id" {
  triggers = {
    always_run = timestamp()
  }

  provisioner "local-exec" {
    command = "${path.module}/scripts/get_project_id.sh"
    environment = {
       project = "pulsedb-${var.environment}"
    }
  }
}

data "local_file" "load_project_id" {
    filename = "${path.module}/project_id"
  depends_on = [ null_resource.project_id ]
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
      text = var.ALLOWED_HOSTS
    },
    {
      name = "ENVIRONMENT"
      type = "plain_text"
      text = var.environment
    },
    {
      name = "GCP_LOGGING_PROJECT_ID"
      type = "plain_text"
      text = var.GCP_LOGGING_PROJECT_ID
    },
    {
      name = "LOG_NAME"
      type = "plain_text"
      text = "${var.project_name}_${var.environment}_worker_log"
    },
    {
      name        = "SCHEMAS_BUCKET"
      type        = "r2_bucket"
      bucket_name = cloudflare_r2_bucket.schemas_bucket.name
    },
    {
      name = "PULSE_DATASET"
      type = "plain_text"
      text = "pulsedb_dataset"
    },
    {
      name = "PULSE_DATABASE_PROJECT_ID"
      type = "plain_text"
      text = data.local_file.load_project_id.content
    },
    {
      name = "VERSION"
      type = "plain_text"
      text = var.VERSION
    },
    {
      name = "GCP_LOGGING_CREDENTIALS"
      type = "secret_text"
      text = var.GCP_LOGGING_CREDENTIALS
    },
    {
      name = "GCP_BIGQUERY_CREDENTIALS"
      type = "secret_text"
      text = var.GCP_BIGQUERY_CREDENTIALS
    },
    {
      name = "GCP_USERINFO_CREDENTIALS"
      type = "secret_text"
      text = var.GCP_USERINFO_CREDENTIALS
    },
    {
      name = "GLOBAL_SHARED_SECRET"
      type = "secret_text"
      text = var.GLOBAL_SHARED_SECRET
    }
  ]

  depends_on = [ data.local_file.load_project_id, cloudflare_r2_bucket.schemas_bucket ]
}
