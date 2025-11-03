/**
 * MIT License - Copyright (c) 2025 Emmanuel Madehin
 * See LICENSE file for full license text
 */

import { Playground, PlaygroundUtils } from '../src/playground';
import { Provider, ImageSpec, Instance } from '../src/providers/provider';

// Mock provider for testing
class MockProvider implements Provider {
    private instances = new Map<string, Instance>();
    private shouldFail = false;

    constructor(private name: string) { }

    setShouldFail(fail: boolean) {
        this.shouldFail = fail;
    }

    async createVM(spec: ImageSpec, sshKey: string, startupScript?: string): Promise<Instance> {
        if (this.shouldFail) {
            throw new Error(`${this.name} provider failed`);
        }

        const instance: Instance = {
            id: `${this.name}-${Date.now()}`,
            ip: '192.168.1.100',
            providerData: {
                status: 'running',
                image: spec.image,
                size: spec.size
            }
        };

        this.instances.set(instance.id, instance);
        return instance;
    }

    async destroyVM(instanceId: string): Promise<void> {
        if (this.shouldFail) {
            throw new Error(`${this.name} provider failed`);
        }
        this.instances.delete(instanceId);
    }

    async getVM(instanceId: string): Promise<Instance> {
        if (this.shouldFail) {
            throw new Error(`${this.name} provider failed`);
        }

        const instance = this.instances.get(instanceId);
        if (!instance) {
            throw new Error('Instance not found');
        }
        return instance;
    }
}

// Mock fs module
jest.mock('fs', () => ({
    readFileSync: jest.fn(() => `
ubuntu-22-small:
  - provider: mock1
    image: ubuntu-22.04
    size: small
    priority: 1
    ttl: 3600
  - provider: mock2
    image: ubuntu-22.04
    size: small
    priority: 2
    ttl: 7200
`)
}));

// Mock yaml module
jest.mock('js-yaml', () => ({
    load: jest.fn(() => ({
        'ubuntu-22-small': [
            {
                provider: 'mock1',
                image: 'ubuntu-22.04',
                size: 'small',
                priority: 1,
                ttl: 3600
            },
            {
                provider: 'mock2',
                image: 'ubuntu-22.04',
                size: 'small',
                priority: 2,
                ttl: 7200
            }
        ]
    }))
}));

describe('Playground', () => {
    let playground: Playground;
    let mockProvider1: MockProvider;
    let mockProvider2: MockProvider;

    beforeEach(() => {
        mockProvider1 = new MockProvider('mock1');
        mockProvider2 = new MockProvider('mock2');

        const providers = new Map<string, Provider>();
        providers.set('mock1', mockProvider1);
        providers.set('mock2', mockProvider2);

        playground = new Playground({
            providers,
            imageMappingsPath: './test-mappings.yaml'
        });
    });

    describe('createInstance', () => {
        it('should create instance with highest priority provider', async () => {
            const instance = await playground.createInstance({
                imageType: 'ubuntu-22-small',
                sshKey: 'ssh-rsa AAAAB3NzaC1yc2E... test@example.com'
            });

            expect(instance.provider).toBe('mock1');
            expect(instance.imageType).toBe('ubuntu-22-small');
            expect(instance.id).toContain('mock1');
            expect(instance.ip).toBe('192.168.1.100');
            expect(instance.ttl).toBe(3600);
        });

        it('should use preferred provider when specified', async () => {
            const instance = await playground.createInstance({
                imageType: 'ubuntu-22-small',
                sshKey: 'ssh-rsa AAAAB3NzaC1yc2E... test@example.com',
                preferredProvider: 'mock2'
            });

            expect(instance.provider).toBe('mock2');
            expect(instance.ttl).toBe(7200);
        });

        it('should throw error when preferred provider fails', async () => {
            mockProvider2.setShouldFail(true);

            await expect(playground.createInstance({
                imageType: 'ubuntu-22-small',
                sshKey: 'ssh-rsa AAAAB3NzaC1yc2E... test@example.com',
                preferredProvider: 'mock2'
            })).rejects.toThrow('mock2 provider failed');
        });

        it('should throw error for unknown image type', async () => {
            await expect(playground.createInstance({
                imageType: 'unknown-image',
                sshKey: 'ssh-rsa AAAAB3NzaC1yc2E... test@example.com'
            })).rejects.toThrow('No image mappings found');
        });

        it('should throw error when no providers available', async () => {
            mockProvider1.setShouldFail(true);
            mockProvider2.setShouldFail(true);

            await expect(playground.createInstance({
                imageType: 'ubuntu-22-small',
                sshKey: 'ssh-rsa AAAAB3NzaC1yc2E... test@example.com'
            })).rejects.toThrow();
        });
    });

    describe('destroyInstance', () => {
        it('should destroy instance successfully', async () => {
            const instance = await playground.createInstance({
                imageType: 'ubuntu-22-small',
                sshKey: 'ssh-rsa AAAAB3NzaC1yc2E... test@example.com'
            });

            await expect(playground.destroyInstance(instance.provider, instance.id))
                .resolves.not.toThrow();
        });

        it('should throw error for unknown provider', async () => {
            await expect(playground.destroyInstance('unknown', 'instance-123'))
                .rejects.toThrow('Provider \'unknown\' not available');
        });
    });

    describe('getInstance', () => {
        it('should get instance details', async () => {
            const created = await playground.createInstance({
                imageType: 'ubuntu-22-small',
                sshKey: 'ssh-rsa AAAAB3NzaC1yc2E... test@example.com'
            });

            const instance = await playground.getInstance(created.provider, created.id);
            expect(instance.id).toBe(created.id);
            expect(instance.ip).toBe('192.168.1.100');
        });
    });

    describe('utility methods', () => {
        it('should return available image types', () => {
            const imageTypes = playground.getAvailableImageTypes();
            expect(imageTypes).toContain('ubuntu-22-small');
        });

        it('should return available providers', () => {
            const providers = playground.getAvailableProviders();
            expect(providers).toEqual(['mock1', 'mock2']);
        });

        it('should return image mappings', () => {
            const mappings = playground.getImageMappings('ubuntu-22-small');
            expect(mappings).toHaveLength(2);
            expect(mappings[0].provider).toBe('mock1');
        });
    });
});

describe('PlaygroundUtils', () => {
    const mockInstance = {
        id: 'test-123',
        ip: '192.168.1.100',
        provider: 'test',
        imageType: 'ubuntu-22-small',
        createdAt: Math.floor(Date.now() / 1000) - 1800, // 30 minutes ago
        ttl: 3600, // 1 hour
        sshKey: 'ssh-rsa AAAAB3NzaC1yc2E... test@example.com'
    };

    describe('isExpired', () => {
        it('should return false for non-expired instance', () => {
            expect(PlaygroundUtils.isExpired(mockInstance)).toBe(false);
        });

        it('should return true for expired instance', () => {
            const expiredInstance = {
                ...mockInstance,
                createdAt: Math.floor(Date.now() / 1000) - 7200 // 2 hours ago
            };
            expect(PlaygroundUtils.isExpired(expiredInstance)).toBe(true);
        });
    });

    describe('getTimeToExpiry', () => {
        it('should return positive time for non-expired instance', () => {
            const timeLeft = PlaygroundUtils.getTimeToExpiry(mockInstance);
            expect(timeLeft).toBeGreaterThan(0);
            expect(timeLeft).toBeLessThanOrEqual(1800); // Should be around 30 minutes
        });

        it('should return negative time for expired instance', () => {
            const expiredInstance = {
                ...mockInstance,
                createdAt: Math.floor(Date.now() / 1000) - 7200 // 2 hours ago
            };
            const timeLeft = PlaygroundUtils.getTimeToExpiry(expiredInstance);
            expect(timeLeft).toBeLessThan(0);
        });
    });

    describe('filterExpired', () => {
        it('should filter out expired instances', () => {
            const instances = [
                mockInstance,
                {
                    ...mockInstance,
                    id: 'expired-123',
                    createdAt: Math.floor(Date.now() / 1000) - 7200 // 2 hours ago
                }
            ];

            const expired = PlaygroundUtils.filterExpired(instances);
            expect(expired).toHaveLength(1);
            expect(expired[0].id).toBe('expired-123');
        });
    });

    describe('filterActive', () => {
        it('should filter out active instances', () => {
            const instances = [
                mockInstance,
                {
                    ...mockInstance,
                    id: 'expired-123',
                    createdAt: Math.floor(Date.now() / 1000) - 7200 // 2 hours ago
                }
            ];

            const active = PlaygroundUtils.filterActive(instances);
            expect(active).toHaveLength(1);
            expect(active[0].id).toBe('test-123');
        });
    });
});