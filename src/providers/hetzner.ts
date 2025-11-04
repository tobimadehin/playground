/**
 * MIT License - Copyright (c) 2025 Emmanuel Madehin
 * See LICENSE file for full license text
 */

import { Provider, ImageSpec, Instance } from './provider.js';

/**
 * Hetzner Cloud Provider configuration
 * 
 * @example
 * ```typescript
 * const config: HetznerConfig = {
 *   apiToken: 'your_hetzner_api_token_here',
 *   defaultLocation: 'nbg1'
 * };
 * ```
 */
export interface HetznerConfig {
    /**
     * Hetzner Cloud API token for authentication
     * @example 'your_hetzner_api_token_here'
     * @see https://docs.hetzner.cloud/#authentication
     */
    apiToken: string;

    /**
     * Default location for server deployment
     * @example 'nbg1' | 'fsn1' | 'hel1' | 'ash' | 'hil'
     * @default 'nbg1'
     * @see https://docs.hetzner.cloud/#locations
     */
    defaultLocation?: string;
}

/**
 * Hetzner Cloud provider for ephemeral VMs using dedicated servers
 * 
 * Supports creating, managing, and destroying Hetzner Cloud servers with automatic
 * SSH key management, cloud-init script injection, and proper resource cleanup.
 * Uses the official Hetzner Cloud API v1 directly.
 * 
 * @example Basic Usage
 * ```typescript
 * import { HetznerProvider } from '@tobimadehin/playground';
 * 
 * const provider = new HetznerProvider({
 *   apiToken: process.env.HETZNER_API_TOKEN!,
 *   defaultLocation: 'nbg1'
 * });
 * 
 * // Create a server
 * const instance = await provider.createVM(
 *   { image: 'ubuntu-22.04', size: 'cx11' },
 *   'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAAB... user@host'
 * );
 * 
 * console.log(`Server created: ${instance.id} at ${instance.ip}`);
 * 
 * // Clean up
 * await provider.destroyVM(instance.id);
 * ```
 * 
 * @example With Cloud-Init Script
 * ```typescript
 * const cloudInit = `#!/bin/bash
 * apt-get update -y
 * apt-get install -y docker.io
 * systemctl start docker
 * systemctl enable docker
 * usermod -aG docker root`;
 * 
 * const instance = await provider.createVM(
 *   { image: 'ubuntu-22.04', size: 'cx21' },
 *   sshPublicKey,
 *   cloudInit
 * );
 * ```
 * 
 * @example Multi-Location Deployment
 * ```typescript
 * const providers = [
 *   new HetznerProvider({ apiToken: token, defaultLocation: 'nbg1' }),  // Nuremberg
 *   new HetznerProvider({ apiToken: token, defaultLocation: 'fsn1' }),  // Falkenstein
 *   new HetznerProvider({ apiToken: token, defaultLocation: 'hel1' })   // Helsinki
 * ];
 * ```
 * 
 * @requires Hetzner Cloud API token with read/write permissions
 * 
 * @see https://docs.hetzner.cloud/ - Hetzner Cloud API Documentation
 * @see https://docs.hetzner.cloud/#servers - Server Management
 * @see https://docs.hetzner.cloud/#server-types - Server Types and Pricing
 * @see https://docs.hetzner.cloud/#authentication - API Authentication
 */
export class HetznerProvider implements Provider {
    private apiToken: string;
    private defaultLocation: string;
    private baseUrl = 'https://api.hetzner.cloud/v1';

    /**
     * Initialize Hetzner Cloud provider with API token authentication
     * 
     * @param config Hetzner Cloud configuration object
     * 
     * @example
     * ```typescript
     * const provider = new HetznerProvider({
     *   apiToken: process.env.HETZNER_API_TOKEN!,
     *   defaultLocation: 'fsn1'  // Falkenstein, Germany
     * });
     * ```
     * 
     * @see https://docs.hetzner.cloud/#authentication
     */
    constructor(config: HetznerConfig) {
        this.apiToken = config.apiToken;
        this.defaultLocation = config.defaultLocation || 'nbg1';
    }

    /**
     * Create an ephemeral Hetzner Cloud server
     * 
     * @param spec Server image and type specification
     * @param spec.image Hetzner Cloud image name or ID
     * @param spec.size Hetzner Cloud server type
     * @param sshKey Public SSH key for authentication
     * @param startupScript Optional cloud-init script for server initialization
     * @returns Instance metadata including public IP address
     * 
     * @example
     * ```typescript
     * const instance = await provider.createVM(
     *   {
     *     image: 'ubuntu-22.04',  // Ubuntu 22.04 LTS
     *     size: 'cx11'           // 1 vCPU, 4 GB RAM, 40 GB SSD
     *   },
     *   'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAAB... user@host',
     *   `#!/bin/bash
     *    apt-get update -y
     *    apt-get install -y nginx
     *    systemctl start nginx`
     * );
     * 
     * // Common Hetzner Cloud images:
     * // ubuntu-22.04 - Ubuntu 22.04 LTS
     * // ubuntu-20.04 - Ubuntu 20.04 LTS
     * // debian-11 - Debian 11
     * // centos-stream-9 - CentOS Stream 9
     * // fedora-38 - Fedora 38
     * 
     * // Common server types:
     * // cx11 - 1 vCPU, 4 GB RAM, 40 GB SSD (€4.15/month)
     * // cx21 - 2 vCPU, 8 GB RAM, 80 GB SSD (€8.30/month)
     * // cx31 - 2 vCPU, 16 GB RAM, 160 GB SSD (€16.59/month)
     * // cx41 - 4 vCPU, 32 GB RAM, 320 GB SSD (€33.18/month)
     * 
     * @see https://docs.hetzner.cloud/#servers-create-a-server - Creating Servers
     * @see https://docs.hetzner.cloud/#images - Available Images
     * @see https://docs.hetzner.cloud/#server-types - Server Types and Pricing
     * @see https://docs.hetzner.cloud/#user-data - Cloud-Init User Data
     * ```
     */
    async createVM(spec: ImageSpec, sshKey: string, startupScript?: string): Promise<Instance> {
        const sshKeyId = await this.ensureSSHKey(sshKey);

        const payload = {
            name: `playground-${Date.now()}`,
            server_type: spec.size,
            image: spec.image,
            location: this.defaultLocation,
            ssh_keys: [sshKeyId],
            user_data: startupScript,
            start_after_create: true,
        };

        const server = await this.makeRequest('/servers', 'POST', payload);

        await this.waitForServerReady(server.id);
        const serverDetails = await this.getServerDetails(server.id);

        return {
            id: server.id.toString(),
            ip: serverDetails.public_net.ipv4.ip,
            providerData: {
                name: server.name,
                status: server.status,
                location: server.datacenter.location.name,
            },
        };
    }

    /**
     * Destroy a Hetzner Cloud server and clean up resources
     * 
     * @param instanceId Hetzner Cloud server ID to destroy
     * 
     * @example
     * ```typescript
     * await provider.destroyVM('12345678');
     * 
     * // Server IDs are numeric strings
     * // Examples:
     * // '12345678'
     * // '87654321'
     * ```
     * 
     * @see https://docs.hetzner.cloud/#servers-delete-a-server
     */
    async destroyVM(instanceId: string | number): Promise<void> {
        try {
            await this.makeRequest(`/servers/${instanceId}`, 'DELETE');
        } catch (err: any) {
            if (!err.message.includes('not found')) throw err;
        }
    }

    /**
     * Get Hetzner Cloud server details and current status
     * 
     * @param instanceId Hetzner Cloud server ID to query
     * @returns Instance metadata with current state and IP addresses
     * 
     * @example
     * ```typescript
     * const instance = await provider.getVM('12345678');
     * 
     * console.log(instance);
     * // Output:
     * // {
     * //   id: '12345678',
     * //   ip: '78.46.123.45',
     * //   providerData: {
     * //     name: 'playground-1699123456789',
     * //     status: 'running',
     * //     location: 'Nuremberg'
     * //   }
     * // }
     * 
     * // Possible statuses: initializing | starting | running | stopping | off
     * ```
     * 
     * @see https://docs.hetzner.cloud/#servers-get-a-server
     */
    async getVM(instanceId: string | number): Promise<Instance> {
        const server = await this.getServerDetails(instanceId);
        return {
            id: server.id.toString(),
            ip: server.public_net.ipv4?.ip || '',
            providerData: {
                name: server.name,
                status: server.status,
                location: server.datacenter.location.name,
            },
        };
    }

    /** -------------------- Private Helpers -------------------- */

    /**
     * Ensure the public SSH key exists in Hetzner Cloud account
     * 
     * @param publicKey SSH public key content
     * @returns SSH key ID for use in server creation
     * 
     * @example
     * ```typescript
     * // Input SSH key format:
     * const sshKey = 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQ... user@hostname';
     * 
     * // Generated key name format:
     * // 'playground-key-AbCdEfGh' (8 character hash suffix)
     * 
     * // Returns numeric key ID:
     * // 1234567
     * ```
     */
    private async ensureSSHKey(publicKey: string): Promise<number> {
        const keyName = `playground-key-${Buffer.from(publicKey).toString('base64').slice(0, 8)}`;

        // Try creating key
        try {
            const key = await this.makeRequest('/ssh_keys', 'POST', { name: keyName, public_key: publicKey });
            return key.ssh_key.id;
        } catch {
            // fallback to find existing
            const keys = await this.makeRequest('/ssh_keys', 'GET');
            const existing = keys.ssh_keys.find((k: any) => k.public_key.trim() === publicKey.trim());
            if (existing) return existing.id;
        }

        throw new Error('Failed to create or find SSH key in Hetzner');
    }

    /**
     * Wait for server to become running and have a public IP address
     * 
     * @param serverId Hetzner Cloud server ID to monitor
     * @throws Error if server doesn't become ready within timeout (60 seconds)
     * 
     * @example
     * ```typescript
     * // Waits for server state transitions:
     * // initializing -> starting -> running (with public IP assigned)
     * // 
     * // Timeout: 30 attempts × 2 seconds = 60 seconds maximum wait
     * ```
     */
    private async waitForServerReady(serverId: number): Promise<void> {
        const maxAttempts = 30;
        const delay = 2000; // 2 sec

        for (let i = 0; i < maxAttempts; i++) {
            const server = await this.getServerDetails(serverId);
            if (server.status === 'running' && server.public_net.ipv4?.ip) return;
            await new Promise((r) => setTimeout(r, delay));
        }

        throw new Error('Server failed to become ready within timeout');
    }

    /**
     * Get detailed information about a specific server
     * 
     * @param serverId Hetzner Cloud server ID to query
     * @returns Raw server object from Hetzner Cloud API
     * 
     * @example
     * ```typescript
     * // Returns server object with properties:
     * // - id: number
     * // - name: string
     * // - status: 'initializing' | 'starting' | 'running' | 'stopping' | 'off'
     * // - public_net: { ipv4: { ip: string } }
     * // - datacenter: { location: { name: string } }
     * ```
     */
    private async getServerDetails(serverId: string | number): Promise<any> {
        return this.makeRequest(`/servers/${serverId}`, 'GET');
    }

    /**
     * Make authenticated HTTP request to Hetzner Cloud API
     * 
     * @param path API endpoint path (e.g., '/servers', '/ssh_keys')
     * @param method HTTP method
     * @param body Request payload for POST requests
     * @returns Parsed JSON response from API
     * 
     * @example
     * ```typescript
     * // GET request
     * const servers = await this.makeRequest('/servers', 'GET');
     * 
     * // POST request with body
     * const server = await this.makeRequest('/servers', 'POST', {
     *   name: 'my-server',
     *   server_type: 'cx11',
     *   image: 'ubuntu-22.04'
     * });
     * 
     * // DELETE request
     * await this.makeRequest('/servers/12345', 'DELETE');
     * ```
     * 
     * @throws Error with Hetzner API error message if request fails
     */
    private async makeRequest(path: string, method: 'GET' | 'POST' | 'DELETE', body?: any): Promise<any> {
        const headers: Record<string, string> = {
            Authorization: `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
        };

        const response = await fetch(`${this.baseUrl}${path}`, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({}));
            throw new Error(`Hetzner API error: ${errorBody.error?.message || response.statusText}`);
        }

        if (response.status === 204) return {}; // No content for DELETE
        return response.json();
    }
}
