/**
 * HiveMind - Multi-Agent Operating System
 * Event Streaming Example
 */

import { HiveMind, EventType } from '../src/index';

async function eventStreamingDemo() {
  console.log('=== Event Streaming Demo ===\n');

  const hive = await HiveMind.create();

  // Create a producer agent
  const producer = await hive.spawnAgent('event-producer', 'process');

  // Create a consumer agent
  const consumer = await hive.spawnAgent('event-consumer', 'process');

  // Consumer subscribes to producer's events
  console.log('[Consumer] Subscribing to producer events...');
  const subscriptionId = await consumer.subscribe(
    `agent-${producer.id}`,
    async (event) => {
      console.log(`[Consumer] Received event: ${event.type}`);
      console.log(`  Data:`, event.data);
      console.log(`  Timestamp: ${new Date(event.timestamp).toISOString()}`);
    }
  );
  console.log(`[Consumer] Subscription ID: ${subscriptionId}\n`);

  // Producer publishes events
  console.log('[Producer] Publishing events...\n');
  
  for (let i = 0; i < 5; i++) {
    await producer.publish('data-point', {
      sequence: i,
      value: Math.random() * 100,
      timestamp: Date.now()
    });

    await producer.publish('log', {
      level: i < 3 ? 'INFO' : 'WARN',
      message: `Processing item ${i}`,
      timestamp: Date.now()
    });

    await producer.sleep(100);
  }

  // Publish an error event
  await producer.publish('error', {
    code: 'ERR_PROCESSING',
    message: 'Something went wrong!',
    timestamp: Date.now()
  });

  console.log('\n[Producer] All events published.\n');

  // Get IPC stats
  console.log('--- IPC Statistics ---');
  const ipcStats = hive.getStats().ipc;
  console.log(`Streams: ${ipcStats.streams}`);
  console.log(`Subscriptions: ${ipcStats.subscriptions}`);
  console.log(`Connections: ${ipcStats.connections}`);

  await hive.stop();
}

eventStreamingDemo().catch(console.error);
