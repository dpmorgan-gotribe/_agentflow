# Step 61: Hetzner Deployment

> **Checkpoint:** CP11 - Infrastructure
> **Previous Step:** 60-K3S-CLUSTER.md
> **Next Step:** 62-OBSERVABILITY.md
> **Architecture Reference:** `ARCHITECTURE.md` - Cloud Deployment

---

## Overview

**Hetzner Deployment** orchestrates the full deployment pipeline to Hetzner Cloud, including server provisioning, K3s installation, and application deployment.

---

## Deliverables

1. `infrastructure/environments/production/` - Production config
2. `infrastructure/environments/staging/` - Staging config
3. `infrastructure/scripts/deploy.sh` - Deployment script

---

## 1. Production Environment

```hcl
# infrastructure/environments/production/main.tf

terraform {
  backend "s3" {
    bucket   = "aigentflow-tfstate"
    key      = "production/terraform.tfstate"
    region   = "eu-central-1"
    encrypt  = true
  }
}

provider "hcloud" {
  token = var.hcloud_token
}

module "network" {
  source = "../../modules/hetzner-network"
  name   = "aigentflow-production"
  ip_range = "10.0.0.0/16"
}

module "control_plane" {
  source      = "../../modules/hetzner-server"
  count       = 3
  name        = "k3s-control-${count.index}"
  server_type = "cx31"
  ssh_keys    = [var.ssh_key_id]
  network_id  = module.network.network_id
}

module "workers" {
  source      = "../../modules/hetzner-server"
  count       = 3
  name        = "k3s-worker-${count.index}"
  server_type = "cx41"
  ssh_keys    = [var.ssh_key_id]
  network_id  = module.network.network_id
}
```

---

## 2. Deployment Script

```bash
#!/bin/bash
# infrastructure/scripts/deploy.sh

set -e

ENVIRONMENT="${1:-staging}"
echo "Deploying to $ENVIRONMENT..."

cd "infrastructure/environments/$ENVIRONMENT"

# Initialize and apply Terraform
tofu init
tofu plan -out=tfplan
tofu apply tfplan

# Get server IPs
CONTROL_IPS=$(tofu output -json control_plane_ips | jq -r '.[]')

# Install K3s on control plane
for IP in $CONTROL_IPS; do
  ssh root@$IP 'bash -s' < ../../k3s/scripts/install-server.sh
done

# Apply Kubernetes manifests
export KUBECONFIG=./kubeconfig
kubectl apply -f ../../k3s/manifests/

echo "Deployment complete!"
```

---

## Validation Checklist

```
□ Hetzner Deployment (Step 61)
  □ Servers provision correctly
  □ Network configured
  □ DNS points to load balancer
  □ TLS certificates issued
  □ Application accessible
  □ Tests pass
```

---

## Next Step

Proceed to **62-OBSERVABILITY.md** to configure monitoring and alerting.
