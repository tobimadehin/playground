/**
 * MIT License - Copyright (c) 2025 Emmanuel Madehin
 * See LICENSE file for full license text
 */

/**
 * Cloud provider interface for ephemeral VM management
 * 
 * Defines the standard contract that all cloud providers must implement
 * for creating, managing, and destroying virtual machines across different
 * cloud platforms (AWS, Azure, GCP, DigitalOcean, Oracle Cloud, etc.).
 * 
 * @example Implementing a Custom Provider
 * ```typescript
 * import { Provider, ImageSpec, Instance } from '@tobimadehin/playground';
 * 
 * export class MyCloudProvider implements Provider {
 *   async createVM(spec: ImageSpec, sshKey: string, startupScript?: string): Promise<Instance> {
 *     // Your cloud-specific VM creation logic
 *     const vm = await this.cloudAPI.createInstance({
 *       image: spec.image,
 *       size: spec.size,
 *       sshKey,
 *       userData: startupScript
 *     });
 *     
 *     return {
 *       id: vm.id,
 *       ip: vm.publicIP,
 *       providerData: { status: vm.state, region: vm.region }
 *     };
 *   }
 *   
 *   async destroyVM(instanceId: string): Promise<void> {
 *     await this.cloudAPI.terminateInstance(instanceId);
 *   }
 *   
 *   async getVM(instanceId: string): Promise<Instance> {
 *     const vm = await this.cloudAPI.getInstance(instanceId);
 *     return {
 *       id: vm.id,
 *       ip: vm.publicIP,
 *       providerData: { status: vm.state }
 *     };
 *   }
 * }
 * ```
 * 
 * @example Using with Playground
 * ```typescript
 * import { Playground, InMemoryStorage } from '@tobimadehin/playground';
 * 
 * const providers = new Map();
 * providers.set('mycloud', new MyCloudProvider(config));
 * 
 * const playground = new Playground({
 *   storage: new InMemoryStorage(),
 *   providers
 * });
 * ```
 */
export interface Provider {
    /**
     * Create a new virtual machine instance
     * 
     * @param spec VM image and size specification
     * @param sshKey Public SSH key for authentication (OpenSSH format)
     * @param startupScript Optional initialization script (cloud-init, user data, etc.)
     * @returns Promise resolving to instance metadata with ID and IP address
     * 
     * @example
     * ```typescript
     * const instance = await provider.createVM(
     *   { image: 'ubuntu-22-04', size: 'small' },
     *   'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAAB... user@host',
     *   '#!/bin/bash\napt-get update -y\napt-get install -y nginx'
     * );
     * 
     * console.log(`Created VM ${instance.id} at ${instance.ip}`);
     * ```
     * 
     * @throws Error if VM creation fails (insufficient quota, invalid image, network issues, etc.)
     */
    createVM(spec: ImageSpec, sshKey: string, startupScript?: string): Promise<Instance>;

    /**
     * Destroy a virtual machine instance and clean up associated resources
     * 
     * @param instanceId Cloud provider-specific instance identifier
     * @returns Promise that resolves when the instance is terminated
     * 
     * @example
     * ```typescript
     * await provider.destroyVM('i-1234567890abcdef0');  // AWS
     * await provider.destroyVM('123456789');            // DigitalOcean
     * await provider.destroyVM('vm-name-123');          // Azure/GCP
     * ```
     * 
     * @throws Error if instance doesn't exist or cannot be terminated
     */
    destroyVM(instanceId: string): Promise<void>;

    /**
     * Get current status and details of a virtual machine instance
     * 
     * @param instanceId Cloud provider-specific instance identifier
     * @returns Promise resolving to current instance metadata
     * 
     * @example
     * ```typescript
     * const instance = await provider.getVM('i-1234567890abcdef0');
     * 
     * console.log(`VM ${instance.id} status:`, instance.providerData?.state);
     * console.log(`Public IP: ${instance.ip}`);
     * 
     * // Check if VM is ready
     * if (instance.providerData?.state === 'running' && instance.ip) {
     *   console.log('VM is ready for SSH access');
     * }
     * ```
     * 
     * @throws Error if instance doesn't exist or cannot be queried
     */
    getVM(instanceId: string): Promise<Instance>;
}

/**
 * Virtual machine image and size specification
 * 
 * Defines the VM configuration including the operating system image
 * and compute resources (CPU, memory, storage) across different cloud providers.
 * 
 * @example AWS EC2
 * ```typescript
 * const spec: ImageSpec = {
 *   image: 'ami-0abcdef1234567890',  // AMI ID
 *   size: 't3.micro'                // Instance type
 * };
 * ```
 * 
 * @example DigitalOcean
 * ```typescript
 * const spec: ImageSpec = {
 *   image: 'ubuntu-22-04-x64',      // Image slug
 *   size: 's-1vcpu-1gb'            // Droplet size
 * };
 * ```
 * 
 * @example Google Cloud Platform
 * ```typescript
 * const spec: ImageSpec = {
 *   image: 'projects/ubuntu-os-cloud/global/images/family/ubuntu-2204-lts',
 *   size: 'e2-micro'               // Machine type
 * };
 * ```
 * 
 * @example Microsoft Azure
 * ```typescript
 * const spec: ImageSpec = {
 *   image: 'Canonical:0001-com-ubuntu-server-jammy:22_04-lts-gen2:latest',
 *   size: 'Standard_B1s'           // VM size
 * };
 * ```
 * 
 * @example Oracle Cloud Infrastructure
 * ```typescript
 * const spec: ImageSpec = {
 *   image: 'ocid1.image.oc1.iad.aaaaaaaa...',  // Image OCID
 *   size: 'VM.Standard.E4.Flex'               // Compute shape
 * };
 * ```
 */
export type ImageSpec = {
    /**
     * Cloud provider-specific image identifier
     * 
     * @example AWS: 'ami-0abcdef1234567890' (AMI ID)
     * @example DigitalOcean: 'ubuntu-22-04-x64' (image slug)
     * @example GCP: 'projects/ubuntu-os-cloud/global/images/family/ubuntu-2204-lts' (image URL)
     * @example Azure: 'Canonical:0001-com-ubuntu-server-jammy:22_04-lts-gen2:latest' (publisher:offer:sku:version)
     * @example Oracle: 'ocid1.image.oc1.iad.aaaaaaaa...' (image OCID)
     */
    image: string;

    /**
     * Cloud provider-specific instance size/type identifier
     * 
     * @example AWS: 't3.micro' | 't3.small' | 'm5.large' (instance types)
     * @example DigitalOcean: 's-1vcpu-1gb' | 's-2vcpu-2gb' (droplet sizes)
     * @example GCP: 'e2-micro' | 'n1-standard-1' (machine types)
     * @example Azure: 'Standard_B1s' | 'Standard_D2s_v3' (VM sizes)
     * @example Oracle: 'VM.Standard.E4.Flex' | 'VM.Standard2.1' (compute shapes)
     */
    size: string;
};

/**
 * Virtual machine instance metadata
 * 
 * Standardized representation of a VM instance across different cloud providers,
 * containing essential information needed for management and access.
 * 
 * @example AWS EC2 Instance
 * ```typescript
 * const instance: Instance = {
 *   id: 'i-1234567890abcdef0',
 *   ip: '54.123.45.67',
 *   providerData: {
 *     state: 'running',
 *     instanceType: 't3.micro',
 *     availabilityZone: 'us-east-1a'
 *   }
 * };
 * ```
 * 
 * @example DigitalOcean Droplet
 * ```typescript
 * const instance: Instance = {
 *   id: '123456789',
 *   ip: '64.225.123.45',
 *   providerData: {
 *     name: 'playground-1699123456789',
 *     status: 'active',
 *     region: 'nyc3'
 *   }
 * };
 * ```
 * 
 * @example Google Cloud VM
 * ```typescript
 * const instance: Instance = {
 *   id: '1234567890123456789',
 *   ip: '34.123.45.67',
 *   providerData: {
 *     name: 'playground-1699123456789',
 *     status: 'RUNNING',
 *     zone: 'us-central1-a'
 *   }
 * };
 * ```
 * 
 * @example Azure VM
 * ```typescript
 * const instance: Instance = {
 *   id: 'playground-1699123456789',
 *   ip: '20.123.45.67',
 *   providerData: {
 *     resourceGroup: 'playground-rg',
 *     location: 'East US',
 *     vmSize: 'Standard_B1s',
 *     provisioningState: 'Succeeded'
 *   }
 * };
 * ```
 * 
 * @example Oracle Cloud Instance
 * ```typescript
 * const instance: Instance = {
 *   id: 'ocid1.instance.oc1.iad.aaaaaaaa...',
 *   ip: '129.213.123.45',
 *   providerData: {
 *     state: 'RUNNING',
 *     shape: 'VM.Standard.E4.Flex',
 *     availabilityDomain: 'kWVD:US-ASHBURN-AD-1'
 *   }
 * };
 * ```
 */
export type Instance = {
    /**
     * Cloud provider-specific unique instance identifier
     * 
     * @example AWS: 'i-1234567890abcdef0' (instance ID)
     * @example DigitalOcean: '123456789' (droplet ID)
     * @example GCP: '1234567890123456789' (instance ID) or 'vm-name' (instance name)
     * @example Azure: 'vm-name-123' (VM name)
     * @example Oracle: 'ocid1.instance.oc1.iad.aaaaaaaa...' (instance OCID)
     */
    id: string;

    /**
     * Public IP address for external access
     * 
     * @example '54.123.45.67' | '64.225.123.45' | '34.123.45.67'
     * 
     * @remarks
     * - Empty string if no public IP is assigned
     * - May be IPv4 or IPv6 depending on provider configuration
     * - Used for SSH access and external connectivity
     */
    ip: string;

    /**
     * Cloud provider-specific metadata and extended information
     * 
     * @example AWS providerData
     * ```typescript
     * {
     *   state: 'running' | 'pending' | 'stopping' | 'stopped',
     *   instanceType: 't3.micro',
     *   availabilityZone: 'us-east-1a'
     * }
     * ```
     * 
     * @example DigitalOcean providerData
     * ```typescript
     * {
     *   name: 'playground-1699123456789',
     *   status: 'new' | 'active' | 'off' | 'archive',
     *   region: 'nyc3'
     * }
     * ```
     * 
     * @example GCP providerData
     * ```typescript
     * {
     *   name: 'playground-1699123456789',
     *   status: 'PROVISIONING' | 'STAGING' | 'RUNNING' | 'STOPPING',
     *   zone: 'us-central1-a'
     * }
     * ```
     * 
     * @remarks
     * - Contains provider-specific status, configuration, and metadata
     * - Structure varies by cloud provider
     * - Optional field that may be undefined for minimal implementations
     */
    providerData?: any;
};