/**
 * MIT License - Copyright (c) 2025 Emmanuel Madehin
 * See LICENSE file for full license text
 */

import { Provider, ImageSpec, Instance } from '@/providers/provider';
import { EC2Client, RunInstancesCommand, TerminateInstancesCommand, DescribeInstancesCommand, ImportKeyPairCommand } from '@aws-sdk/client-ec2';

/**
 * AWS Provider configuration
 * 
 * @example
 * ```typescript
 * const config: AWSConfig = {
 *   accessKeyId: 'YOUR_ACCESS_KEY_ID',
 *   secretAccessKey: 'YOUR_SECRET_ACCESS_KEY',
 *   region: 'us-east-1',
 *   defaultSubnetId: 'subnet-12345678',
 *   defaultSecurityGroupId: 'sg-903004f8'
 * };
 * ```
 */
export interface AWSConfig {
    /** 
     * AWS Access Key ID for authentication
     * @example 'YOUR_ACCESS_KEY_ID'
     * @see https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html
     */
    accessKeyId: string;

    /** 
     * AWS Secret Access Key for authentication
     * @example 'YOUR_SECRET_ACCESS_KEY'
     * @see https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html
     */
    secretAccessKey: string;

    /** 
     * AWS region to deploy instances in
     * @example 'us-east-1' | 'us-west-2' | 'eu-west-1' | 'ap-southeast-1'
     * @default 'us-east-1'
     * @see https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-regions-availability-zones.html
     */
    region?: string;

    /** 
     * Default subnet ID for instance placement (VPC subnet)
     * @example 'subnet-12345678' | 'subnet-abcdef12'
     * @see https://docs.aws.amazon.com/vpc/latest/userguide/configure-subnets.html
     */
    defaultSubnetId?: string;

    /** 
     * Default security group ID for network access rules
     * @example 'sg-903004f8' | 'sg-12345678'
     * @see https://docs.aws.amazon.com/vpc/latest/userguide/vpc-security-groups.html
     */
    defaultSecurityGroupId?: string;
}

/**
 * AWS cloud provider for ephemeral VMs using EC2 instances
 * 
 * Supports creating, managing, and destroying EC2 instances with automatic
 * SSH key management, user data injection, and proper resource cleanup.
 * 
 * Depends on @aws-sdk/client-ec2 
 * 
 * @example Basic Usage
 * ```typescript
 * import { AWSProvider } from '@tobimadehin/playground';
 * 
 * const provider = new AWSProvider({
 *   accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
 *   secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
 *   region: 'us-east-1'
 * });
 * 
 * // Create an instance
 * const instance = await provider.createVM(
 *   { image: 'ami-0abcdef1234567890', size: 't3.micro' },
 *   'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAAB... user@host'
 * );
 * 
 * console.log(`Instance created: ${instance.id} at ${instance.ip}`);
 * 
 * // Clean up
 * await provider.destroyVM(instance.id);
 * ```
 * 
 * @example With VPC Configuration
 * ```typescript
 * const provider = new AWSProvider({
 *   accessKeyId: 'YOUR_ACCESS_KEY_ID',
 *   secretAccessKey: 'YOUR_SECRET_ACCESS_KEY',
 *   region: 'us-west-2',
 *   defaultSubnetId: 'subnet-12345678',        // Public subnet
 *   defaultSecurityGroupId: 'sg-903004f8'     // Allow SSH (port 22)
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
 * usermod -aG docker ubuntu`;
 * 
 * const instance = await provider.createVM(
 *   { image: 'ami-0d70546e43a941d70', size: 't3.small' },
 *   sshPublicKey,
 *   startupScript
 * );
 * ```
 * 
 * @requires AWS credentials (Access Key ID + Secret Access Key)
 * @requires Appropriate IAM permissions for EC2 operations
 * 
 * @see https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/concepts.html - EC2 User Guide
 * @see https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/finding-an-ami.html - Finding AMIs
 * @see https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/instance-types.html - Instance Types
 * @see https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_examples_ec2_instances-subnet.html - Required IAM Permissions
 */
export class AWSProvider implements Provider {
    private client: EC2Client;
    private config: AWSConfig;

    /**
     * Initialize AWS provider
     * 
     * @param config AWS configuration object
     * 
     * @example
     * ```typescript
     * const provider = new AWSProvider({
     *   accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
     *   secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
     *   region: 'us-west-2',
     *   defaultSubnetId: 'subnet-12345678',
     *   defaultSecurityGroupId: 'sg-903004f8'
     * });
     * ```
     */
    constructor(config: AWSConfig) {
        this.config = config;
        this.client = new EC2Client({
            region: config.region || 'us-east-1',
            credentials: {
                accessKeyId: config.accessKeyId,
                secretAccessKey: config.secretAccessKey
            }
        });
    }

    /**
     * Create an ephemeral EC2 instance
     * 
     * @param spec VM image and size specification
     * @param spec.image AMI ID (Amazon Machine Image identifier) - see AWS AMI documentation
     * @param spec.size EC2 instance type - see AWS instance types documentation
     * @param sshKey Public SSH key to inject for authentication
     * @param startupScript Optional user data script (cloud-init)
     * @returns Instance metadata including public IP address
     * 
     * @example
     * ```typescript
     * const instance = await provider.createVM(
     *   {
     *     image: 'ami-0abcdef1234567890',  // Ubuntu 22.04 LTS
     *     size: 't3.micro'                // 1 vCPU, 1 GB RAM
     *   },
     *   'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAAB... user@host',
     *   `#!/bin/bash
     *    apt-get update -y
     *    apt-get install -y nginx
     *    systemctl start nginx`
     * );
     * 
     * // Common AMI examples:
     * // ami-0abcdef1234567890 - Ubuntu 22.04 LTS (us-east-1)
     * // ami-0c02fb55956c7d316 - Amazon Linux 2 (us-east-1)
     * // ami-0d70546e43a941d70 - Ubuntu 20.04 LTS (us-east-1)
     * //
     * // Find AMI IDs: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/finding-an-ami.html
     * // AMI Catalog: https://aws.amazon.com/marketplace/search/results?category=2649338011
     * // Quick Start AMIs: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/AMIs.html
     * 
     * // Common instance types:
     * // t3.micro   - 2 vCPU, 1 GB RAM (free tier eligible)
     * // t3.small   - 2 vCPU, 2 GB RAM
     * // t3.medium  - 2 vCPU, 4 GB RAM
     * // m5.large   - 2 vCPU, 8 GB RAM
     * //
     * // Instance Types: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/instance-types.html
     * // Pricing Calculator: https://calculator.aws/#/estimate
     * ```
     */
    async createVM(spec: ImageSpec, sshKey: string, startupScript?: string): Promise<Instance> {
        const keyName = await this.ensureKeyPair(sshKey);
        const userData = startupScript ? Buffer.from(startupScript).toString('base64') : undefined;

        const command = new RunInstancesCommand({
            ImageId: spec.image,
            InstanceType: spec.size as any,
            MinCount: 1,
            MaxCount: 1,
            KeyName: keyName,
            UserData: userData,
            SecurityGroupIds: this.config.defaultSecurityGroupId ? [this.config.defaultSecurityGroupId] : undefined,
            SubnetId: this.config.defaultSubnetId,
            TagSpecifications: [
                {
                    ResourceType: 'instance',
                    Tags: [
                        { Key: 'Name', Value: `playground-${Date.now()}` },
                        { Key: 'CreatedBy', Value: 'playground' },
                        { Key: 'Type', Value: 'ephemeral' }
                    ]
                }
            ]
        });

        const response = await this.client.send(command);
        const instance = response.Instances?.[0];
        if (!instance?.InstanceId) throw new Error('Failed to create EC2 instance');

        await this.waitForInstanceReady(instance.InstanceId);

        const details = await this.getVM(instance.InstanceId);
        return details;
    }

    /**
     * Terminate an EC2 instance and clean up resources
     * 
     * @param instanceId AWS instance ID to destroy
     * 
     * @example
     * ```typescript
     * await provider.destroyVM('i-1234567890abcdef0');
     * 
     * // Instance IDs follow the format: i-[17 character hex string]
     * // Examples:
     * // i-1234567890abcdef0
     * // i-0abcdef1234567890
     * ```
     */
    async destroyVM(instanceId: string): Promise<void> {
        try {
            await this.client.send(new TerminateInstancesCommand({ InstanceIds: [instanceId] }));
        } catch (error: any) {
            if (!error.message?.includes('InvalidInstanceID.NotFound')) throw error;
        }
    }

    /**
     * Get EC2 instance details and current status
     * 
     * @param instanceId AWS instance ID to query
     * @returns Instance metadata with current state and IP addresses
     * 
     * @example
     * ```typescript
     * const instance = await provider.getVM('i-1234567890abcdef0');
     * 
     * console.log(instance);
     * // Output:
     * // {
     * //   id: 'i-1234567890abcdef0',
     * //   ip: '54.123.45.67',
     * //   providerData: {
     * //     state: 'running',
     * //     instanceType: 't3.micro',
     * //     availabilityZone: 'us-east-1a'
     * //   }
     * // }
     * 
     * // Possible states: pending | running | shutting-down | terminated | stopping | stopped
     * ```
     */
    async getVM(instanceId: string): Promise<Instance> {
        const response = await this.client.send(new DescribeInstancesCommand({ InstanceIds: [instanceId] }));
        const instance = response.Reservations?.[0]?.Instances?.[0];
        if (!instance) throw new Error(`Instance ${instanceId} not found`);

        return {
            id: instance.InstanceId!,
            ip: instance.PublicIpAddress || instance.PrivateIpAddress || '',
            providerData: {
                state: instance.State?.Name,
                instanceType: instance.InstanceType,
                availabilityZone: instance.Placement?.AvailabilityZone
            }
        };
    }

    /** 
     * Ensure the public SSH key is imported as a key pair
     * 
     * @param publicKey SSH public key content
     * @returns Key pair name for use in instance creation
     * 
     * @example
     * ```typescript
     * // Input SSH key format:
     * const sshKey = 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQ... user@hostname';
     * 
     * // Generated key pair name format:
     * // 'playground-AbCdEfGh' (8 character hash suffix)
     * ```
     */
    private async ensureKeyPair(publicKey: string): Promise<string> {
        const keyName = `playground-${Buffer.from(publicKey).toString('base64').slice(0, 8)}`;
        try {
            await this.client.send(new ImportKeyPairCommand({
                KeyName: keyName,
                PublicKeyMaterial: new Uint8Array(Buffer.from(publicKey, 'utf-8'))
            }));
        } catch (error: any) {
            if (!error.message?.includes('InvalidKeyPair.Duplicate')) throw error;
        }
        return keyName;
    }

    /** 
     * Wait for instance to become running and have a public/private IP
     * 
     * @param instanceId AWS instance ID to monitor
     * @throws Error if instance doesn't become ready within timeout (150 seconds)
     * 
     * @example
     * ```typescript
     * // Waits for instance state transitions:
     * // pending -> running (with IP address assigned)
     * // 
     * // Timeout: 30 attempts × 5 seconds = 150 seconds maximum wait
     * ```
     */
    private async waitForInstanceReady(instanceId: string) {
        const maxAttempts = 30;
        const delay = 5000;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const instance = await this.getVM(instanceId);
            if (instance.ip && instance.providerData.state === 'running') return;
            await new Promise(res => setTimeout(res, delay));
        }
        throw new Error(`Instance ${instanceId} did not become ready in time`);
    }
}
