# Step 59: OpenTofu Setup

> **Checkpoint:** CP11 - Infrastructure
> **Previous Step:** 58-DESIGN-PREVIEW.md (CP10)
> **Next Step:** 60-K3S-CLUSTER.md
> **Architecture Reference:** `ARCHITECTURE.md` - Infrastructure as Code

---

## Overview

**OpenTofu Setup** establishes the Infrastructure as Code foundation using OpenTofu (Terraform fork) for provisioning cloud resources on Hetzner Cloud.

---

## Deliverables

1. `infrastructure/modules/` - Reusable Terraform modules
2. `infrastructure/environments/` - Environment configurations
3. `infrastructure/modules/hetzner-server/` - Server provisioning
4. `infrastructure/modules/hetzner-network/` - VPC configuration

---

## 1. Module Structure

```hcl
# infrastructure/modules/hetzner-server/main.tf

terraform {
  required_providers {
    hcloud = {
      source  = "hetznercloud/hcloud"
      version = "~> 1.45"
    }
  }
}

variable "name" {
  type        = string
  description = "Server name"
}

variable "server_type" {
  type        = string
  default     = "cx21"
  description = "Hetzner server type"
}

variable "location" {
  type        = string
  default     = "fsn1"
  description = "Hetzner datacenter location"
}

variable "image" {
  type        = string
  default     = "ubuntu-22.04"
  description = "Server image"
}

variable "ssh_keys" {
  type        = list(string)
  description = "SSH key IDs"
}

variable "network_id" {
  type        = string
  description = "Private network ID"
}

resource "hcloud_server" "main" {
  name        = var.name
  server_type = var.server_type
  location    = var.location
  image       = var.image
  ssh_keys    = var.ssh_keys

  network {
    network_id = var.network_id
  }

  labels = {
    managed_by = "opentofu"
    project    = "aigentflow"
  }
}

output "server_id" {
  value = hcloud_server.main.id
}

output "ipv4_address" {
  value = hcloud_server.main.ipv4_address
}

output "private_ip" {
  value = hcloud_server.main.network[*].ip
}
```

---

## Validation Checklist

```
□ OpenTofu Setup (Step 59)
  □ Modules defined
  □ State backend configured
  □ Variables documented
  □ Plan executes successfully
  □ Tests pass
```

---

## Next Step

Proceed to **60-K3S-CLUSTER.md** to configure Kubernetes cluster.
