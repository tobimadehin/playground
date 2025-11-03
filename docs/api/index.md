---
layout: default
title: API Reference
---

# API Reference

Complete API documentation for Playground.

## Playground Class

### Constructor

```typescript
new Playground(options: PlaygroundOptions)
```

#### PlaygroundOptions

```typescript
interface PlaygroundOptions {
  providers: Map<string, Provider>;
  imageMappingsPath: string;
}
```

### Methods

#### createInstance()

Creates a new ephemeral VM instance.

```typescript
async createInstance(args: CreateInstanceArgs): Promise<PlaygroundInstance>
```

**Parameters:**

```typescript
interface CreateInstanceArgs {
  imageType: string;
  sshKey: string;
  startupScript?: string;
  preferredProvider?: string;
}
```

**Returns:** `Promise<PlaygroundInstance>`

**Example:**

```typescript
const instance = await playground.createInstance({
  imageType: 'ubuntu-22-small',
  sshKey: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAAB... user@host',
  startupScript: '#!/bin/bash\napt-get update -y',
  preferredProvider: 'hetzner'
});
```

#### destroyInstance()

Destroys a specific VM instance.

```typescript
async destroyInstance(providerName: string, instanceId: string): Promise<void>
```

#### getInstance()

Gets current status of a specific instance.

```typescript
async getInstance(providerName: string, instanceId: string): Promise<Instance>
```

#### getAvailableImageTypes()

Gets available image types from mappings.

```typescript
getAvailableImageTypes(): string[]
```

#### getAvailableProviders()

Gets available providers.

```typescript
getAvailableProviders(): string[]
```

#### getImageMappings()

Gets image mappings for a specific image type.

```typescript
getImageMappings(imageType: string): ImageMapping[]
```

## PlaygroundInstance Interface

```typescript
interface PlaygroundInstance extends Instance {
  provider: string;
  imageType: string;
  createdAt: number;
  ttl: number;
  sshKey: string;
}
```

## Instance Interface

```typescript
interface Instance {
  id: string;
  ip: string;
  providerData?: any;
}
```

## ImageSpec Interface

```typescript
interface ImageSpec {
  image: string;
  size: string;
}
```

## ImageMapping Interface

```typescript
interface ImageMapping {
  provider: string;
  image: string;
  size: string;
  priority: number;
  ttl?: number;
}
```

## Provider Interface

```typescript
interface Provider {
  createVM(spec: ImageSpec, sshKey: string, startupScript?: string): Promise<Instance>;
  destroyVM(instanceId: string): Promise<void>;
  getVM(instanceId: string): Promise<Instance>;
}
```

## Provider Configurations

### AWS Provider

```typescript
interface AWSConfig {
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
  defaultSubnetId?: string;
  defaultSecurityGroupId?: string;
}
```

### DigitalOcean Provider

```typescript
interface DigitalOceanConfig {
  apiToken: string;
  defaultRegion?: string;
}
```

### Hetzner Provider

```typescript
interface HetznerConfig {
  apiToken: string;
  defaultLocation?: string;
}
```

## Image Mappings YAML Structure

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

## PlaygroundUtils Class

Utility functions for managing instance lifecycles externally.

#### isExpired()

```typescript
static isExpired(instance: PlaygroundInstance): boolean
```

#### getTimeToExpiry()

```typescript
static getTimeToExpiry(instance: PlaygroundInstance): number
```

#### filterExpired()

```typescript
static filterExpired(instances: PlaygroundInstance[]): PlaygroundInstance[]
```

#### filterActive()

```typescript
static filterActive(instances: PlaygroundInstance[]): PlaygroundInstance[]
```