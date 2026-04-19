/**
 * HiveMind - Multi-Agent Operating System
 * Kernel Agent - The Heart of the Operating System
 * 
 * The Kernel is responsible for:
 * - Scheduling and managing all agents/processes
 * - Memory management and allocation
 * - Event loop and message routing
 * - System resource allocation
 * - Agent lifecycle management
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  BaseAgent,
  Agent,
  AgentID,
  AgentType,
  AgentState,
  AgentPriority,
  KernelAgent,
  KernelConfig,
  SchedulingAlgorithm,
  ProcessSchedule,
  MemoryManagerState,
  EventLoopState,
  SchedulerState,
  SystemEventType,
  MessageType,
  AgentMessage,
  MemoryLimits,
  AgentMemory,
  MemorySegment,
  MemoryType,
  MemoryPermissions,
  ProcessAgent,
  AgentContext
} from '../types';
import { MemoryManager } from './MemoryManager';
import { Scheduler } from './Scheduler';
import { EventRouter } from './EventRouter';
import { ProcessTable } from './ProcessTable';

export class Kernel extends BaseAgent {
  public readonly type = AgentType.KERNEL;
  public readonly version = '1.0.0';
  public uptime: number = 0;
  
  public scheduler!: Scheduler;
  public memoryManager!: MemoryManager;
  public eventRouter!: EventRouter;
  public processTable!: ProcessTable;

  private config: KernelConfig;
  private startTime: number = 0;
  private eventLoopInterval: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private agentRegistry: Map<AgentID, BaseAgent> = new Map();
  private readonly MAX_AGENTS_DEFAULT = 10000;
  private readonly HEARTBEAT_INTERVAL_DEFAULT = 1000;
  private readonly WATCHDOG_TIMEOUT_DEFAULT = 30000;

  constructor(config?: Partial<KernelConfig>) {
    super('HiveMind-Kernel', AgentType.KERNEL, undefined, {
      canMigrate: false,
      canSpawnChildren: true,
      canHandleIPC: true,
      canAccessFilesystem: true,
      canNetwork: true,
      maxMemoryMB: 1024,
      priority: AgentPriority.CRITICAL
    });

    this.config = {
      tickRate: config?.tickRate ?? 10,
      maxAgents: config?.maxAgents ?? this.MAX_AGENTS_DEFAULT,
      heartbeatInterval: config?.heartbeatInterval ?? this.HEARTBEAT_INTERVAL_DEFAULT,
      watchdogTimeout: config?.watchdogTimeout ?? this.WATCHDOG_TIMEOUT_DEFAULT
    };

    this.metadata = {
      version: this.version,
      config: this.config
    };
  }

  /**
   * Kernel initialization
   */
  async onInitialize(): Promise<void> {
    console.log('[Kernel] Initializing HiveMind OS...');
    this.startTime = Date.now();
    
    // Initialize subsystems
    this.memoryManager = new MemoryManager({
      maxHeapMB: 4096,
      maxStackKB: 8192,
      maxTotalMB: 8192,
      pageSize: 4096,
      swapEnabled: true
    });

    this.scheduler = new Scheduler({
      algorithm: SchedulingAlgorithm.MULTILEVEL_FEEDBACK_QUEUE,
      quantum: 100,
      priorityLevels: 5
    });

    this.eventRouter = new EventRouter(this);
    this.processTable = new ProcessTable();

    // Register kernel as first agent
    this.agentRegistry.set(this.id, this);

    // Setup kernel message handlers
    this.setupKernelHandlers();

    console.log('[Kernel] HiveMind OS initialized successfully');
    console.log(`[Kernel] Max agents: ${this.config.maxAgents}`);
    console.log(`[Kernel] Tick rate: ${this.config.tickRate}ms`);
  }

  /**
   * Start the kernel's main event loop
   */
  async start(): Promise<void> {
    await this.initialize({
      agent: this.getInfo() as KernelAgent,
      eventStream: this.eventRouter.createStream('kernel'),
      memory: this.memoryManager.allocate(this.id)!,
      filesystem: this.createFilesystemAPI(),
      ipc: this.createIPCAPI(),
      network: this.createNetworkAPI()
    } as AgentContext);

    this.startEventLoop();
    this.startHeartbeatMonitor();
    this.startWatchdog();

    console.log('[Kernel] Event loop started');
    
    // Run the agent's main loop
    await this.run();
  }

  /**
   * Main kernel event loop
   */
  protected async tick(): Promise<void> {
    this.uptime = Date.now() - this.startTime;
    this.state = AgentState.RUNNING;

    // Process scheduled agents
    const scheduled = this.scheduler.schedule();
    for (const process of scheduled) {
      const agent = this.agentRegistry.get(process.processId);
      if (agent && agent.state === AgentState.RUNNING) {
        // Give CPU time to agent
        await agent.emit('process:tick', { quantum: this.scheduler.quantum });
      }
    }

    // Route pending events
    await this.eventRouter.processQueue();

    // Memory management tick
    await this.memoryManager.tick();

    // Emit kernel tick event
    this.emit(SystemEventType.KERNEL_TICK, {
      uptime: this.uptime,
      agentCount: this.agentRegistry.size,
      eventsProcessed: this.eventRouter.eventsProcessed
    });
  }

  /**
   * Start the event loop interval
   */
  private startEventLoop(): void {
    this.eventLoopInterval = setInterval(async () => {
      if (this.state === AgentState.RUNNING) {
        try {
          await this.tick();
        } catch (error) {
          console.error('[Kernel] Tick error:', error);
        }
      }
    }, this.config.tickRate);
  }

  /**
   * Start heartbeat monitoring for all agents
   */
  private startHeartbeatMonitor(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      for (const [agentId, agent] of this.agentRegistry) {
        if (agentId === this.id) continue;
        
        const timeSinceHeartbeat = now - agent.lastHeartbeat;
        if (timeSinceHeartbeat > this.config.heartbeatInterval * 2) {
          console.warn(`[Kernel] Agent ${agentId} heartbeat timeout`);
          this.handleAgentFault(agentId, 'Heartbeat timeout');
        }
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Start watchdog for agent monitoring
   */
  private startWatchdog(): void {
    setInterval(() => {
      for (const [agentId, agent] of this.agentRegistry) {
        if (agent.state === AgentState.FAILED) {
          this.cleanupFailedAgent(agentId);
        }
      }
    }, this.config.watchdogInterval ?? 5000);
  }

  /**
   * Setup kernel message handlers
   */
  private setupKernelHandlers(): void {
    this.onMessage(MessageType.SPAWN, async (msg) => {
      return this.handleSpawnRequest(msg);
    });

    this.onMessage(MessageType.TERMINATE, async (msg) => {
      return this.handleTerminateRequest(msg);
    });

    this.onMessage(MessageType.MIGRATE, async (msg) => {
      return this.handleMigrateRequest(msg);
    });

    this.onMessage(MessageType.REQUEST, async (msg) => {
      return this.handleSystemRequest(msg);
    });
  }

  /**
   * Handle agent spawn request
   */
  private async handleSpawnRequest(msg: AgentMessage): Promise<AgentMessage> {
    const { agentClass, name, parent, capabilities } = msg.payload as {
      agentClass: string;
      name: string;
      parent?: AgentID;
      capabilities?: Agent['capabilities'];
    };

    try {
      if (this.agentRegistry.size >= this.config.maxAgents) {
        throw new Error('Maximum agent limit reached');
      }

      const agent = await this.spawnAgent(agentClass, name, parent, capabilities);
      
      return {
        id: uuidv4(),
        sender: this.id,
        recipient: msg.sender,
        type: MessageType.RESPONSE,
        payload: { success: true, agentId: agent.id },
        timestamp: Date.now(),
        priority: AgentPriority.CRITICAL,
        replyTo: msg.id
      } as AgentMessage;
    } catch (error) {
      return {
        id: uuidv4(),
        sender: this.id,
        recipient: msg.sender,
        type: MessageType.RESPONSE,
        payload: { success: false, error: (error as Error).message },
        timestamp: Date.now(),
        priority: AgentPriority.CRITICAL,
        replyTo: msg.id
      } as AgentMessage;
    }
  }

  /**
   * Spawn a new agent
   */
  async spawnAgent(
    agentClass: string,
    name: string,
    parent?: AgentID,
    capabilities?: Partial<Agent['capabilities']>
  ): Promise<BaseAgent> {
    // Create agent based on class name
    const AgentClass = this.getAgentClass(agentClass);
    const agent = new AgentClass(name, parent, capabilities);

    // Register agent
    this.agentRegistry.set(agent.id, agent);
    this.processTable.add(agent as unknown as ProcessAgent);

    // Add to parent's children
    if (parent) {
      const parentAgent = this.agentRegistry.get(parent);
      if (parentAgent) {
        parentAgent.children.push(agent.id);
      }
    }

    // Initialize agent with kernel context
    const context = await this.createAgentContext(agent);
    await agent.initialize(context);

    // Register with scheduler
    this.scheduler.register(agent.id, capabilities?.priority ?? AgentPriority.NORMAL);

    this.emit(SystemEventType.AGENT_SPAWNED, { agent: agent.getInfo() });

    return agent;
  }

  /**
   * Get agent class by name
   */
  private getAgentClass(agentClass: string): new (...args: unknown[]) => BaseAgent {
    // In production, this would dynamically load agent implementations
    const classes: Record<string, new (...args: unknown[]) => BaseAgent> = {
      'process': class ProcessAgent extends BaseAgent {
        constructor(name: string, parent?: AgentID) {
          super(name, AgentType.PROCESS, parent);
        }
      },
      'filesystem': class FilesystemAgent extends BaseAgent {
        constructor(name: string) {
          super(name, AgentType.FILESYSTEM, undefined, {
            canAccessFilesystem: true
          });
        }
      },
      'network': class NetworkAgent extends BaseAgent {
        constructor(name: string) {
          super(name, AgentType.NETWORK, undefined, {
            canNetwork: true
          });
        }
      }
    };

    return classes[agentClass] || class GenericAgent extends BaseAgent {
      constructor(n: string) { super(n, AgentType.USER); }
    };
  }

  /**
   * Create agent context for initialization
   */
  private async createAgentContext(agent: BaseAgent): Promise<AgentContext> {
    const stream = this.eventRouter.createStream(`agent-${agent.id}`);
    
    return {
      agent: agent.getInfo(),
      eventStream: stream,
      memory: this.memoryManager.allocate(agent.id)!,
      filesystem: this.createFilesystemAPI(),
      ipc: this.createIPCAPIForAgent(agent),
      network: this.createNetworkAPI()
    };
  }

  /**
   * Handle agent terminate request
   */
  private async handleTerminateRequest(msg: AgentMessage): Promise<AgentMessage> {
    const { agentId, code } = msg.payload as { agentId: AgentID; code?: number };

    try {
      await this.terminateAgent(agentId, code);
      
      return {
        id: uuidv4(),
        sender: this.id,
        recipient: msg.sender,
        type: MessageType.RESPONSE,
        payload: { success: true },
        timestamp: Date.now(),
        priority: AgentPriority.CRITICAL,
        replyTo: msg.id
      } as AgentMessage;
    } catch (error) {
      return {
        id: uuidv4(),
        sender: this.id,
        recipient: msg.sender,
        type: MessageType.RESPONSE,
        payload: { success: false, error: (error as Error).message },
        timestamp: Date.now(),
        priority: AgentPriority.CRITICAL,
        replyTo: msg.id
      } as AgentMessage;
    }
  }

  /**
   * Terminate an agent
   */
  async terminateAgent(agentId: AgentID, code: number = 0): Promise<void> {
    const agent = this.agentRegistry.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    await agent.terminate(code);
    this.agentRegistry.delete(agentId);
    this.processTable.remove(agentId);
    this.scheduler.unregister(agentId);
    this.memoryManager.deallocate(agentId);

    this.emit(SystemEventType.AGENT_TERMINATED, { agentId, exitCode: code });
  }

  /**
   * Handle agent migrate request
   */
  private async handleMigrateRequest(msg: AgentMessage): Promise<AgentMessage> {
    const { agentId, toNode } = msg.payload as { agentId: AgentID; toNode: string };

    try {
      // TODO: Implement actual migration
      await this.migrateAgent(agentId, toNode);
      
      return {
        id: uuidv4(),
        sender: this.id,
        recipient: msg.sender,
        type: MessageType.RESPONSE,
        payload: { success: true, agentId, toNode },
        timestamp: Date.now(),
        priority: AgentPriority.CRITICAL,
        replyTo: msg.id
      } as AgentMessage;
    } catch (error) {
      return {
        id: uuidv4(),
        sender: this.id,
        recipient: msg.sender,
        type: MessageType.RESPONSE,
        payload: { success: false, error: (error as Error).message },
        timestamp: Date.now(),
        priority: AgentPriority.CRITICAL,
        replyTo: msg.id
      } as AgentMessage;
    }
  }

  /**
   * Migrate an agent to another node
   */
  async migrateAgent(agentId: AgentID, toNode: string): Promise<void> {
    const agent = this.agentRegistry.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    if (!agent.capabilities.canMigrate) {
      throw new Error('Agent cannot migrate');
    }

    // Create checkpoint
    const checkpoint = {
      agentId,
      timestamp: Date.now(),
      memory: this.memoryManager.getMemorySnapshot(agentId),
      state: agent.state,
      eventStreamPosition: 0,
      openConnections: []
    };

    // Serialize agent state
    const serialized = JSON.stringify(checkpoint);

    // TODO: Send to target node via network
    // TODO: Remove from this node
    // TODO: Resume on target node

    this.emit(SystemEventType.AGENT_MIGRATED, { agentId, toNode, checkpoint });
  }

  /**
   * Handle system request
   */
  private async handleSystemRequest(msg: AgentMessage): Promise<AgentMessage> {
    const { action, params } = msg.payload as { action: string; params?: unknown };

    let result: unknown;
    switch (action) {
      case 'stats':
        result = this.getSystemStats();
        break;
      case 'list':
        result = this.listAgents();
        break;
      case 'memory':
        result = this.memoryManager.getStats();
        break;
      case 'scheduler':
        result = this.scheduler.getState();
        break;
      default:
        throw new Error(`Unknown system action: ${action}`);
    }

    return {
      id: uuidv4(),
      sender: this.id,
      recipient: msg.sender,
      type: MessageType.RESPONSE,
      payload: { success: true, result },
      timestamp: Date.now(),
      priority: AgentPriority.CRITICAL,
      replyTo: msg.id
    } as AgentMessage;
  }

  /**
   * Handle agent fault
   */
  private handleAgentFault(agentId: AgentID, reason: string): void {
    const agent = this.agentRegistry.get(agentId);
    if (agent) {
      agent.state = AgentState.FAILED;
      this.emit(SystemEventType.AGENT_FAULTED, { agentId, reason });
    }
  }

  /**
   * Cleanup failed agent
   */
  private cleanupFailedAgent(agentId: AgentID): void {
    const agent = this.agentRegistry.get(agentId);
    if (agent && agent.state === AgentState.FAILED) {
      console.log(`[Kernel] Cleaning up failed agent: ${agentId}`);
      this.agentRegistry.delete(agentId);
      this.processTable.remove(agentId);
      this.scheduler.unregister(agentId);
      this.memoryManager.deallocate(agentId);
    }
  }

  /**
   * Get system statistics
   */
  getSystemStats(): {
    uptime: number;
    agentCount: number;
    memory: MemoryManagerState;
    scheduler: SchedulerState;
    eventLoop: EventLoopState;
  } {
    return {
      uptime: this.uptime,
      agentCount: this.agentRegistry.size,
      memory: this.memoryManager.getStats(),
      scheduler: this.scheduler.getState(),
      eventLoop: {
        running: this.state === AgentState.RUNNING,
        tickRate: this.config.tickRate,
        lastTick: Date.now(),
        eventsProcessed: this.eventRouter.eventsProcessed
      }
    };
  }

  /**
   * List all registered agents
   */
  listAgents(): Agent[] {
    return Array.from(this.agentRegistry.values()).map(a => a.getInfo());
  }

  /**
   * Create filesystem API
   */
  private createFilesystemAPI() {
    return {
      read: async (path: string) => ({ path, content: '' }),
      write: async (path: string, data: unknown) => {},
      stat: async (path: string) => ({ size: 0, isDirectory: false }),
      list: async (path: string) => [] as string[],
      create: async (type: 'file' | 'directory', path: string) => {},
      delete: async (path: string) => {},
      chmod: async (path: string, permissions: unknown) => {},
      mount: async (source: string, target: string, options?: unknown) => {},
      unmount: async (target: string) => {}
    };
  }

  /**
   * Create IPC API for kernel
   */
  private createIPCAPI() {
    return {
      send: async (to: AgentID, message: AgentMessage) => {
        const agent = this.agentRegistry.get(to);
        if (agent) {
          await agent.handleMessage(message);
        }
      },
      broadcast: async (message: AgentMessage) => {
        for (const agent of this.agentRegistry.values()) {
          if (agent.id !== message.sender) {
            await agent.handleMessage(message);
          }
        }
      },
      subscribe: async (stream: string, handler: (event: unknown) => void) => {
        return this.eventRouter.subscribe(stream, handler);
      },
      unsubscribe: async (subscriptionId: string) => {
        this.eventRouter.unsubscribe(subscriptionId);
      },
      createStream: async (name: string) => {
        return this.eventRouter.createStream(name);
      },
      pipe: async (from: string, to: string) => {
        this.eventRouter.pipe(from, to);
      },
      signal: async (pid: AgentID, signal: unknown) => {
        const agent = this.agentRegistry.get(pid);
        if (agent) {
          agent.emit('signal', signal);
        }
      }
    };
  }

  /**
   * Create IPC API for specific agent
   */
  private createIPCAPIForAgent(agent: BaseAgent) {
    return {
      send: async (to: AgentID, message: AgentMessage) => {
        const recipient = this.agentRegistry.get(to);
        if (recipient) {
          await recipient.handleMessage(message);
        }
      },
      broadcast: async (message: AgentMessage) => {
        for (const a of this.agentRegistry.values()) {
          if (a.id !== agent.id) {
            await a.handleMessage(message);
          }
        }
      },
      subscribe: async (stream: string, handler: (event: unknown) => void) => {
        return this.eventRouter.subscribe(stream, handler);
      },
      unsubscribe: async (subscriptionId: string) => {
        this.eventRouter.unsubscribe(subscriptionId);
      },
      createStream: async (name: string) => {
        return this.eventRouter.createStream(`${name}-${agent.id}`);
      },
      pipe: async (from: string, to: string) => {
        this.eventRouter.pipe(from, to);
      },
      signal: async (pid: AgentID, signal: unknown) => {
        const target = this.agentRegistry.get(pid);
        if (target) {
          target.emit('signal', signal);
        }
      }
    };
  }

  /**
   * Create network API
   */
  private createNetworkAPI() {
    return {
      connect: async (nodeId: string) => {
        console.log(`[Kernel] Connecting to node: ${nodeId}`);
      },
      disconnect: async (nodeId: string) => {
        console.log(`[Kernel] Disconnecting from node: ${nodeId}`);
      },
      send: async (to: AgentID, message: AgentMessage) => {
        // Route to remote agent via network
      },
      broadcast: async (message: AgentMessage) => {
        // Broadcast to all connected nodes
      },
      migrate: async (agentId: AgentID, toNode: string) => {
        return this.migrateAgent(agentId, toNode);
      }
    };
  }

  /**
   * Stop the kernel
   */
  async stop(): Promise<void> {
    console.log('[Kernel] Shutting down...');

    // Stop event loop
    if (this.eventLoopInterval) {
      clearInterval(this.eventLoopInterval);
      this.eventLoopInterval = null;
    }

    // Stop heartbeat monitor
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Terminate all agents gracefully
    for (const agent of this.agentRegistry.values()) {
      if (agent.id !== this.id) {
        await agent.terminate(0);
      }
    }

    this.running = false;
    this.state = AgentState.TERMINATED;
    console.log('[Kernel] Shutdown complete');
  }
}
