/**
 * HiveMind - Multi-Agent Operating System
 * Filesystem as Agents Example
 */

import { HiveMind } from '../src/index';

async function filesystemDemo() {
  console.log('=== Filesystem as Agents Demo ===\n');

  const hive = await HiveMind.create();
  const fs = hive.filesystem;

  // Create directory structure
  console.log('Creating filesystem structure...\n');
  
  await fs.create('directory', '/projects');
  await fs.create('directory', '/projects/hivemind');
  await fs.create('directory', '/projects/other');
  await fs.create('file', '/projects/hivemind/README.md', '# HiveMind\n\nA multi-agent OS.');
  await fs.create('file', '/projects/hivemind/package.json', '{"name": "hivemind"}');
  await fs.create('file', '/projects/hivemind/main.ts', 'console.log("Hello");');
  await fs.create('file', '/projects/notes.txt', 'My notes...');

  console.log('Created files:\n');
  
  // List files
  const projects = await fs.list('/projects');
  console.log('/projects:', projects);

  const hivemindFiles = await fs.list('/projects/hivemind');
  console.log('/projects/hivemind:', hivemindFiles);

  // Stat files
  console.log('\n--- File Statistics ---\n');
  
  const readmeStats = await fs.stat('/projects/hivemind/README.md');
  if (readmeStats) {
    console.log('README.md:');
    console.log(`  Size: ${readmeStats.size} bytes`);
    console.log(`  Type: ${readmeStats.isFile ? 'file' : 'directory'}`);
    console.log(`  Modified: ${new Date(readmeStats.modified).toISOString()}`);
  }

  // Send message to file agent
  console.log('\n--- Communicating with File Agent ---\n');
  
  const response = await fs.sendToPath('/projects/hivemind/main.ts', {
    id: 'msg-1',
    type: 'STAT',
    payload: {},
    timestamp: Date.now(),
    priority: 2,
    headers: {}
  });
  
  console.log('File agent responded:', response.payload);

  // Mount a custom agent at a path
  console.log('\n--- Mounting Custom Agent ---\n');
  
  const customAgent = await hive.spawnAgent('database-agent', 'process');
  
  await fs.mount('/database', customAgent);
  console.log('Mounted database-agent at /database');

  // Send query to mounted agent
  const queryResponse = await fs.sendToPath('/database', {
    id: 'query-1',
    type: 'REQUEST',
    payload: { query: 'SELECT * FROM users' },
    timestamp: Date.now(),
    priority: 2,
    headers: {}
  });
  
  console.log('Database agent response:', queryResponse.payload);

  // Get filesystem stats
  console.log('\n--- Filesystem Statistics ---\n');
  
  const fsStats = fs.getStats();
  console.log(`Mount Points: ${fsStats.mountPointCount}`);
  console.log(`Agent Count: ${fsStats.agentCount}`);
  console.log(`Total Paths: ${fsStats.totalPaths}`);

  // List all mount points
  console.log('\n--- Mount Points ---\n');
  
  const mountPoints = fs.getMountPoints();
  for (const mp of mountPoints) {
    console.log(`  ${mp.path} -> ${mp.agentEndpoint}`);
  }

  await hive.stop();
}

filesystemDemo().catch(console.error);
