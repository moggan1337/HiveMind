/**
 * HiveMind - Multi-Agent Operating System
 * Basic Usage Example
 */

import { HiveMind, AgentPriority, MessageType } from '../src/index';

async function main() {
  console.log('Starting HiveMind...\n');

  // Create HiveMind instance
  const hive = new HiveMind({
    kernel: {
      tickRate: 10,
      maxAgents: 100
    }
  });

  // Start the OS
  await hive.start();
  console.log('HiveMind started!\n');

  // Spawn some agents
  console.log('Spawning agents...');
  
  const producer = await hive.spawnAgent('producer', 'process', undefined, {
    canSpawnChildren: true,
    maxMemoryMB: 128,
    priority: AgentPriority.NORMAL
  });
  console.log(`Created producer: ${producer.id}`);

  const consumer = await hive.spawnAgent('consumer', 'process', undefined, {
    canSpawnChildren: false,
    maxMemoryMB: 64,
    priority: AgentPriority.HIGH
  });
  console.log(`Created consumer: ${consumer.id}\n`);

  // Setup consumer to handle messages
  consumer.onMessage(MessageType.REQUEST, async (msg) => {
    console.log(`[Consumer] Received request from ${msg.sender}`);
    console.log(`[Consumer] Payload:`, msg.payload);
    
    await consumer.send(msg.sender, MessageType.RESPONSE, {
      status: 'ok',
      message: 'Message received!',
      timestamp: Date.now()
    });
  });

  // Send a message from producer to consumer
  console.log('[Producer] Sending message to consumer...');
  const response = await producer.request(consumer.id, MessageType.REQUEST, {
    action: 'ping',
    data: { hello: 'world' }
  });
  console.log(`[Producer] Received response:`, response.payload);

  // Get system statistics
  console.log('\n--- System Statistics ---');
  const stats = hive.getStats();
  console.log(`Uptime: ${stats.kernel.uptime}ms`);
  console.log(`Agent Count: ${stats.kernel.agentCount}`);
  console.log(`Memory: ${stats.kernel.memory.usedMemoryMB.toFixed(2)}MB / ${stats.kernel.memory.totalMemoryMB}MB`);
  console.log(`Scheduler Algorithm: ${stats.kernel.scheduler.algorithm}`);

  // List all agents
  console.log('\n--- Running Agents ---');
  const agents = hive.listAgents();
  for (const agent of agents) {
    console.log(`  ${agent.name} (${agent.type}) - ${agent.state}`);
  }

  // Shutdown
  console.log('\nShutting down...');
  await hive.stop();
  console.log('Goodbye!');
}

main().catch(console.error);
