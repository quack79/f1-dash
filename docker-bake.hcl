variable "REGISTRY" {
  default = "ghcr.io"
}

variable "OWNER" {
  default = "quack79"
}

group "default" {
  targets = ["f1-dash", "f1-dash-api", "f1-dash-realtime"]
}

target "docker-metadata-action" {}

target "f1-dash" {
  inherits = ["docker-metadata-action"]

  context    = "./dashboard"
  dockerfile = "dockerfile"

  cache-from = ["type=registry,ref=${REGISTRY}/${OWNER}/f1-dash:cache"]
  cache-to   = ["type=registry,ref=${REGISTRY}/${OWNER}/f1-dash:cache,mode=max"]
}

target "f1-dash-api" {
  context    = "."
  dockerfile = "dockerfile"
  target     = "api"

  cache-from = ["type=registry,ref=${REGISTRY}/${OWNER}/f1-dash-api:cache"]
  cache-to   = ["type=registry,ref=${REGISTRY}/${OWNER}/f1-dash-api:cache,mode=max"]
}

target "f1-dash-realtime" {
  context    = "."
  dockerfile = "dockerfile"
  target     = "realtime"

  cache-from = ["type=registry,ref=${REGISTRY}/${OWNER}/f1-dash-realtime:cache"]
  cache-to   = ["type=registry,ref=${REGISTRY}/${OWNER}/f1-dash-realtime:cache,mode=max"]
}
