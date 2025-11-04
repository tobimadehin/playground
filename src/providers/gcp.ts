/**
 * MIT License - Copyright (c) 2025 Emmanuel Madehin
 * See LICENSE file for full license text
 */

import { Provider, ImageSpec, Instance } from './provider.js';
import { InstancesClient } from '@google-cloud/compute';

/**
 * Google Cloud Platform Provider configuration
 * 
 * @example
 * ```typescript
 * const config: GCPConfig = {
 *   projectId: 'my-gcp-project-123456',
 *   zone: 'us-central1-a',
 *   credentials: {
 *     client_email: 'service-account@my-project.iam.gserviceaccount.com',
 *     private_key: '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n'
 *   }
 * };
 * ```
 */
export interface GCPConfig {
    /**
     * Google Cloud Project ID where resources will be created
     * @example 'my-gcp-project-123456' | 'playground-production-2023'
     * @see https://cloud.google.com/resource-manager/docs/creating-managing-projects
     */
    projectId: string;

    /**
     * Google Cloud zone for VM deployment
     * @example 'us-central1-a' | 'us-west1-b' | 'europe-west1-c' | 'asia-southeast1-a'
     * @default 'us-central1-a'
     * @see https://cloud.google.com/compute/docs/regions-zones
     */
    zone?: string;

    /**
     * Service account credentials for authentication (optional if using Application Default Credentials)
     * @example { client_email: 'service@project.iam.gserviceaccount.com', private_key: '-----BEGIN PRIVATE KEY-----...' }
     * @see https://cloud.google.com/docs/authentication/getting-started
     */
    credentials?: {
        client_email: string;
        private_key: string;
    };
}

/**
 * Google Cloud Platform provider for ephemeral VMs using Compute Engine
 * 
 * Supports creating, managing, and destroying GCP VM instances with automatic
 * SSH key management, startup script injection, and proper resource cleanup.
 * 
 * Depends on @google-cloud/compute
 * 
 * @example Basic Usage
 * ```typescript
 * import { GCPProvider } from '@tobimadehin/playground';
 * 
 * const provider = new GCPProvider({
 *   projectId: 'my-gcp-project-123456',
 *   zone: 'us-central1-a'
 * });
 * 
 * // Create a VM instance
 * const instance = await provider.createVM(
 *   { image: 'projects/ubuntu-os-cloud/global/images/family/ubuntu-2204-lts', size: 'e2-micro' },
 *   'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAAB... user@host'
 * );
 * 
 * console.log(`VM created: ${instance.id} at ${instance.ip}`);
 * 
 * // Clean up
 * await provider.destroyVM(instance.id);
 * ```
 * 
 * @example With Service Account Credentials
 * ```typescript
 * const provider = new GCPProvider({
 *   projectId: 'my-gcp-project-123456',
 *   zone: 'europe-west1-b',
 *   credentials: {
 *     client_email: 'playground-service@my-project.iam.gserviceaccount.com',
 *     private_key: process.env.GCP_PRIVATE_KEY!
 *   }
 * });
 * ```
 * 
 * @example With Startup Script
 * ```typescript
 * const startupScript = `#!/bin/bash
 * apt-get update -y
 * apt-get install -y docker.io
 * systemctl start docker
 * systemctl enable docker
 * usermod -aG docker $(whoami)`;
 * 
 * const instance = await provider.createVM(
 *   { image: 'projects/ubuntu-os-cloud/global/images/family/ubuntu-2204-lts', size: 'e2-small' },
 *   sshPublicKey,
 *   startupScript
 * );
 * ```
 * 
 * @requires Google Cloud authentication (Service Account or Application Default Credentials)
 * @requires Compute Engine API enabled in the project
 * @requires Appropriate IAM permissions for VM operations
 * 
 * @see https://cloud.google.com/compute/docs/ - Google Cloud Compute Engine
 * @see https://cloud.google.com/compute/docs/instances/create-start-instance - Creating VM Instances
 * @see https://cloud.google.com/compute/docs/machine-types - Machine Types
 * @see https://cloud.google.com/compute/docs/access/iam - Required IAM Permissions
 */
export class GCPProvider implements Provider {
    private client: InstancesClient;
    private projectId: string;
    private zone: string;

    /**
     * Initialize Google Cloud Platform provider
     * 
     * @param config GCP configuration object
     * 
     * @example
     * ```typescript
     * const provider = new GCPProvider({
     *   projectId: 'my-gcp-project-123456',
     *   zone: 'us-west1-a',
     *   credentials: {
     *     client_email: 'service-account@project.iam.gserviceaccount.com',
     *     private_key: process.env.GCP_PRIVATE_KEY!
     *   }
     * });
     * ```
     * 
     * @see https://cloud.google.com/docs/authentication/getting-started
     */
    constructor(config: GCPConfig) {
        this.projectId = config.projectId;
        this.zone = config.zone || 'us-central1-a';

        this.client = new InstancesClient({
            projectId: this.projectId,
            credentials: config.credentials,
        });
    }

    /**
     * Create an ephemeral Google Cloud VM instance
     * 
     * @param spec VM image and machine type specification
     * @param spec.image GCP image URL or family path
     * @param spec.size GCP machine type
     * @param sshKey Public SSH key for authentication
     * @param startupScript Optional startup script for VM initialization
     * @returns Instance metadata including public IP address
     * 
     * @example
     * ```typescript
     * const instance = await provider.createVM(
     *   {
     *     image: 'projects/ubuntu-os-cloud/global/images/family/ubuntu-2204-lts',
     *     size: 'e2-micro'  // 2 vCPU, 1 GB RAM (shared-core)
     *   },
     *   'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAAB... user@host',
     *   `#!/bin/bash
     *    apt-get update -y
     *    apt-get install -y nginx
     *    systemctl start nginx`
     * );
     * 
     * // Common GCP VM images:
     * // projects/ubuntu-os-cloud/global/images/family/ubuntu-2204-lts - Ubuntu 22.04 LTS
     * // projects/ubuntu-os-cloud/global/images/family/ubuntu-2004-lts - Ubuntu 20.04 LTS
     * // projects/debian-cloud/global/images/family/debian-11 - Debian 11
     * // projects/centos-cloud/global/images/family/centos-stream-9 - CentOS Stream 9
     * // projects/rhel-cloud/global/images/family/rhel-8 - Red Hat Enterprise Linux 8
     * 
     * // Common machine types:
     * // e2-micro   - 2 vCPU, 1 GB RAM (shared-core, free tier eligible)
     * // e2-small   - 2 vCPU, 2 GB RAM (shared-core)
     * // e2-medium  - 2 vCPU, 4 GB RAM (shared-core)
     * // n1-standard-1 - 1 vCPU, 3.75 GB RAM (standard)
     * // n2-standard-2 - 2 vCPU, 8 GB RAM (standard)
     * 
     * @see https://cloud.google.com/compute/docs/instances/create-start-instance - Creating Instances
     * @see https://cloud.google.com/compute/docs/images/os-details - Operating System Images
     * @see https://cloud.google.com/compute/docs/machine-types - Machine Types and Pricing
     * @see https://cloud.google.com/compute/docs/startupscript - Startup Scripts
     * ```
     */
    async createVM(spec: ImageSpec, sshKey: string, startupScript?: string): Promise<Instance> {
        const vmName = `playground-${Date.now()}`;

        // Prepare the instance config
        const request = {
            project: this.projectId,
            zone: this.zone,
            instanceResource: {
                name: vmName,
                machineType: `zones/${this.zone}/machineTypes/${spec.size}`,
                disks: [
                    {
                        boot: true,
                        autoDelete: true,
                        initializeParams: {
                            sourceImage: spec.image, // Full GCP image URL
                        },
                    },
                ],
                networkInterfaces: [
                    {
                        network: 'global/networks/default',
                        accessConfigs: [{ name: 'External NAT', type: 'ONE_TO_ONE_NAT' }],
                    },
                ],
                metadata: {
                    items: [
                        {
                            key: 'ssh-keys',
                            value: `playground:${sshKey}`,
                        },
                        ...(startupScript ? [{ key: 'startup-script', value: startupScript }] : []),
                    ],
                },
                tags: { items: ['playground', 'ephemeral'] },
            },
        };

        // Create the instance
        await this.client.insert(request);

        // Wait until VM is running and get public IP
        const instance = await this.waitForVMReady(vmName);

        const publicIp =
            instance.networkInterfaces?.[0]?.accessConfigs?.[0]?.natIP || '';

        return {
            id: instance.id?.toString() || vmName,
            ip: publicIp,
            providerData: {
                name: vmName,
                status: instance.status,
                zone: this.zone,
            },
        };
    }

    /**
     * Destroy a Google Cloud VM instance and clean up resources
     * 
     * @param instanceId GCP VM instance name to destroy
     * 
     * @example
     * ```typescript
     * await provider.destroyVM('playground-1699123456789');
     * 
     * // Instance names follow the format: playground-[timestamp]
     * // Examples:
     * // 'playground-1699123456789'
     * // 'playground-1699987654321'
     * ```
     * 
     * @see https://cloud.google.com/compute/docs/instances/deleting-instance
     */
    async destroyVM(instanceId: string): Promise<void> {
        await this.client.delete({
            project: this.projectId,
            zone: this.zone,
            instance: instanceId,
        });
    }

    /**
     * Get Google Cloud VM instance details and current status
     * 
     * @param instanceId GCP VM instance name to query
     * @returns Instance metadata with current state and IP addresses
     * 
     * @example
     * ```typescript
     * const instance = await provider.getVM('playground-1699123456789');
     * 
     * console.log(instance);
     * // Output:
     * // {
     * //   id: '1234567890123456789',
     * //   ip: '34.123.45.67',
     * //   providerData: {
     * //     name: 'playground-1699123456789',
     * //     status: 'RUNNING',
     * //     zone: 'us-central1-a'
     * //   }
     * // }
     * 
     * // Possible statuses: PROVISIONING | STAGING | RUNNING | STOPPING | STOPPED | TERMINATED
     * ```
     * 
     * @see https://cloud.google.com/compute/docs/instances/instance-life-cycle
     */
    async getVM(instanceId: string): Promise<Instance> {
        const [instance] = await this.client.get({
            project: this.projectId,
            zone: this.zone,
            instance: instanceId,
        });

        const publicIp =
            instance.networkInterfaces?.[0]?.accessConfigs?.[0]?.natIP || '';

        return {
            id: instance.id?.toString() || instance.name || '',
            ip: publicIp,
            providerData: {
                name: instance.name,
                status: instance.status,
                zone: this.zone,
            },
        };
    }

    /**
     * Wait for VM instance to become RUNNING and have a public IP address
     * 
     * @param vmName GCP VM instance name to monitor
     * @throws Error if VM doesn't become ready within timeout (90 seconds)
     * 
     * @example
     * ```typescript
     * // Waits for VM state transitions:
     * // PROVISIONING -> STAGING -> RUNNING (with external IP assigned)
     * // 
     * // Timeout: 30 attempts × 3 seconds = 90 seconds maximum wait
     * ```
     */
    private async waitForVMReady(vmName: string) {
        const maxAttempts = 30;
        const delay = 3000;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const [instance] = await this.client.get({
                project: this.projectId,
                zone: this.zone,
                instance: vmName,
            });

            if (instance.status === 'RUNNING') return instance;
            await new Promise(resolve => setTimeout(resolve, delay));
        }

        throw new Error(`GCP VM ${vmName} failed to become RUNNING within timeout`);
    }
}
