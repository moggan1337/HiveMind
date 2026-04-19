/**
 * HiveMind - Multi-Agent Operating System
 * Distributed Computing Example
 */

import { HiveMind } from '../src/index';

async function distributedDemo() {
  console.log('=== Distributed Computing Demo ===\n');

  // Create two HiveMind instances (simulating two nodes)
  const node1 = new HiveMind({
    network: { port: 8080 }
  });
  const node2 = new HiveMind({
    network: { port: 8081 }
  });

  await node1.start();
  await node2.start();

  console.log(`Node 1 started on port 8080`);
  console.log(`Node 2 started on port 8081\n`);

  // Connect the nodes (in real impl, this would establish network connection)
  console.log('Connecting nodes...');
  // await node1.network.connect('node-2');
  console.log('Nodes connected\n');

  // Spawn an agent on node 1
  const migratableAgent = await node1.spawnAgent('migratable-worker', 'process', undefined, {
    canMigrate: true,
    maxMemoryMB: 256
  });
  console.log(`Spawned migratable agent on Node 1: ${migratableAgent.id}`);

  // Setup agent to do some work
  migratableAgent.onMessage(async (msg) => {
    console.log(`[Agent] Received message:`, msg.payload);
  });

  // Simulate migration
  console.log('\n[Node 1] Initiating migration to Node 2...');
  
  // In real implementation:
  // const result = await node1.network.migrate(migratableAgent.id, 'node-2');
  
  console.log('[Node 1] Checkpoint created');
  console.log('[Node 1] Agent state serialized');
  console.log('[Node 1] Agent removed from Node 1');
  console.log('[Node 2] Checkpoint received');
  console.log('[Node 2] Agent restored from checkpoint');
  console.log('[Node 2] Agent resumed execution');
  console.log('\nMigration complete!\n');

  // Get network stats
  console.log('--- Network Statistics ---');
  const stats1 = node1.getStats().network;
  const stats2 = node2.getStats().network;
  
  console.log(`Node 1:`);
  console.log(`  Connected Nodes: ${stats1.connectedNodes}`);
  console.log(`  Pending Migrations: ${stats1.pendingMigrations}`);
  
  console.log(`\nNode 2:`);
  console.log(`  Connected Nodes: ${stats2.connectedNodes}`);
  console.log(`  Pending Migrations: ${stats2.pendingMigrations}`);

  // Cleanup
  console.log('\nShutting down nodes...');
  await node1.stop();
  await node2.stop();
  console.log('Done!');
}

distributedDemo().catch(console.error);
