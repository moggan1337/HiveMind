# HiveMind - Multi-Agent Operating System

[![CI](https://github.com/moggan1337/HiveMind/actions/workflows/ci.yml/badge.svg)](https://github.com/moggan1337/HiveMind/actions/workflows/ci.yml)

```
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║     ██╗███╗   ██╗███████╗██╗  ██╗███████╗███╗   ██╗     ║
║     ██║████╗  ██║██╔════╝╚██╗██╔╝██╔════╝████╗  ██║     ║
║     ██║██╔██╗ ██║█████╗   ╚███╔╝ █████╗  ██╔██╗ ██║     ║
║     ██║██║╚██╗██║██╔══╝   ██╔██╗ ██╔══╝  ██║╚██╗██║     ║
║     ██║██║ ╚████║███████╗██╔╝ ██╗███████╗██║ ╚████║     ║
║     ╚═╝╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝     ║
║                                                            ║
║          Multi-Agent Operating System v1.0                ║
║          Where Processes ARE Agents                       ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
```

HiveMind is a revolutionary operating system where **every process is an agent**. Built on event streams and message passing, it provides a distributed, fault-tolerant, and highly scalable multi-agent computing platform.

## 🎬 Demo
![HiveMind Demo](demo.gif)

*Multi-agent system with distributed intelligence*

## Screenshots
| Component | Preview |
|-----------|---------|
| Agent Network | ![network](screenshots/network.png) |
| Message Stream | ![stream](screenshots/stream.png) |
| Process Tree | ![tree](screenshots/process-tree.png) |

## Visual Description
Agent network displays connected processes with message flow arrows. Message stream shows events being processed in real-time. Process tree presents hierarchical agent relationships.

---


## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Core Concepts](#core-concepts)
4. [Event Streaming Protocol](#event-streaming-protocol)
5. [How Agents Work as Processes](#how-agents-work-as-processes)
6. [Installation](#installation)
7. [Usage Examples](#usage-examples)
8. [API Reference](#api-reference)
9. [Distributed Computing](#distributed-computing)
10. [Filesystem as Agents](#filesystem-as-agents)
11. [Configuration](#configuration)
12. [Contributing](#contributing)
13. [License](#license)

---

## Overview

HiveMind reimagines the operating system as a multi-agent system where:

- **Every process IS an agent** - No distinction between processes and agents
- **IPC via event streams** - All communication uses pi-mono compatible event streams
- **Agent FS** - Mount points are agent endpoints
- **Distributed by default** - Agents can migrate between machines
- **Fault-tolerant** - Agent supervision and automatic recovery

### Key Features

- 🔄 **Event-Driven Architecture** - All operations based on event streams
- 🌐 **Distributed Computing** - Agents migrate seamlessly between nodes
- 📁 **Filesystem as Agents** - Every file and directory is messageable
- 🔗 **IPC via pi-mono** - Compatible event streaming protocol
- 🛡️ **Fault Tolerance** - Automatic agent supervision and recovery
- 📊 **Real-time Monitoring** - Live system statistics and agent health

---

## Architecture

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         HiveMind OS                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                      KERNEL LAYER                              │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐│  │
│  │  │  Scheduler  │  │   Memory    │  │      Event Router       ││  │
│  │  │             │  │   Manager   │  │                         ││  │
│  │  │ • FIFO      │  │ • Heap      │  │ • Event Streams         ││  │
│  │  │ • RR        │  │ • Stack     │  │ • Subscriptions         ││  │
│  │  │ • Priority  │  │ • Paging    │  │ • Routing               ││  │
│  │  │ • MLFQ      │  │ • Swap      │  │ • Piping                ││  │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────┘│  │
│  │  ┌──────────────────────────────────────────────────────────┐ │  │
│  │  │                    Process Table                          │ │  │
│  │  │  PID │ Agent ID  │  Name   │  State  │  Priority  │  CPU  │ │  │
│  │  │  1   │ ag-001    │  init   │ RUNNING │ CRITICAL   │  0.1 │ │  │
│  │  │  2   │ ag-002    │ systemd │ RUNNING │ HIGH       │  0.2 │ │  │
│  │  │  3   │ ag-003    │  shell  │ RUNNING │ NORMAL     │  0.5 │ │  │
│  │  └──────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    AGENT LAYER                                 │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │  │
│  │  │ Process  │ │ Process  │ │ Process  │ │ Process  │   ...    │  │
│  │  │  Agent   │ │  Agent   │ │  Agent   │ │  Agent   │          │  │
│  │  │          │ │          │ │          │ │          │          │  │
│  │  │ • IPC    │ │ • IPC    │ │ • IPC    │ │ • IPC    │          │  │
│  │  │ • Mem    │ │ • Mem    │ │ • Mem    │ │ • Mem    │          │  │
│  │  │ • FS     │ │ • FS     │ │ • FS     │ │ • FS     │          │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                  FILESYSTEM LAYER                              │  │
│  │                                                                  │  │
│  │  / ──────────────────────────────────────────────────────┐     │  │
│  │  │├── bin/  │├── etc/  │├── home/ │├── proc/ │├── sys/  │     │  │
│  │  │├── sbin/ │├── var/  │├── tmp/  │├── mnt/  │├── dev/  │     │  │
│  │  └───────────────────────────────────────────────────────┘     │  │
│  │                                                                  │  │
│  │  Every file/directory IS an agent that can receive messages!    │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                   NETWORK LAYER                               │  │
│  │                                                                  │  │
│  │     ┌──────────┐      ┌──────────┐      ┌──────────┐           │  │
│  │     │  Node A  │◄────►│  Node B  │◄────►│  Node C  │           │  │
│  │     │ ag-001   │      │ ag-010   │      │ ag-020   │           │  │
│  │     └──────────┘      └──────────┘      └──────────┘           │  │
│  │          │                  │                  │                │  │
│  │          └──────────────────┼──────────────────┘                │  │
│  │                             │                                   │  │
│  │                    Agent Migration                             │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        BaseAgent                                 │
├─────────────────────────────────────────────────────────────────┤
│  Properties:                                                     │
│  - id: AgentID          - state: AgentState                      │
│  - name: string         - parent: AgentID | undefined             │
│  - type: AgentType      - children: AgentID[]                    │
│                                                                  │
│  Methods:                                                        │
│  + initialize(context: AgentContext): Promise<void>             │
│  + run(): Promise<void>                                          │
│  + terminate(code?: number): Promise<void>                      │
│  + send(to: AgentID, type: MessageType, payload: unknown): Promise│
│  + broadcast(type: MessageType, payload: unknown): Promise<void>  │
│  + publish(type: string, data: unknown): Promise<Event>          │
│  + onMessage(type: MessageType, handler: MessageHandler): void   │
│  + subscribe(stream: EventStreamID, callback): Promise<string>   │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ extends
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐   ┌─────────────────┐   ┌─────────────────┐
│ Kernel Agent  │   │  Process Agent  │   │Filesystem Agent │
├───────────────┤   ├─────────────────┤   ├─────────────────┤
│ • Scheduler   │   │ • PID           │   │ • Path          │
│ • Memory Mgr  │   │ • Entry Point   │   │ • Permissions   │
│ • Event Router│   │ • Args/Env      │   │ • Content       │
│ • Process Table│  │ • CPU/Memory    │   │ • Children      │
└───────────────┘   └─────────────────┘   └─────────────────┘
```

---

## Core Concepts

### 1. Agents as Processes

In HiveMind, there's no distinction between a "process" and an "agent". Every process is an agent and vice versa:

```typescript
// Creating a process IS creating an agent
const processAgent = await hive.spawnAgent(
  'my-worker',           // Name
  'process',            // Agent class
  parentId,             // Parent agent ID
  {
    canMigrate: true,   // Can move between nodes
    maxMemoryMB: 256,   // Memory limit
    priority: 'NORMAL'   // Scheduling priority
  }
);
```

### 2. Agent States

```
                    ┌───────────────┐
                    │   CREATED     │
                    └───────┬───────┘
                            │ initialize()
                            ▼
                    ┌───────────────┐
            ┌───────│ INITIALIZING  │
            │       └───────┬───────┘
            │               │ onInitialize()
            │               ▼
            │       ┌───────────────┐
            │       │    RUNNING    │◄────────────┐
            │       └───────┬───────┘             │
            │               │                     │ resume()
            │   ┌───────────┼───────────┐         │
            │   │           │           │         │
            │   ▼           ▼           ▼         │
            │ WAITING   SUSPENDED   MIGRATING      │
            │   │           │           │         │
            │   └───────────┼───────────┴──────────┘
            │               │ suspend()
            │               ▼
            │       ┌───────────────┐
            │       │ TERMINATED   │──────────┐
            │       └───────────────┘          │
            │               │                  │ fault()
            │               ▼                  ▼
            │       ┌───────────────┐    ┌───────────────┐
            └──────►│   FAILED     │    │   FAILED     │
                    └───────────────┘    └───────────────┘
```

### 3. Agent Hierarchy

```
                    ┌─────────────┐
                    │   KERNEL    │  PID: 0
                    │  (init)     │
                    └──────┬──────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │  systemd    │ │  NetworkMgr │ │  logger     │
    │  PID: 1     │ │  PID: 2     │ │  PID: 3     │
    └──────┬──────┘ └──────┬──────┘ └─────────────┘
           │
    ┌──────┴──────┐
    │             │
    ▼             ▼
┌─────────┐ ┌─────────┐
│ shell   │ │ my-app  │
│ PID: 10 │ │ PID: 11 │
└────┬────┘ └────┬────┘
     │           │
     ▼           ▼
┌─────────┐ ┌─────────┐
│ child1  │ │ worker1 │
│ PID: 20 │ │ PID: 30 │
└─────────┘ └─────────┘
```

---

## Event Streaming Protocol

HiveMind uses a pi-mono compatible event streaming protocol for all IPC.

### Event Stream Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Event Stream                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Publisher: Agent-A                                              │
│                                                                  │
│  ┌─────────┐    ┌─────────────────────────────────────────┐    │
│  │ Event 1 │───►│                                         │    │
│  ├─────────┤    │              Event Buffer               │    │
│  │ Event 2 │───►│                                         │    │
│  ├─────────┤    │   [e1] [e2] [e3] [e4] [e5] ...          │    │
│  │ Event 3 │───►│                                         │    │
│  ├─────────┤    │   maxSize: 1000  ttl: 3600000ms        │    │
│  │ Event 4 │───►│                                         │    │
│  └─────────┘    └──────────────────┬────────────────────┘    │
│                                    │                           │
│           ┌────────────────────────┼────────────────────────┐ │
│           │                        │                        │ │
│           ▼                        ▼                        ▼ │
│    ┌───────────┐            ┌───────────┐            ┌───────────┐
│    │ Subscriber│            │ Subscriber│            │ Subscriber│
│    │  Agent-B  │            │  Agent-C  │            │  Agent-D  │
│    │ Filter:  │            │ Filter:   │            │ Filter:   │
│    │ type:.*  │            │ type:log  │            │ type:err  │
│    └───────────┘            └───────────┘            └───────────┘
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Event Format

```typescript
interface Event {
  id: string;              // Unique event ID (UUID)
  stream: EventStreamID;   // Which stream this event belongs to
  type: string;            // Event type (e.g., 'log', 'data', 'error')
  data: unknown;           // Event payload
  timestamp: number;       // When the event was created
  source: AgentID;         // Which agent published this event
  metadata: {              // Additional metadata
    [key: string]: unknown;
  };
}
```

### Subscribing to Events

```typescript
// Subscribe to a specific event stream
const subscriptionId = await agent.subscribe('my-stream', async (event) => {
  console.log('Received event:', event.type, event.data);
});

// Subscribe with a filter
await agent.subscribe('logs', async (event) => {
  // Only handle log events
}, {
  type: 'log',
  source: 'logger-agent'
});

// Subscribe to multiple streams matching a pattern
const subscriptions = eventRouter.subscribePattern(
  /^system\..*/,
  (event) => console.log('System event:', event)
);
```

### Event Piping

```
Stream A ──────────────────────► Stream B ──────────────────────► Stream C
   │                                 │                                │
   │  events                         │  piped events                  │  events
   ▼                                 ▼                                ▼
[ e1 ]                            [ e1 ]                           [ e1 ]
[ e2 ]                            [ e2 ]                           [ e2 ]
[ e3 ]                            [ e3 ]                           [ e3 ]
   .                                  .                               .
   .                                  .                               .
   .                                  .                               .

// Create a pipe between streams
await ipc.pipe('source-stream', 'dest-stream');
```

---

## How Agents Work as Processes

### Process/Agent Lifecycle

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Process/Agent Lifecycle                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. SPAWN                                                            │
│     ┌──────────────────┐                                           │
│     │ Kernel.spawnAgent │                                           │
│     │ (name, class,     │                                           │
│     │  parent, caps)    │                                           │
│     └────────┬─────────┘                                           │
│              │                                                      │
│              ▼                                                      │
│  2. INITIALIZE                                                       │
│     ┌──────────────────┐                                           │
│     │ agent.initialize │ ◄── Create AgentContext                    │
│     │ (context)        │     - eventStream                          │
│     └────────┬─────────┘     - memory                               │
│              │               - filesystem                            │
│              ▼               - ipc                                   │
│  3. RUN             │        - network                               │
│     ┌──────────────────┐     │                                       │
│     │   while (running)│◄────┘                                       │
│     │     await tick() │                                             │
│     └────────┬─────────┘                                             │
│              │                                                      │
│    ┌─────────┼─────────┐                                            │
│    │         │         │                                            │
│    ▼         ▼         ▼                                            │
│  ────┐   ────┐     ────┐                                           │
│  RUN │   WAIT│     SUSP │                                           │
│  ────┘   ────┘     ────┘                                           │
│    │         │         │                                            │
│    └─────────┼─────────┘                                            │
│              │                                                      │
│              ▼                                                      │
│  4. TERMINATE                                                        │
│     ┌──────────────────┐                                           │
│     │ agent.terminate │                                           │
│     │ (code)          │                                           │
│     └────────┬─────────┘                                           │
│              │                                                      │
│              ▼                                                      │
│  5. CLEANUP                                                          │
│     - Remove from scheduler                                         │
│     - Free memory                                                   │
│     - Close connections                                             │
│     - Notify parent                                                 │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Agent Context

Every agent receives an `AgentContext` during initialization:

```typescript
interface AgentContext {
  agent: Agent;           // The agent's own info
  eventStream: EventStream;  // Agent's personal event stream
  memory: AgentMemory;    // Agent's private memory space
  filesystem: FilesystemAPI; // Filesystem access
  ipc: IPCAPI;            // Inter-agent communication
  network: NetworkAPI;    // Network/distributed operations
}
```

### Example: Creating a Custom Agent

```typescript
import { BaseAgent, AgentType, AgentPriority, MessageType } from 'hivemind';

class MyWorkerAgent extends BaseAgent {
  constructor() {
    super('my-worker', AgentType.PROCESS, undefined, {
      canMigrate: true,
      canSpawnChildren: true,
      maxMemoryMB: 256,
      priority: AgentPriority.NORMAL
    });
  }

  async onInitialize(): Promise<void> {
    console.log(`Worker ${this.id} initializing...`);
    
    // Setup message handlers
    this.onMessage(MessageType.REQUEST, this.handleRequest.bind(this));
    
    // Subscribe to events
    await this.subscribe('job-queue', this.handleJob.bind(this));
  }

  async handleRequest(msg: AgentMessage): Promise<void> {
    const { action } = msg.payload;
    
    switch (action) {
      case 'status':
        await this.send(msg.sender, MessageType.RESPONSE, {
          status: 'running',
          uptime: Date.now() - this.createdAt
        });
        break;
        
      case 'config':
        await this.send(msg.sender, MessageType.RESPONSE, {
          config: this.capabilities
        });
        break;
    }
  }

  async handleJob(event: Event): Promise<void> {
    const { jobId, data } = event.data;
    console.log(`Processing job ${jobId}`);
    
    // Do work...
    
    // Publish result
    await this.publish('job-results', { jobId, result: 'done' });
  }
}
```

---

## Installation

```bash
# Clone the repository
git clone https://github.com/moggan1337/HiveMind.git
cd HiveMind

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Start HiveMind
npm start
```

---

## Usage Examples

### Example 1: Basic Usage

```typescript
import { HiveMind, AgentPriority } from 'hivemind';

async function main() {
  // Create and start HiveMind
  const hive = new HiveMind({
    kernel: {
      tickRate: 10,
      maxAgents: 1000
    }
  });
  
  await hive.start();
  
  // Spawn some agents
  const worker1 = await hive.spawnAgent('worker-1', 'process');
  const worker2 = await hive.spawnAgent('worker-2', 'process');
  
  // Send messages between agents
  await worker1.send(worker2.id, 'REQUEST', { action: 'ping' });
  
  // Get system stats
  const stats = hive.getStats();
  console.log('System stats:', stats);
  
  // List all agents
  const agents = hive.listAgents();
  console.log('Running agents:', agents.length);
  
  // Shutdown
  await hive.stop();
}

main().catch(console.error);
```

### Example 2: Agent Communication

```typescript
import { HiveMind, MessageType } from 'hivemind';

async function communicate() {
  const hive = await HiveMind.create();
  
  // Spawn sender and receiver agents
  const sender = await hive.spawnAgent('sender', 'process');
  const receiver = await hive.spawnAgent('receiver', 'process');
  
  // Setup receiver to handle messages
  receiver.onMessage(MessageType.REQUEST, async (msg) => {
    console.log('Received:', msg.payload);
    await receiver.send(msg.sender, MessageType.RESPONSE, {
      received: true,
      echo: msg.payload
    });
  });
  
  // Send a message and wait for response
  const response = await sender.request(receiver.id, MessageType.REQUEST, {
    message: 'Hello, Agent!',
    timestamp: Date.now()
  });
  
  console.log('Response:', response.payload);
  
  await hive.stop();
}
```

### Example 3: Event Streaming

```typescript
import { HiveMind } from 'hivemind';

async function eventStreaming() {
  const hive = await HiveMind.create();
  
  const producer = await hive.spawnAgent('producer', 'process');
  const consumer = await hive.spawnAgent('consumer', 'process');
  
  // Consumer subscribes to producer's stream
  await consumer.subscribe(`${producer.id}-stream`, async (event) => {
    console.log(`[Consumer] Got event: ${event.type}`, event.data);
  });
  
  // Producer publishes events
  for (let i = 0; i < 10; i++) {
    await producer.publish('data', {
      sequence: i,
      value: Math.random(),
      time: Date.now()
    });
    await producer.sleep(100);
  }
  
  await hive.stop();
}
```

### Example 4: Filesystem as Agents

```typescript
import { HiveMind } from 'hivemind';

async function filesystemDemo() {
  const hive = await HiveMind.create();
  
  const fs = hive.filesystem;
  
  // Create a file (creates a FileAgent)
  await fs.create('file', '/tmp/data.txt', 'Hello, HiveMind!');
  
  // Send a message to the file agent
  const response = await fs.sendToPath('/tmp/data.txt', {
    id: 'req-1',
    type: 'READ',
    payload: {},
    timestamp: Date.now(),
    priority: 2,
    headers: {}
  });
  
  // List directory
  const files = await fs.list('/tmp');
  console.log('Files in /tmp:', files);
  
  // Stat a file
  const stats = await fs.stat('/tmp/data.txt');
  console.log('File stats:', stats);
  
  await hive.stop();
}
```

### Example 5: Agent Migration

```typescript
import { HiveMind } from 'hivemind';

async function migrationDemo() {
  const hive1 = await HiveMind.create({ network: { port: 8080 } });
  const hive2 = await HiveMind.create({ network: { port: 8081 } });
  
  // Connect the nodes
  await hive1.network.connect('node-2');
  
  // Spawn an agent on node 1
  const agent = await hive1.spawnAgent('migratable', 'process', undefined, {
    canMigrate: true
  });
  
  console.log('Agent spawned on node 1:', agent.id);
  
  // Migrate to node 2
  const result = await hive1.network.migrate(agent.id, 'node-2');
  
  if (result.success) {
    console.log('Agent migrated to node 2!');
    console.log('Checkpoint:', result.checkpoint);
  }
  
  await hive1.stop();
  await hive2.stop();
}
```

---

## API Reference

### HiveMind Class

```typescript
class HiveMind {
  kernel: Kernel;
  filesystem: AgentFS;
  network: DistributedNetwork;
  ipc: IPCManager;

  constructor(config?: Partial<HiveMindConfig>);
  async start(): Promise<void>;
  async stop(): Promise<void>;
  async spawnAgent(name: string, agentClass: string, parent?: string, capabilities?: AgentCapabilities): Promise<BaseAgent>;
  async terminateAgent(agentId: string): Promise<void>;
  listAgents(): Agent[];
  getStats(): SystemStats;
  isRunning(): boolean;
  getConfig(): HiveMindConfig;
}
```

### BaseAgent Class

```typescript
abstract class BaseAgent extends EventEmitter {
  readonly id: AgentID;
  readonly name: string;
  readonly type: AgentType;
  state: AgentState;
  parent?: AgentID;
  children: AgentID[];
  readonly capabilities: AgentCapabilities;
  
  constructor(name: string, type: AgentType, parent?: AgentID, capabilities?: Partial<AgentCapabilities>);
  async initialize(context: AgentContext): Promise<void>;
  async run(): Promise<void>;
  async terminate(code?: number): Promise<void>;
  async send(recipient: AgentID, type: MessageType, payload: unknown): Promise<AgentMessage>;
  async request<T>(recipient: AgentID, type: MessageType, payload: unknown, timeout?: number): Promise<AgentMessage>;
  async broadcast(type: MessageType, payload: unknown): Promise<void>;
  async publish(type: string, data: unknown, metadata?: Record<string, unknown>): Promise<Event>;
  onMessage(type: MessageType, handler: MessageHandler): void;
  offMessage(type: MessageType, handler: MessageHandler): void;
  async handleMessage(message: AgentMessage): Promise<void>;
  async subscribe(streamId: EventStreamID, callback: (event: Event) => void): Promise<string>;
  async unsubscribe(streamId: EventStreamID): Promise<void>;
  suspend(): void;
  resume(): void;
  getInfo(): Agent;
}
```

### Kernel Class

```typescript
class Kernel extends BaseAgent {
  readonly version: string;
  uptime: number;
  scheduler: Scheduler;
  memoryManager: MemoryManager;
  eventRouter: EventRouter;
  processTable: ProcessTable;
  
  async start(): Promise<void>;
  async stop(): Promise<void>;
  async spawnAgent(...): Promise<BaseAgent>;
  async terminateAgent(agentId: AgentID, code?: number): Promise<void>;
  async migrateAgent(agentId: AgentID, toNode: string): Promise<void>;
  getSystemStats(): SystemStats;
  listAgents(): Agent[];
}
```

### AgentFS Class

```typescript
class AgentFS {
  async mount(path: string, target: BaseAgent, options?: MountOptions): Promise<MountPoint>;
  async unmount(path: string): Promise<void>;
  async read(path: string, options?: { offset?: number; length?: number }): Promise<unknown>;
  async write(path: string, data: unknown): Promise<void>;
  async list(path: string): Promise<string[]>;
  async stat(path: string): Promise<FileStats | null>;
  async create(type: 'file' | 'directory', path: string, content?: string): Promise<void>;
  async delete(path: string, recursive?: boolean): Promise<void>;
  async sendToPath(path: string, message: AgentMessage): Promise<AgentMessage>;
  getMountPoints(): MountPoint[];
  getStats(): { mountPointCount: number; agentCount: number; totalPaths: number };
}
```

---

## Distributed Computing

### Node Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      HiveMind Cluster                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│    │   Node A    │◄──►│   Node B    │◄──►│   Node C    │      │
│    │  10.0.0.1   │    │  10.0.0.2   │    │  10.0.0.3   │      │
│    │             │    │             │    │             │      │
│    │ ┌─────────┐ │    │ ┌─────────┐ │    │ ┌─────────┐ │      │
│    │ │ Kernel  │ │    │ │ Kernel  │ │    │ │ Kernel  │ │      │
│    │ └─────────┘ │    │ └─────────┘ │    │ └─────────┘ │      │
│    │             │    │             │    │             │      │
│    │ ┌─────────┐ │    │ ┌─────────┐ │    │ ┌─────────┐ │      │
│    │ │ Agent 1 │ │    │ │ Agent 3 │ │    │ │ Agent 5 │ │      │
│    │ └─────────┘ │    │ └─────────┘ │    │ └─────────┘ │      │
│    │ ┌─────────┐ │    │             │    │ ┌─────────┐ │      │
│    │ │ Agent 2 │ │    │ ┌─────────┐ │    │ │ Agent 6 │ │      │
│    │ └─────────┘ │    │ │ Agent 4 │ │    │ └─────────┘ │      │
│    │             │    │ └─────────┘ │    │             │      │
│    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘      │
│           │                  │                  │              │
│           └──────────────────┼──────────────────┘              │
│                              │                                  │
│                    Gossip Protocol                             │
│                    Agent Migration                              │
│                    State Synchronization                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Agent Migration Flow

```
┌─────────────┐                     ┌─────────────┐
│   Source    │                     │   Target    │
│   Node      │                     │   Node      │
│             │                     │             │
│ ┌─────────┐ │   1. Migration       │ ┌─────────┐ │
│ │ Agent X │ │────────────────────►│ │ Resume  │ │
│ └────┬────┘ │   Request +         │ │ Agent X │ │
│      │      │   Checkpoint         │ └────┬────┘ │
│      │      │                      │      │      │
│      │      │   2. ACK             │      │      │
│      │      │◄─────────────────────│      │      │
│      │      │   (success/error)    │      │      │
│      │      │                      │      │      │
│ ┌────┴────┐ │   3. Cleanup         │      │      │
│ │Remove   │ │                     │      │      │
│ │Agent X  │ │                     │      │      │
│ └─────────┘ │                     │      │      │
│             │                     │      │      │
└─────────────┘                     └──────┴──────┘

Checkpoint Contains:
- Memory state (heap, stack)
- Open file handles
- Event stream position
- Network connections
- Execution state
```

---

## Filesystem as Agents

### Concept

In HiveMind, every file and directory is an **agent** that can:

- Receive and respond to messages
- Publish events to streams
- Handle IPC with other agents
- Be mounted at agent endpoints

### File Agent

```typescript
class FileAgent extends BaseAgent {
  path: string;
  size: number;
  permissions: FilePermissions;
  lastModified: number;
  
  // Messages it handles:
  // - READ: Read file contents
  // - WRITE: Write to file
  // - STAT: Get file statistics
  // - CHMOD: Change permissions
}
```

### Directory Agent

```typescript
class DirectoryAgent extends BaseAgent {
  path: string;
  entries: string[];
  children: AgentID[];
  
  // Messages it handles:
  // - LIST: List directory contents
  // - CREATE: Create file/directory
  // - DELETE: Delete entry
  // - LOOKUP: Find entry
}
```

### Mount Points as Agent Endpoints

```typescript
// Mount an agent at a path
await fs.mount('/agents/database', databaseAgent);

// Now you can send messages to /agents/database
await fs.sendToPath('/agents/database', {
  type: 'QUERY',
  payload: { sql: 'SELECT * FROM users' }
});

// Read from the mounted agent
const result = await fs.read('/agents/database');
```

---

## Configuration

### Full Configuration

```typescript
const config: HiveMindConfig = {
  kernel: {
    tickRate: 10,              // Kernel tick rate in ms
    maxAgents: 10000,          // Maximum number of agents
    heartbeatInterval: 1000,   // Heartbeat check interval in ms
    watchdogTimeout: 30000      // Watchdog timeout in ms
  },
  
  filesystem: {
    rootPath: '/',              // Root filesystem path
    mountPoints: [],            // Pre-configured mount points
    maxFileSize: 100 * 1024 * 1024  // 100MB max file size
  },
  
  network: {
    port: 8080,                 // Network port
    nodes: [],                  // Known nodes
    gossipInterval: 5000,       // Gossip protocol interval in ms
    migrationEnabled: true       // Allow agent migration
  },
  
  scheduler: {
    algorithm: SchedulingAlgorithm.MULTILEVEL_FEEDBACK_QUEUE,
    quantum: 100,               // Time quantum in ms
    priorityLevels: 5            // Number of priority levels
  },
  
  memory: {
    maxHeapMB: 4096,            // Maximum heap size in MB
    maxStackKB: 8192,           // Maximum stack size in KB
    pageSize: 4096,             // Memory page size
    swapEnabled: true            // Enable swapping
  }
};
```

---

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

MIT License - See [LICENSE](LICENSE) for details.

---

```
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║     Built with ❤️ by the HiveMind Collective               ║
║     Where Processes ARE Agents                             ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
```
