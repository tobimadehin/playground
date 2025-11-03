# Cloud Provider Implementations

This directory contains implementations for various cloud providers. Each provider implements the `Provider` interface with standardized VM lifecycle management.

## Provider Requirements

Each provider must implement:
- `createVM(spec, sshKey, startupScript?)` - Create and start a VM
- `destroyVM(instanceId)` - Terminate and delete a VM  
- `getVM(instanceId)` - Get VM status and details

## Supported Providers

### 1. Hetzner Cloud
- **API**: REST API v1
- **Auth**: API Token
- **Regions**: Multiple EU/US locations
- **Instance Types**: cx11, cx21, cx31, etc.
- **Images**: Ubuntu, Debian, CentOS, etc.

### 2. DigitalOcean
- **API**: REST API v2  
- **Auth**: Personal Access Token
- **Regions**: Global droplet regions
- **Instance Types**: s-1vcpu-1gb, s-2vcpu-2gb, etc.
- **Images**: Ubuntu, Debian, CentOS, etc.

### 3. AWS EC2
- **API**: AWS SDK v3
- **Auth**: Access Key + Secret or IAM Role
- **Regions**: All AWS regions
- **Instance Types**: t3.micro, t3.small, etc.
- **Images**: AMI IDs (region-specific)

### 4. Google Cloud Platform
- **API**: Compute Engine API
- **Auth**: Service Account JSON or Application Default Credentials
- **Regions**: All GCP zones
- **Instance Types**: e2-micro, e2-small, etc.
- **Images**: Public images (ubuntu-2204-lts, etc.)

### 5. Oracle Cloud Infrastructure
- **API**: OCI SDK
- **Auth**: API Key or Instance Principal
- **Regions**: All OCI regions
- **Instance Types**: VM.Standard.E4.Flex, etc.
- **Images**: Platform images

### 6. Microsoft Azure
- **API**: Azure SDK
- **Auth**: Service Principal or Managed Identity
- **Regions**: All Azure regions
- **Instance Types**: Standard_B1s, Standard_B2s, etc.
- **Images**: Publisher/Offer/SKU format

## Implementation Notes

- All providers should handle authentication via environment variables
- Instance IDs should be provider-native (not generated)
- IP addresses should be public IPs when available
- Startup scripts should be executed via cloud-init when supported
- Error handling should be consistent across providers