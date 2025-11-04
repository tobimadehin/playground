/**
 * MIT License - Copyright (c) 2025 Emmanuel Madehin
 * See LICENSE file for full license text
 */

import { Provider, ImageSpec, Instance } from './provider.js';
import { DefaultAzureCredential } from '@azure/identity';
import { ComputeManagementClient } from '@azure/arm-compute';
import { NetworkManagementClient } from '@azure/arm-network';

/**
 * Azure Provider configuration
 * 
 * @example
 * ```typescript
 * const config: AzureConfig = {
 *   subscriptionId: '12345678-1234-1234-1234-123456789012',
 *   resourceGroupName: 'playground-rg',
 *   location: 'East US',
 *   virtualNetworkName: 'playground-vnet',
 *   subnetName: 'default-subnet'
 * };
 * ```
 */
export interface AzureConfig {
    /**
     * Azure subscription ID where resources will be created
     * @example '12345678-1234-1234-1234-123456789012'
     * @see https://docs.microsoft.com/en-us/azure/azure-resource-manager/management/manage-subscriptions
     */
    subscriptionId: string;

    /**
     * Resource group name for VM and associated resources
     * @example 'playground-rg' | 'my-resource-group'
     * @see https://docs.microsoft.com/en-us/azure/azure-resource-manager/management/manage-resource-groups-portal
     */
    resourceGroupName: string;

    /**
     * Azure region for resource deployment
     * @example 'East US' | 'West Europe' | 'Southeast Asia' | 'Japan East'
     * @default 'East US'
     * @see https://docs.microsoft.com/en-us/azure/availability-zones/az-overview
     */
    location?: string;

    /**
     * Virtual network name for VM networking
     * @example 'playground-vnet' | 'default-vnet'
     * @default 'default-vnet'
     * @see https://docs.microsoft.com/en-us/azure/virtual-network/virtual-networks-overview
     */
    virtualNetworkName?: string;

    /**
     * Subnet name within the virtual network
     * @example 'default-subnet' | 'vm-subnet'
     * @default 'default-subnet'
     * @see https://docs.microsoft.com/en-us/azure/virtual-network/virtual-network-manage-subnet
     */
    subnetName?: string;
}

/**
 * Azure cloud provider for ephemeral VMs using Azure Virtual Machines
 * 
 * Supports creating, managing, and destroying Azure VMs with automatic
 * network interface and public IP management, SSH key injection, and
 * proper resource cleanup. 
 * 
 * Depends on @azure/identity, @azure/arm-compute, @azure/arm-network 
 * 
 * @example Basic Usage
 * ```typescript
 * import { AzureProvider } from '@tobimadehin/playground';
 * 
 * const provider = new AzureProvider({
 *   subscriptionId: process.env.AZURE_SUBSCRIPTION_ID!,
 *   resourceGroupName: 'playground-rg',
 *   location: 'East US'
 * });
 * 
 * // Create an instance
 * const instance = await provider.createVM(
 *   { image: 'Canonical:0001-com-ubuntu-server-jammy:22_04-lts-gen2:latest', size: 'Standard_B1s' },
 *   'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAAB... user@host'
 * );
 * 
 * console.log(`VM created: ${instance.id} at ${instance.ip}`);
 * 
 * // Clean up
 * await provider.destroyVM(instance.id);
 * ```
 * 
 * @example With Virtual Network Configuration
 * ```typescript
 * const provider = new AzureProvider({
 *   subscriptionId: '12345678-1234-1234-1234-123456789012',
 *   resourceGroupName: 'my-resource-group',
 *   location: 'West Europe',
 *   virtualNetworkName: 'my-vnet',
 *   subnetName: 'vm-subnet'
 * });
 * ```
 * 
 * @example With Cloud-Init Script
 * ```typescript
 * const cloudInitScript = `#!/bin/bash
 * apt-get update -y
 * apt-get install -y nginx
 * systemctl start nginx
 * systemctl enable nginx
 * echo "Hello from Azure VM" > /var/www/html/index.html`;
 * 
 * const instance = await provider.createVM(
 *   { image: 'Canonical:0001-com-ubuntu-server-jammy:22_04-lts-gen2:latest', size: 'Standard_B2s' },
 *   sshPublicKey,
 *   cloudInitScript
 * );
 * ```
 * 
 * @requires Azure authentication (DefaultAzureCredential)
 * @requires Appropriate Azure RBAC permissions for VM operations
 * 
 * @see https://docs.microsoft.com/en-us/azure/virtual-machines/ - Azure Virtual Machines
 * @see https://docs.microsoft.com/en-us/azure/virtual-machines/linux/quick-create-cli - VM Quick Start
 * @see https://docs.microsoft.com/en-us/azure/virtual-machines/sizes - VM Sizes
 * @see https://docs.microsoft.com/en-us/azure/role-based-access-control/built-in-roles#virtual-machine-contributor - Required RBAC Permissions
 */
export class AzureProvider implements Provider {
    private computeClient: ComputeManagementClient;
    private networkClient: NetworkManagementClient;
    private config: AzureConfig;
    private location: string;

    /**
     * Initialize Azure provider with DefaultAzureCredential authentication
     * 
     * @param config Azure configuration object
     * 
     * @example
     * ```typescript
     * const provider = new AzureProvider({
     *   subscriptionId: process.env.AZURE_SUBSCRIPTION_ID!,
     *   resourceGroupName: 'playground-rg',
     *   location: 'East US',
     *   virtualNetworkName: 'my-vnet',
     *   subnetName: 'vm-subnet'
     * });
     * ```
     * 
     * @see https://docs.microsoft.com/en-us/javascript/api/@azure/identity/defaultazurecredential
     */
    constructor(config: AzureConfig) {
        this.config = config;
        this.location = config.location || 'East US';

        const credential = new DefaultAzureCredential();

        this.computeClient = new ComputeManagementClient(credential, config.subscriptionId);
        this.networkClient = new NetworkManagementClient(credential, config.subscriptionId);
    }

    /**
     * Create an ephemeral Azure VM with automatic networking setup
     * 
     * @param spec VM image and size specification
     * @param spec.image Azure image reference in publisher:offer:sku:version format
     * @param spec.size Azure VM size (SKU)
     * @param sshKey Public SSH key for authentication
     * @param startupScript Optional cloud-init script for VM initialization
     * @returns Instance metadata including public IP address
     * 
     * @example
     * ```typescript
     * const instance = await provider.createVM(
     *   {
     *     image: 'Canonical:0001-com-ubuntu-server-jammy:22_04-lts-gen2:latest',
     *     size: 'Standard_B1s'  // 1 vCPU, 1 GB RAM
     *   },
     *   'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAAB... user@host',
     *   `#!/bin/bash
     *    apt-get update -y
     *    apt-get install -y docker.io
     *    systemctl start docker`
     * );
     * 
     * // Common Azure VM images:
     * // Canonical:0001-com-ubuntu-server-jammy:22_04-lts-gen2:latest - Ubuntu 22.04 LTS
     * // Canonical:0001-com-ubuntu-server-focal:20_04-lts-gen2:latest - Ubuntu 20.04 LTS
     * // RedHat:RHEL:8-lvm-gen2:latest - Red Hat Enterprise Linux 8
     * // MicrosoftWindowsServer:WindowsServer:2022-datacenter-azure-edition:latest - Windows Server 2022
     * 
     * // Common VM sizes:
     * // Standard_B1s   - 1 vCPU, 1 GB RAM (burstable)
     * // Standard_B2s   - 2 vCPU, 4 GB RAM (burstable)
     * // Standard_D2s_v3 - 2 vCPU, 8 GB RAM (general purpose)
     * // Standard_F2s_v2 - 2 vCPU, 4 GB RAM (compute optimized)
     * 
     * @see https://docs.microsoft.com/en-us/azure/virtual-machines/linux/cli-ps-findimage - Finding VM Images
     * @see https://docs.microsoft.com/en-us/azure/virtual-machines/sizes - VM Sizes and Pricing
     * @see https://docs.microsoft.com/en-us/azure/virtual-machines/linux/cloud-init-deep-dive - Cloud-Init Documentation
     * ```
     */
    async createVM(spec: ImageSpec, sshKey: string, startupScript?: string): Promise<Instance> {
        const vmName = `playground-${Date.now()}`;
        const nicName = `${vmName}-nic`;
        const pipName = `${vmName}-pip`;

        // 1. Create public IP
        await this.networkClient.publicIPAddresses.beginCreateOrUpdateAndWait(
            this.config.resourceGroupName,
            pipName,
            {
                location: this.location,
                publicIPAllocationMethod: 'Dynamic',
                tags: { CreatedBy: 'playground' }
            }
        );

        // 2. Create network interface
        const vnetName = this.config.virtualNetworkName || 'default-vnet';
        const subnetName = this.config.subnetName || 'default-subnet';
        const subnet = await this.networkClient.subnets.get(this.config.resourceGroupName, vnetName, subnetName);
        const publicIp = await this.networkClient.publicIPAddresses.get(this.config.resourceGroupName, pipName);

        await this.networkClient.networkInterfaces.beginCreateOrUpdateAndWait(
            this.config.resourceGroupName,
            nicName,
            {
                location: this.location,
                ipConfigurations: [
                    {
                        name: 'ipconfig1',
                        subnet: { id: subnet.id },
                        publicIPAddress: { id: publicIp.id }
                    }
                ],
                tags: { CreatedBy: 'playground' }
            }
        );

        // 3. Parse image spec (publisher:offer:sku:version)
        const [publisher, offer, sku, version] = spec.image.split(':');

        // 4. Create VM
        await this.computeClient.virtualMachines.beginCreateOrUpdateAndWait(
            this.config.resourceGroupName,
            vmName,
            {
                location: this.location,
                hardwareProfile: { vmSize: spec.size },
                storageProfile: {
                    imageReference: { publisher, offer, sku, version: version || 'latest' },
                    osDisk: { createOption: 'FromImage', managedDisk: { storageAccountType: 'Standard_LRS' } }
                },
                osProfile: {
                    computerName: vmName,
                    adminUsername: 'playground',
                    linuxConfiguration: {
                        disablePasswordAuthentication: true,
                        ssh: {
                            publicKeys: [
                                {
                                    path: '/home/playground/.ssh/authorized_keys',
                                    keyData: sshKey
                                }
                            ]
                        }
                    },
                    customData: startupScript ? Buffer.from(startupScript).toString('base64') : undefined
                },
                networkProfile: {
                    networkInterfaces: [{ id: `/subscriptions/${this.config.subscriptionId}/resourceGroups/${this.config.resourceGroupName}/providers/Microsoft.Network/networkInterfaces/${nicName}` }]
                },
                tags: { CreatedBy: 'playground', Type: 'ephemeral' }
            }
        );

        // 5. Get public IP
        const finalPip = await this.networkClient.publicIPAddresses.get(this.config.resourceGroupName, pipName);

        return {
            id: vmName,
            ip: finalPip.ipAddress || '',
            providerData: {
                resourceGroup: this.config.resourceGroupName,
                location: this.location,
                vmSize: spec.size
            }
        };
    }

    /**
     * Destroy an Azure VM and clean up associated resources
     * 
     * @param instanceId Azure VM name to destroy
     * 
     * @example
     * ```typescript
     * await provider.destroyVM('playground-1699123456789');
     * 
     * // This will delete:
     * // - Virtual Machine
     * // - Network Interface (playground-1699123456789-nic)
     * // - Public IP Address (playground-1699123456789-pip)
     * // - OS Disk (automatically deleted with VM)
     * ```
     * 
     * @see https://docs.microsoft.com/en-us/azure/virtual-machines/linux/delete-vm
     */
    async destroyVM(instanceId: string): Promise<void> {
        const nicName = `${instanceId}-nic`;
        const pipName = `${instanceId}-pip`;

        await this.computeClient.virtualMachines.beginDeleteAndWait(this.config.resourceGroupName, instanceId).catch(() => { });
        await this.networkClient.networkInterfaces.beginDeleteAndWait(this.config.resourceGroupName, nicName).catch(() => { });
        await this.networkClient.publicIPAddresses.beginDeleteAndWait(this.config.resourceGroupName, pipName).catch(() => { });
    }

    /**
     * Get Azure VM details and current status
     * 
     * @param instanceId Azure VM name to query
     * @returns Instance metadata with current state and IP addresses
     * 
     * @example
     * ```typescript
     * const instance = await provider.getVM('playground-1699123456789');
     * 
     * console.log(instance);
     * // Output:
     * // {
     * //   id: 'playground-1699123456789',
     * //   ip: '20.123.45.67',
     * //   providerData: {
     * //     resourceGroup: 'playground-rg',
     * //     location: 'East US',
     * //     vmSize: 'Standard_B1s',
     * //     provisioningState: 'Succeeded'
     * //   }
     * // }
     * 
     * // Possible provisioning states: Creating | Updating | Succeeded | Failed | Deleting
     * ```
     * 
     * @see https://docs.microsoft.com/en-us/azure/virtual-machines/states-billing
     */
    async getVM(instanceId: string): Promise<Instance> {
        const vm = await this.computeClient.virtualMachines.get(this.config.resourceGroupName, instanceId);
        const pip = await this.networkClient.publicIPAddresses.get(this.config.resourceGroupName, `${instanceId}-pip`);

        return {
            id: vm.name!,
            ip: pip.ipAddress || '',
            providerData: {
                resourceGroup: this.config.resourceGroupName,
                location: vm.location,
                vmSize: vm.hardwareProfile?.vmSize,
                provisioningState: vm.provisioningState
            }
        };
    }
}
