const fs = require('fs');
const path = require('path');

// Simple conversion for index.js
const indexContent = `/**
 * MIT License - Copyright (c) 2025 Emmanuel Madehin
 * See LICENSE file for full license text
 */
export * from './playground.js';
export * from './providers/provider.js';
export * from './providers/hetzner.js';
export * from './providers/digitalocean.js';
export * from './providers/aws.js';
export * from './providers/gcp.js';
export * from './providers/oracle.js';
export * from './providers/azure.js';
`;

fs.writeFileSync('./dist/index.js', indexContent);
console.log('Converted index.js to ES module');