# ** Playground Examples**

This directory contains example configurations, usage patterns, and integration references for  Playground. It is stateless, so you manage instance lifecycles externally.

---

## **1. Image Mappings**

### `image-mappings.yaml`

Define instance types across multiple cloud providers.

```yaml
image-type-name:
  - provider: provider-name      # must match provider key
    image: provider-image-id     # provider-specific image ID
    size: provider-size-id       # instance size
    priority: 1                  # lower = higher priority
    ttl: 3600                    # time-to-live (seconds)
```

**Provider-specific examples:**

#### AWS

```yaml
ubuntu-aws:
  - provider: aws
    image: ami-0abcdef1234567890
    size: t3.micro
    priority: 1
    ttl: 3600
```

#### Azure

```yaml
ubuntu-azure:
  - provider: azure
    image: Canonical:0001-com-ubuntu-server-jammy:22_04-lts-gen2:latest
    size: Standard_B1s
    priority: 1
    ttl: 3600
```

#### GCP

```yaml
ubuntu-gcp:
  - provider: gcp
    image: projects/ubuntu-os-cloud/global/images/family/ubuntu-2204-lts
    size: e2-micro
    priority: 1
    ttl: 3600
```

#### DigitalOcean

```yaml
ubuntu-do:
  - provider: digitalocean
    image: ubuntu-22-04-x64
    size: s-1vcpu-1gb
    priority: 1
    ttl: 3600
```

#### Hetzner

```yaml
ubuntu-hetzner:
  - provider: hetzner
    image: ubuntu-22.04
    size: cx11
    priority: 1
    ttl: 3600
```

#### Oracle Cloud

```yaml
ubuntu-oracle:
  - provider: oracle
    image: ocid1.image.oc1.iad.aaaaaaaa...
    size: VM.Standard.E4.Flex
    priority: 1
    ttl: 3600
```

---

## **2. State Management Patterns**

 Playground does not store state. You can manage instances using:

### **2.1 In-Memory**

```typescript
import { PlaygroundUtils, PlaygroundInstance } from '@tobimadehin/playground';

const activeInstances = new Map<string, PlaygroundInstance>();

// Track instances
const instance = await playground.createInstance({ ... });
activeInstances.set(instance.id, instance);

// Cleanup expired instances
setInterval(async () => {
  for (const [id, instance] of activeInstances) {
    if (PlaygroundUtils.isExpired(instance)) {
      await playground.destroyInstance(instance.provider, id);
      activeInstances.delete(id);
    }
  }
}, 60000);
```

### **2.2 Database Storage**

```typescript
class InstanceManager {
  async createInstance(args: CreateInstanceArgs) {
    const instance = await playground.createInstance(args);
    await db.instances.create({
      id: instance.id,
      provider: instance.provider,
      imageType: instance.imageType,
      ipAddress: instance.ip,
      ttl: instance.ttl,
      createdAt: instance.createdAt,
      expiresAt: new Date((instance.createdAt + instance.ttl) * 1000)
    });
    return instance;
  }

  async cleanupExpired() {
    const expired = await db.instances.findMany({
      where: { expiresAt: { lt: new Date() } }
    });
    for (const instance of expired) {
      await playground.destroyInstance(instance.provider, instance.id);
      await db.instances.delete({ where: { id: instance.id } });
    }
    return expired.length;
  }
}
```

### **2.3 Redis Cache**

```typescript
import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL);

class RedisInstanceManager {
  async createInstance(args: CreateInstanceArgs) {
    const instance = await playground.createInstance(args);
    await redis.setex(`instance:${instance.id}`, instance.ttl, JSON.stringify(instance));
    return instance;
  }

  async getInstance(id: string) {
    const data = await redis.get(`instance:${id}`);
    return data ? JSON.parse(data) : null;
  }
}
```

### **2.4 File System**

```typescript
import fs from 'fs/promises';
import path from 'path';

class FileInstanceManager {
  private dir = './instances';
  constructor() { fs.mkdir(this.dir, { recursive: true }); }

  async createInstance(args: CreateInstanceArgs) {
    const instance = await playground.createInstance(args);
    const filePath = path.join(this.dir, `${instance.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(instance, null, 2));
    return instance;
  }

  async cleanupExpired() {
    const files = await fs.readdir(this.dir);
    for (const file of files) {
      const filePath = path.join(this.dir, file);
      const data = JSON.parse(await fs.readFile(filePath, 'utf8'));
      if (PlaygroundUtils.isExpired(data)) {
        await playground.destroyInstance(data.provider, data.id);
        await fs.unlink(filePath);
      }
    }
  }
}
```

### **2.5 External API**

```typescript
class APIInstanceManager {
  constructor(private apiUrl: string, private apiKey: string) {}

  async createInstance(args: CreateInstanceArgs) {
    const instance = await playground.createInstance(args);
    await fetch(`${this.apiUrl}/instances`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(instance)
    });
    return instance;
  }
}
```

---

## **3. Common Patterns**

### **Multi-Cloud Failover**

```yaml
staging-fleet:
  - provider: aws
    image: ami-0abcdef1234567890
    size: t3.medium
    priority: 1
    ttl: 86400
  - provider: azure
    image: Canonical:0001-com-ubuntu-server-jammy:22_04-lts-gen2:latest
    size: Standard_B2s
    priority: 2
    ttl: 86400
```

### **Cost-Optimized Development**

```yaml
dev-cheap:
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
```

### **Region-Specific Deployments**

```yaml
us-east-ubuntu:
  - provider: aws
    image: ami-0abcdef1234567890
    size: t3.micro
    priority: 1

eu-west-ubuntu:
  - provider: aws
    image: ami-0123456789abcdef0
    size: t3.micro
    priority: 1
```

---

## **4. Utilities**

### Check Expiration

```typescript
if (PlaygroundUtils.isExpired(instance)) {
  await playground.destroyInstance(instance.provider, instance.id);
}

const timeLeft = PlaygroundUtils.getTimeToExpiry(instance);
```

### Batch Operations

```typescript
const allInstances = await myStorage.getAllInstances();
const expired = PlaygroundUtils.filterExpired(allInstances);

for (const instance of expired) {
  await playground.destroyInstance(instance.provider, instance.id);
  await myStorage.deleteInstance(instance.id);
}
```

### Scheduled Cleanup

```typescript
setInterval(async () => {
  const instances = await myStorage.getAllInstances();
  const expired = PlaygroundUtils.filterExpired(instances);

  for (const instance of expired) {
    await playground.destroyInstance(instance.provider, instance.id);
    await myStorage.deleteInstance(instance.id);
  }
}, 5 * 60 * 1000);
```

---

## **5. Integration Examples**

* **Express.js API**: `/api/instances`
* **Serverless (AWS Lambda)**: `/lambda/createInstance.ts`
* **Other frameworks**: Same API usage pattern

---

## **6. Best Practices**

1. **Always store instance metadata** immediately after creation.
2. **Implement robust cleanup** for expired instances.
3. **Monitor instance lifecycles** for alerts, logging, and retries.
4. **Use latest LTS images** across providers for stability.
5. **Test multi-cloud failover** setups for reliability.