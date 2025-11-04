/**
 * MIT License - Copyright (c) 2025 Emmanuel Madehin
 * See LICENSE file for full license text
 */

import { Provider, ImageSpec, Instance } from './providers/provider.js';
import * as fs from 'fs';
import * as yaml from 'js-yaml';

/**
 * Image mapping configuration from YAML file
 */
interface ImageMapping {
    provider: string;
    image: string;
    size: string;
    priority: number;
    ttl?: number;
}

/**
 * Arguments for creating a new instance
 */
export interface CreateInstanceArgs {
    /**
     * Image type identifier from mappings.yaml
     * @example 'ubuntu-22-small' | 'debian-11-medium' | 'centos-8-large'
     */
    imageType: string;

    /**
     * Public SSH key for authentication (OpenSSH format)
     * @example 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAAB... user@host'
     */
    sshKey: string;

    /**
     * Optional startup script for VM initialization
     * @example '#!/bin/bash\napt-get update -y\napt-get install -y nginx'
     */
    startupScript?: string;

    /**
     * Preferred cloud provider (optional, will use priority if not specified)
     * @example 'aws' | 'azure' | 'gcp' | 'digitalocean' | 'hetzner' | 'oracle'
     */
    preferredProvider?: string;
}

/**
 * Extended instance information with creation metadata
 */
export interface PlaygroundInstance extends Instance {
    /**
     * Selected provider name
     */
    provider: string;

    /**
     * Image type used for creation
     */
    imageType: string;

    /**
     * Creation timestamp (Unix timestamp)
     */
    createdAt: number;

    /**
     * Time-to-live in seconds
     */
    ttl: number;

    /**
     * SSH key used for authentication
     */
    sshKey: string;
}

/**
 * Playground configuration options
 */
export interface PlaygroundOptions {
    /**
     * Map of cloud providers by name
     */
    providers: Map<string, Provider>;

    /**
     * Path to image mappings YAML file
     * @example './config/image-mappings.yaml' | './examples/image-mappings.yaml'
     * @see https://github.com/tobimadehin/playground/blob/main/examples/image-mappings.yaml
     */
    imageMappingsPath: string;
}

/**
 * Stateless, cloud-agnostic ephemeral VM orchestration engine
 * 
 * The Playground class provides a unified interface for creating and managing
 * ephemeral virtual machines across multiple cloud providers. It handles provider 
 * selection and image mapping, but remains completely stateless - no instance 
 * tracking or storage dependencies.
 * 
 * @example Basic Usage
 * ```typescript
 * import { Playground, HetznerProvider, DigitalOceanProvider } from '@tobimadehin/playground';
 * 
 * const providers = new Map();
 * providers.set('hetzner', new HetznerProvider({ apiToken: process.env.HETZNER_API_TOKEN! }));
 * providers.set('digitalocean', new DigitalOceanProvider({ apiToken: process.env.DO_API_TOKEN! }));
 * 
 * const playground = new Playground({ 
 *   providers,
 *   imageMappingsPath: './examples/image-mappings.yaml'
 * });
 * 
 * // Create an ephemeral VM
 * const instance = await playground.createInstance({
 *   imageType: 'ubuntu-22-small',
 *   sshKey: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAAB... user@host',
 *   startupScript: '#!/bin/bash\napt-get update -y\napt-get install -y htop'
 * });
 * 
 * console.log(`VM created: ${instance.id} at ${instance.ip}`);
 * console.log(`Provider: ${instance.provider}, TTL: ${instance.ttl}s`);
 * 
 * // Destroy when done (you manage the lifecycle)
 * await playground.destroyInstance(instance.provider, instance.id);
 * ```
 * 
 * @example Multi-Provider Setup
 * ```typescript
 * const providers = new Map();
 * providers.set('aws', new AWSProvider({ accessKeyId: '...', secretAccessKey: '...' }));
 * providers.set('azure', new AzureProvider({ subscriptionId: '...', resourceGroupName: '...' }));
 * providers.set('gcp', new GCPProvider({ projectId: '...', zone: 'us-central1-a' }));
 * providers.set('digitalocean', new DigitalOceanProvider({ apiToken: '...' }));
 * providers.set('hetzner', new HetznerProvider({ apiToken: '...' }));
 * providers.set('oracle', new OracleProvider({ tenancyId: '...', userId: '...', ... }));
 * 
 * const playground = new Playground({ providers, imageMappingsPath: './mappings.yaml' });
 * ```
 * 
 * @example External State Management
 * ```typescript
 * // You manage instance tracking however you want
 * const activeInstances = new Map<string, PlaygroundInstance>();
 * 
 * // Create and track
 * const instance = await playground.createInstance({ imageType: 'ubuntu-22-small', sshKey });
 * activeInstances.set(instance.id, instance);
 * 
 * // Your cleanup logic
 * for (const [id, instance] of activeInstances) {
 *   const now = Math.floor(Date.now() / 1000);
 *   if (now >= instance.createdAt + instance.ttl) {
 *     await playground.destroyInstance(instance.provider, id);
 *     activeInstances.delete(id);
 *   }
 * }
 * ```
 * 
 * @see https://github.com/tobimadehin/playground - Project Repository
 */
export class Playground {
    private providers: Map<string, Provider>;
    private imageMappings: Map<string, ImageMapping[]>;

    /**
     * Initialize the stateless Playground orchestration engine
     * 
     * @param options Configuration options for providers and image mappings
     * 
     * @example
     * ```typescript
     * const playground = new Playground({
     *   providers: new Map([
     *     ['hetzner', new HetznerProvider({ apiToken: process.env.HETZNER_API_TOKEN! })],
     *     ['digitalocean', new DigitalOceanProvider({ apiToken: process.env.DO_API_TOKEN! })]
     *   ]),
     *   imageMappingsPath: './examples/image-mappings.yaml'
     * });
     * ```
     */
    constructor(options: PlaygroundOptions) {
        this.providers = options.providers;
        this.imageMappings = new Map();

        this.loadImageMappings(options.imageMappingsPath);
    }

    /**
     * Create a new ephemeral VM instance
     * 
     * Selects the best available provider based on priority, creates the VM,
     * and returns extended metadata. No state is stored - you manage the lifecycle.
     * 
     * @param args Instance creation parameters
     * @returns Promise resolving to the created instance with metadata
     * 
     * @example
     * ```typescript
     * const instance = await playground.createInstance({
     *   imageType: 'ubuntu-22-small',
     *   sshKey: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAAB... user@host',
     *   startupScript: `#!/bin/bash
     *     apt-get update -y
     *     apt-get install -y docker.io
     *     systemctl start docker`,
     *   preferredProvider: 'hetzner'
     * });
     * 
     * console.log(`Created VM ${instance.id} at ${instance.ip}`);
     * console.log(`Provider: ${instance.provider}, expires in ${instance.ttl}s`);
     * 
     * // You decide how to track this instance
     * myDatabase.save(instance);
     * // or
     * myCache.set(instance.id, instance);
     * // or
     * myInstances.push(instance);
     * ```
     * 
     * @throws Error if no suitable provider is available or VM creation fails
     */
    async createInstance(args: CreateInstanceArgs): Promise<PlaygroundInstance> {
        // Get image mappings for the requested image type
        const mappings = this.imageMappings.get(args.imageType);
        if (!mappings || mappings.length === 0) {
            throw new Error(`No image mappings found for image type: ${args.imageType}`);
        }

        // Select provider based on preference or priority
        const selectedMapping = this.selectProvider(mappings, args.preferredProvider);
        const provider = this.providers.get(selectedMapping.provider);

        if (!provider) {
            throw new Error(`Provider '${selectedMapping.provider}' not available`);
        }

        // Create the VM instance
        const imageSpec: ImageSpec = {
            image: selectedMapping.image,
            size: selectedMapping.size
        };

        const instance = await provider.createVM(imageSpec, args.sshKey, args.startupScript);

        // Return extended metadata (but don't store it anywhere)
        return {
            ...instance,
            provider: selectedMapping.provider,
            imageType: args.imageType,
            createdAt: Math.floor(Date.now() / 1000),
            ttl: selectedMapping.ttl || 3600, // Default 1 hour
            sshKey: args.sshKey
        };
    }

    /**
     * Destroy a specific VM instance
     * 
     * @param providerName Name of the cloud provider
     * @param instanceId Cloud provider-specific instance identifier
     * @returns Promise that resolves when the instance is destroyed
     * 
     * @example
     * ```typescript
     * // You know which provider and instance ID
     * await playground.destroyInstance('aws', 'i-1234567890abcdef0');
     * await playground.destroyInstance('digitalocean', '123456789');
     * await playground.destroyInstance('hetzner', '12345678');
     * 
     * // Or from your stored instance data
     * const instance = myDatabase.getInstance(id);
     * await playground.destroyInstance(instance.provider, instance.id);
     * ```
     * 
     * @throws Error if provider is not available or destruction fails
     */
    async destroyInstance(providerName: string, instanceId: string): Promise<void> {
        const provider = this.providers.get(providerName);
        if (!provider) {
            throw new Error(`Provider '${providerName}' not available`);
        }

        await provider.destroyVM(instanceId);
    }

    /**
     * Get current status of a specific instance
     * 
     * @param providerName Name of the cloud provider
     * @param instanceId Cloud provider-specific instance identifier
     * @returns Promise resolving to current instance details
     * 
     * @example
     * ```typescript
     * const instance = await playground.getInstance('aws', 'i-1234567890abcdef0');
     * console.log(`Instance ${instance.id} is at ${instance.ip}`);
     * console.log(`Status:`, instance.providerData?.state);
     * ```
     */
    async getInstance(providerName: string, instanceId: string): Promise<Instance> {
        const provider = this.providers.get(providerName);
        if (!provider) {
            throw new Error(`Provider '${providerName}' not available`);
        }

        return await provider.getVM(instanceId);
    }

    /**
     * Get available image types from mappings
     * 
     * @returns Array of available image type identifiers
     * 
     * @example
     * ```typescript
     * const imageTypes = playground.getAvailableImageTypes();
     * console.log('Available images:', imageTypes);
     * // Output: ['ubuntu-22-small', 'debian-11-medium', 'centos-8-large']
     * ```
     */
    getAvailableImageTypes(): string[] {
        return Array.from(this.imageMappings.keys());
    }

    /**
     * Get available providers
     * 
     * @returns Array of configured provider names
     * 
     * @example
     * ```typescript
     * const providers = playground.getAvailableProviders();
     * console.log('Available providers:', providers);
     * // Output: ['aws', 'azure', 'gcp', 'digitalocean', 'hetzner', 'oracle']
     * ```
     */
    getAvailableProviders(): string[] {
        return Array.from(this.providers.keys());
    }

    /**
     * Get image mappings for a specific image type
     * 
     * @param imageType Image type identifier
     * @returns Array of provider mappings for the image type
     * 
     * @example
     * ```typescript
     * const mappings = playground.getImageMappings('ubuntu-22-small');
     * console.log('Available providers for ubuntu-22-small:', 
     *   mappings.map(m => `${m.provider} (priority: ${m.priority})`));
     * ```
     */
    getImageMappings(imageType: string): ImageMapping[] {
        return this.imageMappings.get(imageType) || [];
    }

    /**
     * Load image mappings from YAML file
     * 
     * @private
     * @param imageMappingsPath Path to the YAML file
     */
    private loadImageMappings(imageMappingsPath: string): void {
        try {
            const yamlContent = fs.readFileSync(imageMappingsPath, 'utf8');
            const mappings = yaml.load(yamlContent) as Record<string, ImageMapping[]>;

            for (const [imageType, configs] of Object.entries(mappings)) {
                this.imageMappings.set(imageType, configs);
            }
        } catch (error) {
            throw new Error(`Failed to load image mappings from ${imageMappingsPath}: ${error}`);
        }
    }

    /**
     * Select the best provider based on preference and priority
     * 
     * @private
     * @param mappings Available provider mappings for an image type
     * @param preferredProvider Optional preferred provider name
     * @returns Selected provider mapping
     */
    private selectProvider(mappings: ImageMapping[], preferredProvider?: string): ImageMapping {
        // If preferred provider is specified and available, use it
        if (preferredProvider) {
            const preferred = mappings.find(m => m.provider === preferredProvider);
            if (preferred && this.providers.has(preferred.provider)) {
                return preferred;
            }
        }

        // Filter to only available providers and sort by priority
        const availableMappings = mappings
            .filter(m => this.providers.has(m.provider))
            .sort((a, b) => a.priority - b.priority);

        if (availableMappings.length === 0) {
            throw new Error('No available providers for the requested image type');
        }

        return availableMappings[0];
    }
}

/**
 * Utility functions for managing instance lifecycles externally
 */
export class PlaygroundUtils {
    /**
     * Check if an instance has expired based on its TTL
     * 
     * @param instance Instance with creation metadata
     * @returns True if the instance has expired
     * 
     * @example
     * ```typescript
     * const instance = await playground.createInstance({ ... });
     * 
     * // Later...
     * if (PlaygroundUtils.isExpired(instance)) {
     *   await playground.destroyInstance(instance.provider, instance.id);
     * }
     * ```
     */
    static isExpired(instance: PlaygroundInstance): boolean {
        const now = Math.floor(Date.now() / 1000);
        return now >= (instance.createdAt + instance.ttl);
    }

    /**
     * Get remaining time until instance expires
     * 
     * @param instance Instance with creation metadata
     * @returns Remaining seconds until expiration (negative if already expired)
     * 
     * @example
     * ```typescript
     * const timeLeft = PlaygroundUtils.getTimeToExpiry(instance);
     * if (timeLeft > 0) {
     *   console.log(`Instance expires in ${timeLeft} seconds`);
     * } else {
     *   console.log(`Instance expired ${Math.abs(timeLeft)} seconds ago`);
     * }
     * ```
     */
    static getTimeToExpiry(instance: PlaygroundInstance): number {
        const now = Math.floor(Date.now() / 1000);
        return (instance.createdAt + instance.ttl) - now;
    }

    /**
     * Filter expired instances from a collection
     * 
     * @param instances Array of instances to filter
     * @returns Array of expired instances
     * 
     * @example
     * ```typescript
     * const allInstances = await myDatabase.getAllInstances();
     * const expired = PlaygroundUtils.filterExpired(allInstances);
     * 
     * for (const instance of expired) {
     *   await playground.destroyInstance(instance.provider, instance.id);
     *   await myDatabase.deleteInstance(instance.id);
     * }
     * ```
     */
    static filterExpired(instances: PlaygroundInstance[]): PlaygroundInstance[] {
        return instances.filter(instance => PlaygroundUtils.isExpired(instance));
    }

    /**
     * Filter active (non-expired) instances from a collection
     * 
     * @param instances Array of instances to filter
     * @returns Array of active instances
     */
    static filterActive(instances: PlaygroundInstance[]): PlaygroundInstance[] {
        return instances.filter(instance => !PlaygroundUtils.isExpired(instance));
    }
}