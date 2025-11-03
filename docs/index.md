---
layout: default
title: Home
---

# Playground

> Multi-cloud ephemeral VM library

Playground provides a unified interface for creating and managing ephemeral virtual machines across multiple cloud providers. It handles provider selection and image mapping, but remains completely stateless.

## Quick Start

### 1. Installation

```bash
npm install @tobimadehin/playground
```

### 2. Basic Usage

```typescript
import { Playground, HetznerProvider, DigitalOceanProvider } from '@tobimadehin/playground';

const providers = new Map();
providers.set('hetzner', new HetznerProvider({ apiToken: process.env.HETZNER_API_TOKEN! }));
providers.set('digitalocean', new DigitalOceanProvider({ apiToken: process.env.DO_API_TOKEN! }));

const playground = new Playground({ 
  providers,
  imageMappingsPath: './examples/image-mappings.yaml'
});

// Create an ephemeral VM
const instance = await playground.createInstance({
  imageType: 'ubuntu-22-small',
  sshKey: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAAB... user@host',
  startupScript: '#!/bin/bash\napt-get update -y\napt-get install -y htop'
});

console.log(`VM created: ${instance.id} at ${instance.ip}`);
console.log(`Provider: ${instance.provider}, TTL: ${instance.ttl}s`);

// Destroy when done (you manage the lifecycle)
await playground.destroyInstance(instance.provider, instance.id);
```

### 3. Image Mappings

Create an `image-mappings.yaml` file to define your cloud images:

```yaml
ubuntu-22-small:
  - provider: hetzner
    image: ubuntu-22.04
    size: cx11
    priority: 1
    ttl: 3600
  - provider: digitalocean
    image: ubuntu-22-04-x64
    size: s-1vcpu-1gb
    priority: 2
    ttl: 3600

ubuntu-22-medium:
  - provider: hetzner
    image: ubuntu-22.04
    size: cx21
    priority: 1
    ttl: 7200
```

## Key Features

- **Multi-cloud support**: AWS, Azure, GCP, DigitalOcean, Hetzner, Oracle Cloud
- **Stateless design**: No instance tracking or storage dependencies
- **Priority-based selection**: Automatic provider selection based on priority
- **Type-safe**: Full TypeScript support
- **Flexible configuration**: YAML-based image mappings
- **TTL management**: Built-in time-to-live for ephemeral VMs

## Supported Providers

- **AWS** - EC2 instances
- **DigitalOcean** - Droplets  
- **Hetzner Cloud** - Cloud servers
- **Azure** - Virtual machines
- **Google Cloud** - Compute Engine instances
- **Oracle Cloud** - Compute instances

## Next Steps

- [View Examples]({{ site.baseurl }}/examples/) - Complete usage examples
- [API Reference]({{ site.baseurl }}/api/) - Detailed API documentation
- [GitHub Repository]({{ site.github.repository_url }}) - Source code and issues

## Support

- [Documentation]({{ site.baseurl }}/examples/)
- [Issues]({{ site.github.repository_url }}/issues)
- [Discussions]({{ site.github.repository_url }}/discussions)