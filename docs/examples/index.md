---
layout: default
title: Examples
---

# Examples

Complete examples for different use cases and cloud providers.

## Basic Usage

```typescript
import { Playground, HetznerProvider, DigitalOceanProvider } from '@tobimadehin/playground';

const providers = new Map();
providers.set('hetzner', new HetznerProvider({ 
  apiToken: process.env.HETZNER_API_TOKEN! 
}));
providers.set('digitalocean', new DigitalOceanProvider({ 
  apiToken: process.env.DO_API_TOKEN! 
}));

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

// Destroy when done
await playground.destroyInstance(instance.provider, instance.id);
```

## Multi-Provider Setup

```typescript
import { 
  Playground, 
  AWSProvider, 
  DigitalOceanProvider, 
  HetznerProvider 
} from '@tobimadehin/playground';

const providers = new Map();
providers.set('aws', new AWSProvider({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  region: 'us-east-1'
}));
providers.set('digitalocean', new DigitalOceanProvider({
  apiToken: process.env.DO_API_TOKEN!,
  defaultRegion: 'nyc3'
}));
providers.set('hetzner', new HetznerProvider({
  apiToken: process.env.HETZNER_API_TOKEN!,
  defaultLocation: 'nbg1'
}));

const playground = new Playground({ 
  providers, 
  imageMappingsPath: './image-mappings.yaml' 
});

// Create instance with preferred provider
const instance = await playground.createInstance({
  imageType: 'ubuntu-22-medium',
  sshKey: mySSHKey,
  preferredProvider: 'hetzner'
});
```

## Development Workflow

```typescript
import { PlaygroundUtils } from '@tobimadehin/playground';

// Create development instance
const devInstance = await playground.createInstance({
  imageType: 'ubuntu-22-small',
  sshKey: mySSHKey,
  startupScript: `#!/bin/bash
    apt-get update -y
    apt-get install -y docker.io
    systemctl start docker
    systemctl enable docker
    usermod -aG docker root`
});

console.log(`Development environment ready at: ${devInstance.ip}`);
console.log(`SSH: ssh root@${devInstance.ip}`);

// Check expiration
if (PlaygroundUtils.isExpired(devInstance)) {
  await playground.destroyInstance(devInstance.provider, devInstance.id);
}
```

## External State Management

```typescript
// You manage instance tracking however you want
const activeInstances = new Map<string, PlaygroundInstance>();

// Create and track
const instance = await playground.createInstance({ 
  imageType: 'ubuntu-22-small', 
  sshKey 
});
activeInstances.set(instance.id, instance);

// Your cleanup logic
for (const [id, instance] of activeInstances) {
  if (PlaygroundUtils.isExpired(instance)) {
    await playground.destroyInstance(instance.provider, id);
    activeInstances.delete(id);
  }
}
```

## Image Mappings File

Create `image-mappings.yaml`:

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
  - provider: digitalocean
    image: ubuntu-22-04-x64
    size: s-2vcpu-2gb
    priority: 2
    ttl: 7200
  - provider: aws
    image: ami-0abcdef1234567890
    size: t3.small
    priority: 3
    ttl: 7200

debian-11-small:
  - provider: hetzner
    image: debian-11
    size: cx11
    priority: 1
    ttl: 3600
  - provider: digitalocean
    image: debian-11-x64
    size: s-1vcpu-1gb
    priority: 2
    ttl: 3600
```