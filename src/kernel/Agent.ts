/**
 * HiveMind - Multi-Agent Operating System
 * Base Agent Class
 * 
 * Every process in HiveMind IS an agent. This base class provides the
 * foundation for all agents including kernel agents, filesystem agents,
 * process agents, and user agents.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  Agent,
  AgentID,
  AgentType,
  AgentState,
  AgentCapabilities,
  AgentMessage,
  AgentContext,
  MessageType,
  MessageHandler,
  MessageFilter,
  Event,
  EventStream,
  Signal,
  SystemEventType,
  AgentPriority,
  MemoryLimits,
  AgentMemory
} from '../types';

export abstract class BaseAgent extends EventEmitter implements Agent {
  public readonly id: AgentID;
  public readonly name: string;
  public readonly type: AgentType;
  public state: AgentState;
  public readonly parent?: AgentID;
  public children: AgentID[] = [];
  public readonly capabilities: AgentCapabilities;
  public metadata: Record<string, unknown>;
  public readonly createdAt: number;
  public lastHeartbeat: number;

  protected context: AgentContext | null = null;
  protected messageHandlers: Map<MessageType, MessageHandler[]> = new Map();
  protected eventSubscriptions: Map<string, string> = new Map();
  protected running: boolean = false;

  constructor(
    name: string,
    type: AgentType,
    parent?: AgentID,
    capabilities?: Partial<AgentCapabilities>
  ) {
    super();
    this.id = uuidv4();
    this.name = name;
    this.type = type;
    this.state = AgentState.CREATED;
    this.parent = parent;
    this.metadata = {};
    this.createdAt = Date.now();
    this.lastHeartbeat = this.createdAt;

    this.capabilities = {
      canMigrate: capabilities?.canMigrate ?? false,
      canSpawnChildren: capabilities?.canSpawnChildren ?? false,
      canHandleIPC: capabilities?.canHandleIPC ?? true,
      canAccessFilesystem: capabilities?.canAccessFilesystem ?? false,
      canNetwork: capabilities?.canNetwork ?? false,
      maxMemoryMB: capabilities?.maxMemoryMB ?? 128,
      priority: capabilities?.priority ?? AgentPriority.NORMAL
    };
  }

  /**
   * Initialize the agent - called once when agent starts
   */
  async initialize(context: AgentContext): Promise<void> {
    this.context = context;
    this.state = AgentState.INITIALIZING;
    this.setupDefaultHandlers();
    await this.onInitialize();
    this.state = AgentState.RUNNING;
    this.running = true;
    this.emit(SystemEventType.AGENT_SPAWNED, { agent: this });
  }

  /**
   * Hook for subclasses to implement initialization logic
   */
  protected async onInitialize(): Promise<void> {
    // Override in subclasses
  }

  /**
   * Main execution loop for the agent
   */
  async run(): Promise<void> {
    this.running = true;
    while (this.running && this.state === AgentState.RUNNING) {
      try {
        await this.tick();
        await this.sleep(10); // 10ms tick rate
      } catch (error) {
        console.error(`Agent ${this.id} tick error:`, error);
        this.state = AgentState.FAILED;
        this.emit(SystemEventType.AGENT_FAULTED, { agent: this, error });
      }
    }
  }

  /**
   * Single tick of the agent's execution loop
   */
  protected async tick(): Promise<void> {
    this.lastHeartbeat = Date.now();
    await this.processMessages();
    await this.processEvents();
  }

  /**
   * Process pending messages
   */
  protected async processMessages(): Promise<void> {
    // Implemented by subclasses with IPC context
  }

  /**
   * Process pending events
   */
  protected async processEvents(): Promise<void> {
    // Implemented by subclasses with EventStream context
  }

  /**
   * Send a message to another agent
   */
  async send(recipient: AgentID, type: MessageType, payload: unknown): Promise<AgentMessage> {
    const message: AgentMessage = {
      id: uuidv4(),
      sender: this.id,
      recipient,
      type,
      payload,
      timestamp: Date.now(),
      priority: this.capabilities.priority,
      headers: {}
    };

    if (this.context?.ipc) {
      await this.context.ipc.send(recipient, message);
    }

    this.emit('message:sent', message);
    return message;
  }

  /**
   * Send a message and wait for response
   */
  async request<T = unknown>(
    recipient: AgentID,
    type: MessageType,
    payload: unknown,
    timeout: number = 5000
  ): Promise<AgentMessage> {
    const message = await this.send(recipient, type, payload);
    
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.off(`message:response:${message.id}`, handler);
        reject(new Error(`Request timeout after ${timeout}ms`));
      }, timeout);

      const handler = (response: AgentMessage) => {
        clearTimeout(timeoutId);
        resolve(response);
      };

      this.once(`message:response:${message.id}`, handler);
    });
  }

  /**
   * Broadcast a message to all connected agents
   */
  async broadcast(type: MessageType, payload: unknown): Promise<void> {
    const message: AgentMessage = {
      id: uuidv4(),
      sender: this.id,
      recipient: 'broadcast',
      type,
      payload,
      timestamp: Date.now(),
      priority: this.capabilities.priority,
      headers: { broadcast: 'true' }
    };

    if (this.context?.ipc) {
      await this.context.ipc.broadcast(message);
    }
  }

  /**
   * Register a message handler
   */
  onMessage(type: MessageType, handler: MessageHandler): void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, []);
    }
    this.messageHandlers.get(type)!.push(handler);
  }

  /**
   * Remove a message handler
   */
  offMessage(type: MessageType, handler: MessageHandler): void {
    const handlers = this.messageHandlers.get(type);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Handle an incoming message
   */
  async handleMessage(message: AgentMessage): Promise<void> {
    const handlers = this.messageHandlers.get(message.type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          await handler(message);
        } catch (error) {
          console.error(`Handler error for ${message.type}:`, error);
        }
      }
    }
    this.emit('message:received', message);
  }

  /**
   * Subscribe to an event stream
   */
  async subscribe(streamId: EventStreamID, callback: (event: Event) => void): Promise<string> {
    if (this.context?.eventStream) {
      const subscriptionId = await this.context.ipc.subscribe(streamId, callback);
      this.eventSubscriptions.set(streamId, subscriptionId);
      return subscriptionId;
    }
    throw new Error('EventStream not available');
  }

  /**
   * Unsubscribe from an event stream
   */
  async unsubscribe(streamId: EventStreamID): Promise<void> {
    const subscriptionId = this.eventSubscriptions.get(streamId);
    if (subscriptionId && this.context?.ipc) {
      await this.context.ipc.unsubscribe(subscriptionId);
      this.eventSubscriptions.delete(streamId);
    }
  }

  /**
   * Publish an event to the agent's event stream
   */
  async publish(type: string, data: unknown, metadata?: Record<string, unknown>): Promise<Event> {
    if (!this.context?.eventStream) {
      throw new Error('EventStream not available');
    }

    const event: Event = {
      id: uuidv4(),
      stream: this.context.eventStream.id,
      type,
      data,
      timestamp: Date.now(),
      source: this.id,
      metadata: metadata ?? {}
    };

    // Emit locally
    this.context.eventStream.events.push(event);
    this.emit('event:published', event);

    return event;
  }

  /**
   * Spawn a child agent
   */
  async spawn<T extends BaseAgent>(
    agentClass: new (...args: unknown[]) => T,
    ...args: unknown[]
  ): Promise<T> {
    if (!this.capabilities.canSpawnChildren) {
      throw new Error('Agent cannot spawn children');
    }

    const agent = new agentClass(...args);
    this.children.push(agent.id);
    return agent;
  }

  /**
   * Terminate the agent gracefully
   */
  async terminate(code: number = 0): Promise<void> {
    this.state = AgentState.TERMINATED;
    this.running = false;

    // Clean up subscriptions
    for (const [streamId, subscriptionId] of this.eventSubscriptions) {
      try {
        await this.context?.ipc.unsubscribe(subscriptionId);
      } catch (error) {
        console.error(`Failed to unsubscribe from ${streamId}:`, error);
      }
    }

    // Terminate children
    for (const childId of this.children) {
      // Signal children to terminate
      if (this.context?.ipc) {
        await this.context.ipc.signal(childId, Signal.SIGTERM);
      }
    }

    await this.onTerminate();
    this.emit(SystemEventType.AGENT_TERMINATED, { agent: this, exitCode: code });
  }

  /**
   * Hook for cleanup on termination
   */
  protected async onTerminate(): Promise<void> {
    // Override in subclasses
  }

  /**
   * Suspend the agent
   */
  suspend(): void {
    if (this.state === AgentState.RUNNING) {
      this.state = AgentState.SUSPENDED;
      this.emit('agent:suspended', { agent: this });
    }
  }

  /**
   * Resume a suspended agent
   */
  resume(): void {
    if (this.state === AgentState.SUSPENDED) {
      this.state = AgentState.RUNNING;
      this.running = true;
      this.emit('agent:resumed', { agent: this });
    }
  }

  /**
   * Get agent memory statistics
   */
  getMemoryUsage(): { used: number; limit: number } {
    const limits: MemoryLimits = {
      maxHeapMB: this.capabilities.maxMemoryMB,
      maxStackKB: 1024,
      maxTotalMB: this.capabilities.maxMemoryMB
    };
    // Estimate current usage (in real impl, would measure actual heap)
    return {
      used: process.memoryUsage().heapUsed / (1024 * 1024),
      limit: limits.maxHeapMB
    };
  }

  /**
   * Get agent info
   */
  getInfo(): Agent {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      state: this.state,
      parent: this.parent,
      children: [...this.children],
      capabilities: { ...this.capabilities },
      metadata: { ...this.metadata },
      createdAt: this.createdAt,
      lastHeartbeat: this.lastHeartbeat
    };
  }

  /**
   * Setup default message handlers
   */
  protected setupDefaultHandlers(): void {
    this.onMessage(MessageType.HEARTBEAT, async (msg) => {
      await this.send(msg.sender, MessageType.RESPONSE, { 
        status: 'alive', 
        uptime: Date.now() - this.createdAt 
      });
    });

    this.onMessage(MessageType.REQUEST, async (msg) => {
      this.emit('request:received', msg);
    });
  }

  /**
   * Sleep helper
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Factory for creating agents with common configurations
 */
export class AgentFactory {
  static createKernelAgent(name: string): typeof BaseAgent {
    return class KernelAgent extends BaseAgent {
      constructor() {
        super(name, AgentType.KERNEL, undefined, {
          canMigrate: false,
          canSpawnChildren: true,
          canHandleIPC: true,
          canAccessFilesystem: true,
          canNetwork: true,
          maxMemoryMB: 512,
          priority: AgentPriority.CRITICAL
        });
      }
    };
  }

  static createProcessAgent(
    name: string,
    parent: AgentID,
    entryPoint: string
  ): typeof BaseAgent {
    return class ProcessAgent extends BaseAgent {
      constructor() {
        super(name, AgentType.PROCESS, parent, {
          canMigrate: true,
          canSpawnChildren: true,
          canHandleIPC: true,
          canAccessFilesystem: true,
          canNetwork: false,
          maxMemoryMB: 256,
          priority: AgentPriority.NORMAL
        });
      }
    };
  }

  static createFilesystemAgent(name: string, mountPoint: string): typeof BaseAgent {
    return class FilesystemAgent extends BaseAgent {
      constructor() {
        super(name, AgentType.FILESYSTEM, undefined, {
          canMigrate: false,
          canSpawnChildren: true,
          canHandleIPC: true,
          canAccessFilesystem: true,
          canNetwork: false,
          maxMemoryMB: 256,
          priority: AgentPriority.HIGH
        });
        this.metadata = { mountPoint };
      }
    };
  }
}
