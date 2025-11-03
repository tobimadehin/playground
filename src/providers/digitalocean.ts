/**
 * MIT License - Copyright (c) 2025 Emmanuel Madehin
 * See LICENSE file for full license text
 */

import { Provider, ImageSpec, Instance } from '@/providers/provider';

/**
 * DigitalOcean Provider configuration
 * 
 * @example
 * ```typescript
 * const config: DigitalOceanConfig = {
 *   apiToken: 'dop_v1_your_token_here',
 *   defaultRegion: 'nyc3'
 * };
 * ```
 */
export interface DigitalOceanConfig {
  /**
   * DigitalOcean API token for authentication
   * @example 'dop_v1_your_token_here'
   * @see https://docs.digitalocean.com/reference/api/create-personal-access-token/
   */
  apiToken: string;

  /**
   * Default region for droplet deployment
   * @example 'nyc1' | 'nyc3' | 'ams3' | 'sfo3' | 'sgp1' | 'lon1' | 'fra1' | 'tor1' | 'blr1' | 'syd1'
   * @default 'nyc3'
   * @see https://docs.digitalocean.com/products/platform/availability-matrix/
   */
  defaultRegion?: string;
}

/**
 * DigitalOcean cloud provider for ephemeral VMs using Droplets
 * 
 * Supports creating, managing, and destroying DigitalOcean Droplets with automatic
 * SSH key management, cloud-init script injection, and proper resource cleanup.
 * 
 * Depends on DigitalOcean API v2.
 * 
 * @example Basic Usage
 * ```typescript
 * import { DigitalOceanProvider } from '@tobimadehin/playground';
 * 
 * const provider = new DigitalOceanProvider({
 *   apiToken: process.env.DO_API_TOKEN!,
 *   defaultRegion: 'nyc3'
 * });
 * 
 * // Create a droplet
 * const instance = await provider.createVM(
 *   { image: 'ubuntu-22-04-x64', size: 's-1vcpu-1gb' },
 *   'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAAB... user@host'
 * );
 * 
 * console.log(`Droplet created: ${instance.id} at ${instance.ip}`);
 * 
 * // Clean up
 * await provider.destroyVM(instance.id);
 * ```
 * 
 * @example With Cloud-Init Script
 * ```typescript
 * const cloudConfig = `#!/bin/bash
 * apt-get update -y
 * apt-get install -y nginx
 * systemctl start nginx
 * systemctl enable nginx
 * ufw allow 'Nginx Full'`;
 * 
 * const instance = await provider.createVM(
 *   { image: 'ubuntu-22-04-x64', size: 's-2vcpu-2gb' },
 *   sshPublicKey,
 *   cloudConfig
 * );
 * ```
 * 
 * @example Multi-Region Deployment
 * ```typescript
 * const providers = [
 *   new DigitalOceanProvider({ apiToken: token, defaultRegion: 'nyc3' }),
 *   new DigitalOceanProvider({ apiToken: token, defaultRegion: 'fra1' }),
 *   new DigitalOceanProvider({ apiToken: token, defaultRegion: 'sgp1' })
 * ];
 * ```
 * 
 * @requires DigitalOcean API token with read/write permissions
 * 
 * @see https://docs.digitalocean.com/products/droplets/ - DigitalOcean Droplets
 * @see https://docs.digitalocean.com/reference/api/api-reference/ - API Reference
 * @see https://docs.digitalocean.com/products/droplets/how-to/create/ - Creating Droplets
 * @see https://docs.digitalocean.com/reference/api/create-personal-access-token/ - API Authentication
 */
export class DigitalOceanProvider implements Provider {
  private apiToken: string;
  private defaultRegion: string;
  private baseUrl = 'https://api.digitalocean.com/v2';

  /**
   * Initialize DigitalOcean provider with API token authentication
   * 
   * @param config DigitalOcean configuration object
   * 
   * @example
   * ```typescript
   * const provider = new DigitalOceanProvider({
   *   apiToken: process.env.DO_API_TOKEN!,
   *   defaultRegion: 'fra1'  // Frankfurt region
   * });
   * ```
   * 
   * @see https://docs.digitalocean.com/reference/api/create-personal-access-token/
   */
  constructor(config: DigitalOceanConfig) {
    this.apiToken = config.apiToken;
    this.defaultRegion = config.defaultRegion || 'nyc3';
  }

  /**
   * Create an ephemeral DigitalOcean Droplet
   * 
   * @param spec Droplet image and size specification
   * @param spec.image DigitalOcean image slug or ID
   * @param spec.size DigitalOcean droplet size slug
   * @param sshKey Public SSH key for authentication
   * @param startupScript Optional cloud-init script for droplet initialization
   * @returns Instance metadata including public IP address
   * 
   * @example
   * ```typescript
   * const instance = await provider.createVM(
   *   {
   *     image: 'ubuntu-22-04-x64',  // Ubuntu 22.04 LTS
   *     size: 's-1vcpu-1gb'        // 1 vCPU, 1 GB RAM
   *   },
   *   'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAAB... user@host',
   *   `#!/bin/bash
   *    apt-get update -y
   *    apt-get install -y htop
   *    echo "Hello from DigitalOcean!" > /tmp/welcome.txt`
   * );
   * 
   * // Common DigitalOcean images:
   * // ubuntu-22-04-x64 - Ubuntu 22.04 LTS x64
   * // ubuntu-20-04-x64 - Ubuntu 20.04 LTS x64
   * // debian-11-x64 - Debian 11 x64
   * // centos-stream-9-x64 - CentOS Stream 9 x64
   * // fedora-38-x64 - Fedora 38 x64
   * 
   * // Common droplet sizes:
   * // s-1vcpu-1gb - 1 vCPU, 1 GB RAM, 25 GB SSD ($6/month)
   * // s-1vcpu-2gb - 1 vCPU, 2 GB RAM, 50 GB SSD ($12/month)
   * // s-2vcpu-2gb - 2 vCPU, 2 GB RAM, 60 GB SSD ($18/month)
   * // s-2vcpu-4gb - 2 vCPU, 4 GB RAM, 80 GB SSD ($24/month)
   * 
   * @see https://docs.digitalocean.com/products/droplets/how-to/create/ - Creating Droplets
   * @see https://docs.digitalocean.com/reference/api/api-reference/#tag/Images - Available Images
   * @see https://docs.digitalocean.com/reference/api/api-reference/#tag/Sizes - Droplet Sizes
   * @see https://docs.digitalocean.com/products/droplets/how-to/automate-setup-with-cloud-init/ - Cloud-Init Guide
   * ```
   */
  async createVM(spec: ImageSpec, sshKey: string, startupScript?: string): Promise<Instance> {
    const headers = {
      'Authorization': `Bearer ${this.apiToken}`,
      'Content-Type': 'application/json'
    };

    // Create SSH key if not exists
    const sshKeyId = await this.ensureSSHKey(sshKey);

    const createPayload = {
      name: `playground-${Date.now()}`,
      region: this.defaultRegion,
      size: spec.size,
      image: spec.image,
      ssh_keys: [sshKeyId],
      user_data: startupScript || undefined,
      monitoring: false,
      ipv6: false,
      vpc_uuid: null,
      tags: ['playground', 'ephemeral']
    };

    const response = await fetch(`${this.baseUrl}/droplets`, {
      method: 'POST',
      headers,
      body: JSON.stringify(createPayload)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`DigitalOcean API error: ${error.message || response.statusText}`);
    }

    const data = await response.json();
    const droplet = data.droplet;

    // Wait for droplet to get IP address
    await this.waitForDropletReady(droplet.id);
    const dropletDetails = await this.getDropletDetails(droplet.id);

    const publicIp = dropletDetails.networks.v4.find((net: any) => net.type === 'public')?.ip_address;

    return {
      id: droplet.id.toString(),
      ip: publicIp || '',
      providerData: {
        name: droplet.name,
        status: dropletDetails.status,
        region: this.defaultRegion
      }
    };
  }

  /**
   * Destroy a DigitalOcean Droplet and clean up resources
   * 
   * @param instanceId DigitalOcean Droplet ID to destroy
   * 
   * @example
   * ```typescript
   * await provider.destroyVM('123456789');
   * 
   * // Droplet IDs are numeric strings
   * // Examples:
   * // '123456789'
   * // '987654321'
   * ```
   * 
   * @see https://docs.digitalocean.com/reference/api/api-reference/#operation/droplets_destroy
   */
  async destroyVM(instanceId: string): Promise<void> {
    const headers = {
      'Authorization': `Bearer ${this.apiToken}`
    };

    const response = await fetch(`${this.baseUrl}/droplets/${instanceId}`, {
      method: 'DELETE',
      headers
    });

    if (!response.ok && response.status !== 404) {
      const error = await response.json();
      throw new Error(`DigitalOcean API error: ${error.message || response.statusText}`);
    }
  }

  /**
   * Get DigitalOcean Droplet details and current status
   * 
   * @param instanceId DigitalOcean Droplet ID to query
   * @returns Instance metadata with current state and IP addresses
   * 
   * @example
   * ```typescript
   * const instance = await provider.getVM('123456789');
   * 
   * // Droplet IDs are numeric strings
   * // Examples:
   * // '123456789'
   * // '987654321'
   * 
   * console.log(instance);
   * // Output:
   * // {
   * //   id: '123456789',
   * //   ip: '64.225.123.45',
   * //   providerData: {
   * //     name: 'playground-1699123456789',
   * //     status: 'active',
   * //     region: 'nyc3'
   * //   }
   * // }
   * 
   * // Possible statuses: new | active | off | archive
   * ```
   * 
   * @see https://docs.digitalocean.com/reference/api/api-reference/#operation/droplets_get
   */
  async getVM(instanceId: string): Promise<Instance> {
    const droplet = await this.getDropletDetails(instanceId);
    const publicIp = droplet.networks.v4.find((net: any) => net.type === 'public')?.ip_address;

    return {
      id: droplet.id.toString(),
      ip: publicIp || '',
      providerData: {
        name: droplet.name,
        status: droplet.status,
        region: droplet.region.slug
      }
    };
  }

  /**
   * Ensure the public SSH key exists in DigitalOcean account
   * 
   * @param publicKey SSH public key content
   * @returns SSH key fingerprint for use in droplet creation
   * 
   * @example
   * ```typescript
   * // Input SSH key format:
   * const sshKey = 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQ... user@hostname';
   * 
   * // Generated key name format:
   * // 'playground-key-AbCdEfGh' (8 character hash suffix)
   * 
   * // Returns fingerprint format:
   * // 'aa:bb:cc:dd:ee:ff:00:11:22:33:44:55:66:77:88:99'
   * ```
   */
  private async ensureSSHKey(publicKey: string): Promise<string> {
    const headers = {
      'Authorization': `Bearer ${this.apiToken}`,
      'Content-Type': 'application/json'
    };

    // Generate fingerprint-like name from key
    const keyHash = Buffer.from(publicKey).toString('base64').slice(0, 8);
    const keyName = `playground-key-${keyHash}`;

    // Try to create the key (will fail if exists)
    try {
      const response = await fetch(`${this.baseUrl}/account/keys`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: keyName,
          public_key: publicKey
        })
      });

      if (response.ok) {
        const data = await response.json();
        return data.ssh_key.fingerprint;
      }
    } catch (error) {
      // Key might already exist, try to find it
    }

    // List existing keys to find matching one
    const listResponse = await fetch(`${this.baseUrl}/account/keys`, { headers });
    const listData = await listResponse.json();

    const existingKey = listData.ssh_keys.find((key: any) =>
      key.public_key.trim() === publicKey.trim()
    );

    if (existingKey) {
      return existingKey.fingerprint;
    }

    throw new Error('Failed to create or find SSH key in DigitalOcean');
  }

  /**
   * Wait for droplet to become active and have a public IP address
   * 
   * @param dropletId DigitalOcean Droplet ID to monitor
   * @throws Error if droplet doesn't become ready within timeout (90 seconds)
   * 
   * @example
   * ```typescript
   * // Waits for droplet state transitions:
   * // new -> active (with public IP address assigned)
   * // 
   * // Timeout: 30 attempts × 3 seconds = 90 seconds maximum wait
   * ```
   */
  private async waitForDropletReady(dropletId: number): Promise<void> {
    const maxAttempts = 30;
    const delay = 3000; // 3 seconds

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const droplet = await this.getDropletDetails(dropletId);

      if (droplet.status === 'active' && droplet.networks.v4.length > 0) {
        const hasPublicIp = droplet.networks.v4.some((net: any) => net.type === 'public');
        if (hasPublicIp) {
          return;
        }
      }

      await new Promise(resolve => setTimeout(resolve, delay));
    }

    throw new Error('Droplet failed to become ready within timeout');
  }

  /**
   * Get detailed information about a specific droplet
   * 
   * @param dropletId DigitalOcean Droplet ID to query
   * @returns Raw droplet object from DigitalOcean API
   * 
   * @example
   * ```typescript
   * // Returns droplet object with properties:
   * // - id: number
   * // - name: string
   * // - status: 'new' | 'active' | 'off' | 'archive'
   * // - networks: { v4: Array<{ip_address: string, type: 'public'|'private'}> }
   * // - region: { slug: string }
   * ```
   */
  private async getDropletDetails(dropletId: number | string): Promise<any> {
    const headers = {
      'Authorization': `Bearer ${this.apiToken}`
    };

    const response = await fetch(`${this.baseUrl}/droplets/${dropletId}`, { headers });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`DigitalOcean API error: ${error.message || response.statusText}`);
    }

    const data = await response.json();
    return data.droplet;
  }
}