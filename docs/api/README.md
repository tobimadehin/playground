---
layout: default
title: API Reference
---

# API Reference

Complete API documentation for  Playground.

## Playground Class

### Constructor

```typescript
new Playground(config: PlaygroundConfig)
```

#### PlaygroundConfig

```typescript
interface PlaygroundConfig {
  providers: Record<string, ProviderConfig>;
  imageMappingsPath?: string;
  imageMappings?: ImageMappings;
  defaultProvider?: string;
  costTracking?: boolean;
}
```

### Methods

#### createInstance()

Creates a new cloud instance.

```typescript
async createInstance(options: CreateInstanceOptions): Promise<Instance>
```

**Parameters:**

```typescript
interface CreateInstanceOptions {
  imageType: string;
  provider?: string;
  sshKey: string;
  userData?: string;
  tags?: Record<string, string>;
  securityGroups?: string[];
  subnet?: string;
}
```

**Returns:** `Promise<Instance>`

**Example:**

```typescript
const instance = await playground.createInstance({
  imageType: 'ubuntu-22-small',
  provider: 'aws',
  sshKey: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAAB...',
  tags: { env: 'development', project: 'my-app' }
});
```

#### destroyInstance()

Destroys a cloud instance.

```typescript
async destroyInstance(instanceId: string): Promise<void>
```

#### listInstances()

Lists all instances across providers.

```typescript
async listInstances(filters?: InstanceFilters): Promise<Instance[]>
```

#### estimateCosts()

Estimates costs for instance creation.

```typescript
async estimateCosts(options: CostEstimateOptions): Promise<CostEstimate[]>
```

## Instance Interface

```typescript
interface Instance {
  id: string;
  provider: string;
  region: string;
  imageType: string;
  publicIp: string;
  privateIp: string;
  state: 'pending' | 'running' | 'stopping' | 'stopped' | 'terminated';
  tags: Record<string, string>;
  createdAt: Date;
  estimatedCost?: {
    hourly: number;
    daily: number;
    monthly: number;
  };
}
```

## Provider Configurations

### AWS Provider

```typescript
interface AWSConfig {
  region: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
  };
  profile?: string;
  defaultSecurityGroup?: string;
  defaultSubnet?: string;
}
```

### GCP Provider

```typescript
interface GCPConfig {
  project: string;
  zone: string;
  keyFilename?: string;
  credentials?: object;
  defaultNetwork?: string;
  defaultSubnet?: string;
}
```

### Azure Provider

```typescript
interface AzureConfig {
  subscriptionId: string;
  resourceGroup: string;
  location: string;
  credentials?: {
    clientId: string;
    clientSecret: string;
    tenantId: string;
  };
  defaultNetworkSecurityGroup?: string;
  defaultSubnet?: string;
}
```

### DigitalOcean Provider

```typescript
interface DigitalOceanConfig {
  token: string;
  region: string;
  defaultVpc?: string;
  defaultFirewall?: string;
}
```

## Image Mappings

Image mappings define how image types map to provider-specific configurations.

```typescript
interface ImageMappings {
  [imageType: string]: {
    [provider: string]: ProviderImageConfig;
  };
}
```

### AWS Image Config

```typescript
interface AWSImageConfig {
  ami: string;
  instanceType: string;
  ebsOptimized?: boolean;
  userData?: string;
  securityGroups?: string[];
  keyName?: string;
  iamInstanceProfile?: string;
  monitoring?: boolean;
}
```

### GCP Image Config

```typescript
interface GCPImageConfig {
  image: string;
  machineType: string;
  diskSize?: number;
  diskType?: 'pd-standard' | 'pd-ssd' | 'pd-balanced';
  startupScript?: string;
  tags?: string[];
  serviceAccount?: string;
  preemptible?: boolean;
}
```

### Azure Image Config

```typescript
interface AzureImageConfig {
  image: string;
  size: string;
  osDiskType?: 'Standard_LRS' | 'Premium_LRS' | 'StandardSSD_LRS';
  customData?: string;
  networkSecurityGroup?: string;
  publicIpSku?: 'Basic' | 'Standard';
  acceleratedNetworking?: boolean;
}
```

### DigitalOcean Image Config

```typescript
interface DigitalOceanImageConfig {
  image: string;
  size: string;
  userData?: string;
  vpc?: string;
  monitoring?: boolean;
  backups?: boolean;
  ipv6?: boolean;
}
```

## Error Handling

All methods can throw the following error types:

```typescript
class PlaygroundError extends Error {
  code: string;
  provider?: string;
  details?: any;
}

class ProviderError extends PlaygroundError {
  // Provider-specific errors
}

class ConfigurationError extends PlaygroundError {
  // Configuration validation errors
}

class ResourceNotFoundError extends PlaygroundError {
  // Resource not found errors
}
```

**Example error handling:**

```typescript
try {
  const instance = await playground.createInstance(options);
} catch (error) {
  if (error instanceof ProviderError) {
    console.error(`Provider error: ${error.message}`);
    console.error(`Provider: ${error.provider}`);
  } else if (error instanceof ConfigurationError) {
    console.error(`Configuration error: ${error.message}`);
  } else {
    console.error(`Unexpected error: ${error.message}`);
  }
}
```

## Events

The Playground class extends EventEmitter and emits the following events:

```typescript
playground.on('instance:created', (instance: Instance) => {
  console.log(`Instance created: ${instance.id}`);
});

playground.on('instance:destroyed', (instanceId: string) => {
  console.log(`Instance destroyed: ${instanceId}`);
});

playground.on('cost:estimated', (estimate: CostEstimate) => {
  console.log(`Cost estimate: $${estimate.hourly}/hour`);
});

playground.on('error', (error: PlaygroundError) => {
  console.error(`Playground error: ${error.message}`);
});
```

