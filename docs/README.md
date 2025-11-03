# Playground

> Multi-cloud deployment playground for developers

Playground provides a unified interface for creating and managing cloud instances across multiple providers (AWS, GCP, Azure, DigitalOcean) with simple configuration files.

## Quick Start

### 1. Installation

```bash
npm install @tobimadehin/playground
```

### 2. Basic Usage

```typescript
import { Playground } from '@tobimadehin/playground';

const playground = new Playground({
  providers: {
    aws: { region: 'us-east-1' },
    gcp: { project: 'my-project', zone: 'us-central1-a' }
  },
  imageMappingsPath: './image-mappings.yaml'
});

// Create an instance
const instance = await playground.createInstance({
  imageType: 'ubuntu-22-small',
  sshKey: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAAB... user@host'
});

console.log(`Instance created: ${instance.id}`);
console.log(`SSH: ssh user@${instance.publicIp}`);
```

### 3. Image Mappings

Create an `image-mappings.yaml` file to define your cloud images:

```yaml
ubuntu-22-small:
  aws:
    ami: ami-0c02fb55956c7d316
    instanceType: t3.micro
  gcp:
    image: ubuntu-2204-jammy-v20231030
    machineType: e2-micro
  azure:
    image: Canonical:0001-com-ubuntu-server-jammy:22_04-lts-gen2:latest
    size: Standard_B1s
```

## Key Features

- **Multi-cloud support**: AWS, GCP, Azure, DigitalOcean
- **Unified API**: Same interface across all providers
- **Type-safe**: Full TypeScript support
- **Flexible configuration**: YAML-based image mappings
- **Cost-aware**: Built-in cost estimation

## Next Steps

- [View Examples](/examples/) - Complete multi-cloud setups
- [API Reference](/docs/api/) - Detailed API documentation
- [GitHub Repository](https://github.com/tobimadehin/playground) - Source code and issues

## Support

- [Documentation](/examples/)
- [Issues](https://github.com/tobimadehin/playground/issues)
- [Discussions](https://github.com/tobimadehin/playground/discussions)