/**
 * MIT License - Copyright (c) 2025 Emmanuel Madehin
 * See LICENSE file for full license text
 */

import { Provider, ImageSpec, Instance } from '@/providers/provider';
import * as oci from 'oci-sdk';

/**
 * Oracle Cloud Infrastructure Provider configuration
 * 
 * @example
 * ```typescript
 * const config: OracleConfig = {
 *   tenancyId: 'ocid1.tenancy.oc1..aaaaaaaa...',
 *   userId: 'ocid1.user.oc1..aaaaaaaa...',
 *   fingerprint: 'aa:bb:cc:dd:ee:ff:00:11:22:33:44:55:66:77:88:99',
 *   privateKey: '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----',
 *   region: 'us-ashburn-1',
 *   compartmentId: 'ocid1.compartment.oc1..aaaaaaaa...'
 * };
 * ```
 */
export interface OracleConfig {
    /**
     * Oracle Cloud tenancy OCID
     * @example 'ocid1.tenancy.oc1..aaaaaaaa7n3c6qfrtqvqwxy5zb3k2jzqvn3c6qfrtqvqwxy5zb3k2jzq'
     * @see https://docs.oracle.com/en-us/iaas/Content/General/Concepts/identifiers.htm
     */
    tenancyId: string;

    /**
     * Oracle Cloud user OCID
     * @example 'ocid1.user.oc1..aaaaaaaa7n3c6qfrtqvqwxy5zb3k2jzqvn3c6qfrtqvqwxy5zb3k2jzq'
     * @see https://docs.oracle.com/en-us/iaas/Content/API/Concepts/apisigningkey.htm
     */
    userId: string;

    /**
     * API key fingerprint for authentication
     * @example 'aa:bb:cc:dd:ee:ff:00:11:22:33:44:55:66:77:88:99'
     * @see https://docs.oracle.com/en-us/iaas/Content/API/Concepts/apisigningkey.htm
     */
    fingerprint: string;

    /**
     * Private key content in PEM format
     * @example '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----'
     * @see https://docs.oracle.com/en-us/iaas/Content/API/Concepts/apisigningkey.htm
     */
    privateKey: string;

    /**
     * Oracle Cloud region for resource deployment
     * @example 'us-ashburn-1' | 'us-phoenix-1' | 'eu-frankfurt-1' | 'ap-tokyo-1'
     * @default 'us-ashburn-1'
     * @see https://docs.oracle.com/en-us/iaas/Content/General/Concepts/regions.htm
     */
    region?: string;

    /**
     * Compartment OCID where resources will be created
     * @example 'ocid1.compartment.oc1..aaaaaaaa7n3c6qfrtqvqwxy5zb3k2jzqvn3c6qfrtqvqwxy5zb3k2jzq'
     * @see https://docs.oracle.com/en-us/iaas/Content/Identity/Tasks/managingcompartments.htm
     */
    compartmentId: string;
}

/**
 * Oracle Cloud Infrastructure provider for ephemeral VMs using Compute instances
 * 
 * Supports creating, managing, and destroying OCI VM instances with automatic
 * VNIC management, SSH key injection, and proper resource cleanup.
 * 
 * Depends on oci-sdk.
 * 
 * @example Basic Usage
 * ```typescript
 * import { OracleProvider } from '@tobimadehin/playground';
 * 
 * const provider = new OracleProvider({
 *   tenancyId: process.env.OCI_TENANCY_ID!,
 *   userId: process.env.OCI_USER_ID!,
 *   fingerprint: process.env.OCI_FINGERPRINT!,
 *   privateKey: process.env.OCI_PRIVATE_KEY!,
 *   region: 'us-ashburn-1',
 *   compartmentId: process.env.OCI_COMPARTMENT_ID!
 * });
 * 
 * // Create a VM instance
 * const instance = await provider.createVM(
 *   { image: 'ocid1.image.oc1.iad.aaaaaaaa...', size: 'VM.Standard.E4.Flex' },
 *   'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAAB... user@host'
 * );
 * 
 * console.log(`VM created: ${instance.id} at ${instance.ip}`);
 * 
 * // Clean up
 * await provider.destroyVM(instance.id);
 * ```
 * 
 * @example With Cloud-Init Script
 * ```typescript
 * const cloudInit = `#!/bin/bash
 * yum update -y
 * yum install -y docker
 * systemctl start docker
 * systemctl enable docker
 * usermod -aG docker opc`;
 * 
 * const instance = await provider.createVM(
 *   { image: 'ocid1.image.oc1.iad.aaaaaaaa...', size: 'VM.Standard2.1' },
 *   sshPublicKey,
 *   cloudInit
 * );
 * ```
 * 
 * @example Multi-Region Deployment
 * ```typescript
 * const providers = [
 *   new OracleProvider({ ...config, region: 'us-ashburn-1' }),
 *   new OracleProvider({ ...config, region: 'eu-frankfurt-1' }),
 *   new OracleProvider({ ...config, region: 'ap-tokyo-1' })
 * ];
 * ```
 * 
 * @requires Oracle Cloud API key pair (user OCID, tenancy OCID, fingerprint, private key)
 * @requires Appropriate IAM policies for Compute and VCN operations
 * 
 * @see https://docs.oracle.com/en-us/iaas/Content/Compute/home.htm - Oracle Cloud Compute
 * @see https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/launchinginstance.htm - Launching Instances
 * @see https://docs.oracle.com/en-us/iaas/Content/Compute/References/computeshapes.htm - Compute Shapes
 * @see https://docs.oracle.com/en-us/iaas/Content/API/Concepts/apisigningkey.htm - API Key Authentication
 */
export class OracleProvider implements Provider {
    private config: OracleConfig;
    private computeClient: oci.core.ComputeClient;
    private virtualNetworkClient: oci.core.VirtualNetworkClient;
    private region: string;

    /**
     * Initialize Oracle Cloud Infrastructure provider
     * 
     * @param config OCI configuration object with API credentials
     * 
     * @example
     * ```typescript
     * const provider = new OracleProvider({
     *   tenancyId: 'ocid1.tenancy.oc1..aaaaaaaa...',
     *   userId: 'ocid1.user.oc1..aaaaaaaa...',
     *   fingerprint: 'aa:bb:cc:dd:ee:ff:00:11:22:33:44:55:66:77:88:99',
     *   privateKey: process.env.OCI_PRIVATE_KEY!,
     *   region: 'us-phoenix-1',
     *   compartmentId: 'ocid1.compartment.oc1..aaaaaaaa...'
     * });
     * ```
     * 
     * @see https://docs.oracle.com/en-us/iaas/Content/API/Concepts/apisigningkey.htm
     */
    constructor(config: OracleConfig) {
        this.config = config;
        this.region = config.region || 'us-ashburn-1';

        const provider = new oci.common.SimpleAuthenticationDetailsProvider(
            config.tenancyId,
            config.userId,
            config.fingerprint,
            config.privateKey,
            null, // passphrase
            this.region as any
        );

        this.computeClient = new oci.core.ComputeClient({ authenticationDetailsProvider: provider });
        this.virtualNetworkClient = new oci.core.VirtualNetworkClient({ authenticationDetailsProvider: provider });
    }

    /**
     * Create an ephemeral Oracle Cloud VM instance
     * 
     * @param spec VM image and shape specification
     * @param spec.image OCI image OCID
     * @param spec.size OCI compute shape
     * @param sshKey Public SSH key for authentication
     * @param startupScript Optional cloud-init script for VM initialization
     * @returns Instance metadata including public IP address
     * 
     * @example
     * ```typescript
     * const instance = await provider.createVM(
     *   {
     *     image: 'ocid1.image.oc1.iad.aaaaaaaa7n3c6qfrtqvqwxy5zb3k2jzq',  // Oracle Linux 8
     *     size: 'VM.Standard.E4.Flex'  // 1 OCPU, 16 GB RAM (flexible)
     *   },
     *   'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAAB... user@host',
     *   `#!/bin/bash
     *    yum update -y
     *    yum install -y htop
     *    echo "Hello from Oracle Cloud!" > /tmp/welcome.txt`
     * );
     * 
     * // Common OCI images (region-specific OCIDs):
     * // Oracle Linux 8: ocid1.image.oc1.iad.aaaaaaaa7n3c6qfrtqvqwxy5zb3k2jzq
     * // Ubuntu 22.04: ocid1.image.oc1.iad.aaaaaaaa7n3c6qfrtqvqwxy5zb3k2jzq
     * // CentOS 8: ocid1.image.oc1.iad.aaaaaaaa7n3c6qfrtqvqwxy5zb3k2jzq
     * 
     * // Common compute shapes:
     * // VM.Standard.E4.Flex - AMD EPYC (flexible OCPU/memory)
     * // VM.Standard3.Flex - Intel Xeon (flexible OCPU/memory)
     * // VM.Standard2.1 - 1 OCPU, 15 GB RAM (fixed)
     * // VM.Standard2.2 - 2 OCPU, 30 GB RAM (fixed)
     * // VM.Standard.A1.Flex - Arm-based Ampere (always free eligible)
     * 
     * @see https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/launchinginstance.htm - Launching Instances
     * @see https://docs.oracle.com/en-us/iaas/images/ - Platform Images
     * @see https://docs.oracle.com/en-us/iaas/Content/Compute/References/computeshapes.htm - Compute Shapes
     * @see https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/cloudconfig.htm - Cloud-Init Scripts
     * ```
     */
    async createVM(spec: ImageSpec, sshKey: string, startupScript?: string): Promise<Instance> {
        const vmName = `playground-${Date.now()}`;

        // Create a VNIC and Public IP
        const vnicDetails = await this.createVNIC(vmName);

        // Create the instance
        const launchDetails: oci.core.requests.LaunchInstanceRequest = {
            launchInstanceDetails: {
                displayName: vmName,
                compartmentId: this.config.compartmentId,
                availabilityDomain: await this.getFirstAD(),
                shape: spec.size,
                sourceDetails: {
                    sourceType: 'image',
                    imageId: spec.image,
                },
                createVnicDetails: {
                    subnetId: vnicDetails.subnetId,
                    assignPublicIp: true,
                    displayName: `${vmName}-vnic`,
                    hostnameLabel: vmName.toLowerCase(),
                },
                metadata: {
                    ssh_authorized_keys: sshKey,
                    ...(startupScript && { user_data: Buffer.from(startupScript).toString('base64') }),
                },
            },
        };

        const response = await this.computeClient.launchInstance(launchDetails);
        const instance = response.instance;

        return {
            id: instance.id!,
            ip: vnicDetails.publicIp || '',
            providerData: {
                state: instance.lifecycleState,
                shape: instance.shape,
                availabilityDomain: instance.availabilityDomain,
            },
        };
    }

    /**
     * Destroy an Oracle Cloud VM instance and clean up resources
     * 
     * @param instanceId OCI instance OCID to destroy
     * 
     * @example
     * ```typescript
     * await provider.destroyVM('ocid1.instance.oc1.iad.aaaaaaaa7n3c6qfrtqvqwxy5zb3k2jzq');
     * 
     * // Instance OCIDs follow the format: ocid1.instance.oc1.[region].[unique-id]
     * // Examples:
     * // 'ocid1.instance.oc1.iad.aaaaaaaa7n3c6qfrtqvqwxy5zb3k2jzq'
     * // 'ocid1.instance.oc1.phx.aaaaaaaa7n3c6qfrtqvqwxy5zb3k2jzq'
     * ```
     * 
     * @see https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/terminatinginstance.htm
     */
    async destroyVM(instanceId: string): Promise<void> {
        try {
            await this.computeClient.terminateInstance({ instanceId });
        } catch (err: any) {
            if (!err.message?.includes('NotFound')) throw err;
        }
    }

    /**
     * Get Oracle Cloud VM instance details and current status
     * 
     * @param instanceId OCI instance OCID to query
     * @returns Instance metadata with current state and IP addresses
     * 
     * @example
     * ```typescript
     * const instance = await provider.getVM('ocid1.instance.oc1.iad.aaaaaaaa7n3c6qfrtqvqwxy5zb3k2jzq');
     * 
     * console.log(instance);
     * // Output:
     * // {
     * //   id: 'ocid1.instance.oc1.iad.aaaaaaaa7n3c6qfrtqvqwxy5zb3k2jzq',
     * //   ip: '129.213.123.45',
     * //   providerData: {
     * //     state: 'RUNNING',
     * //     shape: 'VM.Standard.E4.Flex',
     * //     availabilityDomain: 'kWVD:US-ASHBURN-AD-1'
     * //   }
     * // }
     * 
     * // Possible lifecycle states: PROVISIONING | RUNNING | STARTING | STOPPING | STOPPED | TERMINATING | TERMINATED
     * ```
     * 
     * @see https://docs.oracle.com/en-us/iaas/Content/Compute/References/computeinstancelifecycle.htm
     */
    async getVM(instanceId: string): Promise<Instance> {
        const response = await this.computeClient.getInstance({ instanceId });
        const instance = response.instance;

        // Get public IP
        const vnicAttachments = await this.computeClient.listVnicAttachments({
            compartmentId: this.config.compartmentId,
            instanceId,
        });
        const vnicId = vnicAttachments.items[0]?.vnicId;
        let publicIp = '';
        if (vnicId) {
            const vnic = await this.virtualNetworkClient.getVnic({ vnicId });
            publicIp = vnic.vnic.publicIp || '';
        }

        return {
            id: instance.id!,
            ip: publicIp,
            providerData: {
                state: instance.lifecycleState,
                shape: instance.shape,
                availabilityDomain: instance.availabilityDomain,
            },
        };
    }

    /**
     * Create VNIC configuration for VM instance
     * 
     * @param _name VM instance name (currently unused)
     * @returns VNIC configuration with subnet ID and public IP placeholder
     * 
     * @example
     * ```typescript
     * // Returns configuration for VM networking:
     * // - subnetId: OCID of the first available subnet
     * // - publicIp: undefined (assigned during instance creation)
     * ```
     */
    private async createVNIC(_name: string) {
        // Simplified: assumes default VCN and subnet exist
        const subnetId = await this.getFirstSubnet();
        return { subnetId, publicIp: undefined };
    }

    /**
     * Get the first available subnet in the compartment
     * 
     * @returns Subnet OCID for VM placement
     * 
     * @example
     * ```typescript
     * // Returns subnet OCID format:
     * // 'ocid1.subnet.oc1.iad.aaaaaaaa7n3c6qfrtqvqwxy5zb3k2jzq'
     * ```
     */
    private async getFirstSubnet(): Promise<string> {
        const vcnList = await this.virtualNetworkClient.listVcns({ compartmentId: this.config.compartmentId });
        const vcnId = vcnList.items[0].id!;
        const subnets = await this.virtualNetworkClient.listSubnets({ compartmentId: this.config.compartmentId, vcnId });
        return subnets.items[0].id!;
    }

    /**
     * Get the first availability domain in the region
     * 
     * @returns Availability domain name for VM placement
     * 
     * @example
     * ```typescript
     * // Returns availability domain format:
     * // 'kWVD:US-ASHBURN-AD-1' (for us-ashburn-1 region)
     * // 'kWVD:US-PHOENIX-AD-1' (for us-phoenix-1 region)
     * // 'kWVD:EU-FRANKFURT-1-AD-1' (for eu-frankfurt-1 region)
     * ```
     */
    private async getFirstAD(): Promise<string> {
        const identityClient = new oci.identity.IdentityClient({
            authenticationDetailsProvider: new oci.common.SimpleAuthenticationDetailsProvider(
                this.config.tenancyId,
                this.config.userId,
                this.config.fingerprint,
                this.config.privateKey,
                null, // passphrase
                this.region as any
            ),
        });

        const adResponse = await identityClient.listAvailabilityDomains({ compartmentId: this.config.tenancyId });
        return adResponse.items[0].name!;
    }
}
