# Step 60: K3s Cluster

> **Checkpoint:** CP11 - Infrastructure
> **Previous Step:** 59-OPENTOFU-SETUP.md
> **Next Step:** 61-HETZNER-DEPLOY.md
> **Architecture Reference:** `ARCHITECTURE.md` - Kubernetes Cluster

---

## Overview

**K3s Cluster** configures a lightweight Kubernetes distribution optimized for Hetzner Cloud deployment, with HA control plane support.

---

## Deliverables

1. `infrastructure/k3s/` - K3s configuration
2. `infrastructure/k3s/manifests/` - Base manifests
3. `infrastructure/k3s/scripts/` - Installation scripts

---

## 1. K3s Installation Script

```bash
#!/bin/bash
# infrastructure/k3s/scripts/install-server.sh

set -e

K3S_VERSION="${K3S_VERSION:-v1.29.0+k3s1}"
INSTALL_K3S_EXEC="server --cluster-init"

# Install k3s
curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION=$K3S_VERSION sh -s - $INSTALL_K3S_EXEC \
  --disable traefik \
  --disable servicelb \
  --flannel-backend=wireguard-native \
  --write-kubeconfig-mode 644

# Wait for k3s to be ready
until kubectl get nodes; do
  sleep 5
done

echo "K3s server installed successfully"
```

---

## 2. Base Manifests

```yaml
# infrastructure/k3s/manifests/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: aigentflow
  labels:
    app.kubernetes.io/name: aigentflow
---
# infrastructure/k3s/manifests/api-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: aigentflow-api
  namespace: aigentflow
spec:
  replicas: 2
  selector:
    matchLabels:
      app: aigentflow-api
  template:
    metadata:
      labels:
        app: aigentflow-api
    spec:
      containers:
        - name: api
          image: ghcr.io/aigentflow/api:latest
          ports:
            - containerPort: 3000
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: aigentflow-secrets
                  key: database-url
          resources:
            requests:
              memory: "256Mi"
              cpu: "100m"
            limits:
              memory: "512Mi"
              cpu: "500m"
```

---

## Validation Checklist

```
□ K3s Cluster (Step 60)
  □ K3s installs correctly
  □ Cluster is accessible
  □ Base manifests apply
  □ Networking works
  □ Tests pass
```

---

## Next Step

Proceed to **61-HETZNER-DEPLOY.md** to configure cloud deployment.
