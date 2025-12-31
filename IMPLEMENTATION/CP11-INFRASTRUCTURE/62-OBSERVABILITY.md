# Step 62: Observability

> **Checkpoint:** CP11 - Infrastructure
> **Previous Step:** 61-HETZNER-DEPLOY.md
> **Next Step:** 63-EXPO-MOBILE.md (CP12)
> **Architecture Reference:** `ARCHITECTURE.md` - Observability Stack

---

## Overview

**Observability** configures Prometheus, Grafana, and Loki for metrics collection, visualization, and log aggregation.

---

## Deliverables

1. `infrastructure/k3s/manifests/monitoring/` - Monitoring stack
2. `infrastructure/k3s/manifests/monitoring/prometheus.yaml` - Metrics
3. `infrastructure/k3s/manifests/monitoring/grafana.yaml` - Dashboards
4. `infrastructure/k3s/manifests/monitoring/loki.yaml` - Logs

---

## 1. Prometheus Configuration

```yaml
# infrastructure/k3s/manifests/monitoring/prometheus.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
  namespace: monitoring
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s

    scrape_configs:
      - job_name: 'aigentflow-api'
        kubernetes_sd_configs:
          - role: pod
            namespaces:
              names: ['aigentflow']
        relabel_configs:
          - source_labels: [__meta_kubernetes_pod_label_app]
            regex: aigentflow-api
            action: keep
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: prometheus
  namespace: monitoring
spec:
  replicas: 1
  selector:
    matchLabels:
      app: prometheus
  template:
    metadata:
      labels:
        app: prometheus
    spec:
      containers:
        - name: prometheus
          image: prom/prometheus:v2.48.0
          ports:
            - containerPort: 9090
          volumeMounts:
            - name: config
              mountPath: /etc/prometheus
      volumes:
        - name: config
          configMap:
            name: prometheus-config
```

---

## 2. Grafana Dashboards

```yaml
# infrastructure/k3s/manifests/monitoring/grafana.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: grafana
  namespace: monitoring
spec:
  replicas: 1
  selector:
    matchLabels:
      app: grafana
  template:
    metadata:
      labels:
        app: grafana
    spec:
      containers:
        - name: grafana
          image: grafana/grafana:10.2.0
          ports:
            - containerPort: 3000
          env:
            - name: GF_SECURITY_ADMIN_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: grafana-secrets
                  key: admin-password
```

---

## Validation Checklist

```
□ Observability (Step 62)
  □ Prometheus scraping metrics
  □ Grafana dashboards display
  □ Loki collecting logs
  □ Alerting rules configured
  □ Tests pass
```

---

## Next Step

Proceed to **63-EXPO-MOBILE.md** (CP12) to begin mobile app development.
