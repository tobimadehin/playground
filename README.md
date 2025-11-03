# Playground

[![CI](https://github.com/tobimadehin/playground/actions/workflows/ci.yml/badge.svg)](https://github.com/tobimadehin/playground/actions/workflows/ci.yml)
[![NPM Version](https://img.shields.io/npm/v/@tobimadehin/playground.svg)](https://www.npmjs.com/package/@tobimadehin/playground)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Playground lets you launch, manage, and clean up cloud instances across multiple providers. The playground itself is stateless, so you choose how to track instances.

## Quick Start

1. **Install the package**

```bash
npm install @tobimadehin/playground
````

2. **Create a provider map**

```typescript
import { AWSProvider, Playground } from '@tobimadehin/playground';

const providers = new Map();
providers.set('aws', new AWSProvider({ 
  accessKeyId: '...', 
  secretAccessKey: '...', 
  region: 'us-east-1' 
}));

const playground = new Playground({ 
  providers,
  imageMappingsPath: './examples/image-mappings.yaml'
});
```

3. **Launch an instance**

```typescript
const instance = await playground.createInstance({
  imageType: 'ubuntu-22-small',
  sshKey: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAAB... user@host'
});

console.log('Instance created:', instance.id, instance.ip);
```

4. **Track and clean up**

```typescript
import { PlaygroundUtils } from '@tobimadehin/playground';

if (PlaygroundUtils.isExpired(instance)) {
  await playground.destroyInstance(instance.provider, instance.id);
}
```

---

## Next Steps

* [View example configurations](./examples/README.md)
* [View provider implementations](./src/providers/README.md)
* Learn about state management patterns
* Explore multi-cloud failover and region-specific deployments
* Check-out dployr *(Your app, your server, your rules!)* - [https://dployr.dev](https://dployr.dev)

## License

MIT License — see [LICENSE](LICENSE) for details.
