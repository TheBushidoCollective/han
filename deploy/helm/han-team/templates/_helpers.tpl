{{/*
Expand the name of the chart.
*/}}
{{- define "han-team.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "han-team.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "han-team.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "han-team.labels" -}}
helm.sh/chart: {{ include "han-team.chart" . }}
{{ include "han-team.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "han-team.selectorLabels" -}}
app.kubernetes.io/name: {{ include "han-team.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "han-team.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "han-team.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Create the database URL
*/}}
{{- define "han-team.databaseUrl" -}}
{{- if .Values.postgresql.enabled }}
{{- printf "postgres://%s:%s@%s-postgresql:5432/%s" .Values.postgresql.auth.username "$(POSTGRES_PASSWORD)" (include "han-team.fullname" .) .Values.postgresql.auth.database }}
{{- else }}
{{- printf "postgres://%s:%s@%s:%v/%s" .Values.externalDatabase.username "$(POSTGRES_PASSWORD)" .Values.externalDatabase.host (.Values.externalDatabase.port | default 5432) .Values.externalDatabase.database }}
{{- end }}
{{- end }}

{{/*
Create the Redis URL
*/}}
{{- define "han-team.redisUrl" -}}
{{- if .Values.redis.enabled }}
{{- printf "redis://%s-redis-master:6379" (include "han-team.fullname" .) }}
{{- else }}
{{- if .Values.externalRedis.password }}
{{- printf "redis://:%s@%s:%v" "$(REDIS_PASSWORD)" .Values.externalRedis.host (.Values.externalRedis.port | default 6379) }}
{{- else }}
{{- printf "redis://%s:%v" .Values.externalRedis.host (.Values.externalRedis.port | default 6379) }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Get the secret name for credentials
*/}}
{{- define "han-team.secretName" -}}
{{- if .Values.secrets.existingSecret }}
{{- .Values.secrets.existingSecret }}
{{- else }}
{{- include "han-team.fullname" . }}
{{- end }}
{{- end }}

{{/*
Get the PostgreSQL secret name
*/}}
{{- define "han-team.postgresql.secretName" -}}
{{- if .Values.postgresql.enabled }}
{{- if .Values.postgresql.auth.existingSecret }}
{{- .Values.postgresql.auth.existingSecret }}
{{- else }}
{{- printf "%s-postgresql" (include "han-team.fullname" .) }}
{{- end }}
{{- else }}
{{- if .Values.externalDatabase.existingSecret }}
{{- .Values.externalDatabase.existingSecret }}
{{- else }}
{{- include "han-team.fullname" . }}
{{- end }}
{{- end }}
{{- end }}
