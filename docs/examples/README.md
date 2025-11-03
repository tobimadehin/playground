---
layout: default
title: Examples
---

# Examples

Complete examples for different use cases and cloud providers.

## Multi-Cloud Setup

Deploy the same application across multiple cloud providers:

```typescript
import { Playground } from '@tobimadehin/playground';

const playground = new Playground({
  providers: {
    aws: { 
      region: 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    },
    gcp: { 
      project: 'my-gcp-project',
      zone: 'us-central1-a',
      keyFilename: './gcp-service-account.json'
    },
    azure: {
      subscriptionId: process.env.AZURE_SUBSCRIPTION_ID,
      resourceGroup: 'my-resource-group',
      location: 'East US'
    }
  },
  imageMappingsPath: './multi-cloud-mappings.yaml'
});

// Deploy to all providers
const instances = await Promise.all([
  playground.createInstance({ 
    imageType: 'ubuntu-22-small',
    provider: 'aws',
    sshKey: mySSHKey 
  }),
  playground.createInstance({ 
    imageType: 'ubuntu-22-small',
    provider: 'gcp',
    sshKey: mySSHKey 
  }),
  playground.createInstance({ 
    imageType: 'ubuntu-22-small',
    provider: 'azure',
    sshKey: mySSHKey 
  })
]);

console.log('Deployed to:', instances.map(i => `${i.provider}: ${i.publicIp}`));
```

## Development Workflow

Set up a complete development environment:

```typescript
async function setupDevEnvironment() {
  const playground = new Playground({
    providers: { aws: { region: 'us-east-1' } }
  });

  // Create development instance
  const devInstance = await playground.createInstance({
    imageType: 'ubuntu-22-dev', // Custom image with dev tools
    sshKey: mySSHKey,
    userData: `#!/bin/bash
      # Install development dependencies
      curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
      sudo apt-get install -y nodejs
      sudo npm install -g pm2
      
      # Clone and setup project
      git clone https://github.com/my-org/my-project.git
      cd my-project
      npm install
      pm2 start npm -- start
    `,
    tags: { env: 'development', auto-shutdown: '8h' }
  });

  console.log(`Development environment ready at: ${devInstance.publicIp}`);
  console.log(`SSH: ssh ubuntu@${devInstance.publicIp}`);
  console.log(`App: http://${devInstance.publicIp}:3000`);

  return devInstance;
}
```

## Image Mappings Examples

### Complete multi-cloud mappings file:

```yaml
# Development images
ubuntu-22-dev:
  aws:
    ami: ami-0c02fb55956c7d316
    instanceType: t3.small
    userData: |
      #!/bin/bash
      apt-get update
      apt-get install -y git nodejs npm docker.io
  gcp:
    image: ubuntu-2204-jammy-v20231030
    machineType: e2-small
    startupScript: |
      #!/bin/bash
      apt-get update
      apt-get install -y git nodejs npm docker.io
  azure:
    image: Canonical:0001-com-ubuntu-server-jammy:22_04-lts-gen2:latest
    size: Standard_B1s

# Production images
ubuntu-22-prod:
  aws:
    ami: ami-0c02fb55956c7d316
    instanceType: t3.medium
    securityGroups: ['prod-web-sg']
  gcp:
    image: ubuntu-2204-jammy-v20231030
    machineType: e2-medium
    tags: ['prod-web']
  azure:
    image: Canonical:0001-com-ubuntu-server-jammy:22_04-lts-gen2:latest
    size: Standard_B2s
    networkSecurityGroup: prod-web-nsg

# High-performance images
ubuntu-22-performance:
  aws:
    ami: ami-0c02fb55956c7d316
    instanceType: c5.large
    ebsOptimized: true
  gcp:
    image: ubuntu-2204-jammy-v20231030
    machineType: c2-standard-4
  azure:
    image: Canonical:0001-com-ubuntu-server-jammy:22_04-lts-gen2:latest
    size: Standard_F4s_v2
```