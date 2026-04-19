/**
 * HiveMind - Multi-Agent Operating System
 * IPC - Inter-Process Communication via Event Streams
 * 
 * Provides communication between agents using pi-mono
 * compatible event streams and message passing.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  AgentID,
  EventStreamID,
  MessageID,
  MessageType,
  AgentMessage,
  Event,
  EventStream,
  EventSubscription,
  EventFilter,
  Signal,
  IPCAPI
} from '../types';

/**
 * Message Queue for pending messages
 */
interface MessageQueueEntry {
  message: AgentMessage;
  receivedAt: number;
  timeout?: number;
}

/**
 * Connection between two agents
 */
interface AgentConnection {
  id: string;
  from: AgentID;
  to: AgentID;
  createdAt: number;
  messageCount: number;
  lastMessage: number;
}

/**
 * IPC Manager - Handles all inter-agent communication
 */
export class IPCManager extends EventEmitter implements IPCAPI {
  private messageQueues: Map<AgentID, MessageQueueEntry[]> = new Map();
  private connections: Map<string, AgentConnection> = new Map();
  private pendingResponses: Map<MessageID, {
    resolve: (msg: AgentMessage) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();
  private agentMessageHandlers: Map<AgentID, (msg: AgentMessage) => void | Promise<void>> = new Map();
  private eventStreams: Map<EventStreamID, EventStream> = new Map();
  private subscriptions: Map<string, EventSubscription> = new Map();
  private defaultTimeout: number = 5000;

  constructor() {
    super();
  }

  /**
   * Send a message to a specific agent
   */
  async send(to: AgentID, message: AgentMessage): Promise<void> {
    // Validate message
    if (!message.id || !message.sender || !message.to) {
      throw new Error('Invalid message format');
    }

    // Queue the message
    this.queueMessage(to, message);

    // Try to deliver immediately if handler is registered
    const handler = this.agentMessageHandlers.get(to);
    if (handler) {
      try {
        await handler(message);
        this.emit('message:delivered', { to, messageId: message.id });
      } catch (error) {
        console.error(`Error delivering message to ${to}:`, error);
      }
    }

    // Create connection if needed
    this.ensureConnection(message.sender, to);

    this.emit('message:sent', { from: message.sender, to, message });
  }

  /**
   * Broadcast a message to all connected agents
   */
  async broadcast(message: AgentMessage): Promise<void> {
    const recipients = Array.from(this.connections.values())
      .filter(c => c.from === message.sender)
      .map(c => c.to);

    for (const recipient of recipients) {
      const broadcastMessage: AgentMessage = {
        ...message,
        id: uuidv4(),
        recipient
      };
      await this.send(recipient, broadcastMessage);
    }

    this.emit('message:broadcast', { from: message.sender, recipients: recipients.length });
  }

  /**
   * Send a message and wait for response
   */
  async request(
    to: AgentID,
    type: MessageType,
    payload: unknown,
    timeout: number = this.defaultTimeout
  ): Promise<AgentMessage> {
    const message: AgentMessage = {
      id: uuidv4(),
      sender: 'system',
      recipient: to,
      type,
      payload,
      timestamp: Date.now(),
      priority: 2, // NORMAL
      headers: {}
    };

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingResponses.delete(message.id);
        reject(new Error(`Request timeout after ${timeout}ms`));
      }, timeout);

      this.pendingResponses.set(message.id, { resolve, reject, timeout: timeoutId });

      this.send(to, message).catch(reject);
    });
  }

  /**
   * Handle a response to a pending request
   */
  async respond(originalMessageId: MessageID, response: AgentMessage): Promise<void> {
    const pending = this.pendingResponses.get(originalMessageId);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingResponses.delete(originalMessageId);
      pending.resolve(response);
    }
  }

  /**
   * Subscribe to an event stream
   */
  async subscribe(
    stream: EventStreamID,
    callback: (event: Event) => void | Promise<void>
  ): Promise<string> {
    const subscriptionId = uuidv4();
    
    const subscription: EventSubscription = {
      id: subscriptionId,
      subscriber: 'system',
      stream,
      callback,
      createdAt: Date.now()
    };

    this.subscriptions.set(subscriptionId, subscription);

    // Also register with the event stream
    const eventStream = this.eventStreams.get(stream);
    if (eventStream) {
      eventStream.subscribers.set(subscriptionId, subscription);
    }

    return subscriptionId;
  }

  /**
   * Unsubscribe from an event stream
   */
  async unsubscribe(subscriptionId: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      const eventStream = this.eventStreams.get(subscription.stream);
      if (eventStream) {
        eventStream.subscribers.delete(subscriptionId);
      }
      this.subscriptions.delete(subscriptionId);
    }
  }

  /**
   * Create a new event stream
   */
  async createStream(name: string): Promise<EventStream> {
    const stream: EventStream = {
      id: uuidv4(),
      name,
      publisher: 'system',
      subscribers: new Map(),
      events: [],
      maxSize: 1000,
      ttl: 3600000
    };

    this.eventStreams.set(stream.id, stream);
    this.emit('stream:created', stream);

    return stream;
  }

  /**
   * Publish an event to a stream
   */
  async publish(streamId: EventStreamID, event: Omit<Event, 'id' | 'timestamp'>): Promise<Event> {
    const stream = this.eventStreams.get(streamId);
    if (!stream) {
      throw new Error(`Stream ${streamId} not found`);
    }

    const fullEvent: Event = {
      ...event,
      id: uuidv4(),
      timestamp: Date.now()
    };

    stream.events.push(fullEvent);

    // Deliver to subscribers
    for (const subscription of stream.subscribers.values()) {
      try {
        await subscription.callback(fullEvent);
      } catch (error) {
        console.error(`Error in subscription callback:`, error);
      }
    }

    this.emit('event:published', fullEvent);

    return fullEvent;
  }

  /**
   * Get events from a stream
   */
  getEvents(streamId: EventStreamID, limit?: number): Event[] {
    const stream = this.eventStreams.get(streamId);
    if (!stream) return [];

    const events = stream.events;
    return limit ? events.slice(-limit) : events;
  }

  /**
   * Create a pipe between two streams
   */
  async pipe(from: EventStreamID, to: EventStreamID): Promise<void> {
    const fromStream = this.eventStreams.get(from);
    if (!fromStream) {
      throw new Error(`Stream ${from} not found`);
    }

    // Create a subscription that forwards events
    await this.subscribe(from, async (event) => {
      await this.publish(to, {
        stream: to,
        type: event.type,
        data: event.data,
        source: event.source,
        metadata: { pipedFrom: from, ...event.metadata }
      });
    });

    this.emit('stream:piped', { from, to });
  }

  /**
   * Send a signal to a process
   */
  async signal(pid: AgentID, signal: Signal): Promise<void> {
    const handler = this.agentMessageHandlers.get(pid);
    if (handler) {
      const signalMessage: AgentMessage = {
        id: uuidv4(),
        sender: 'system',
        recipient: pid,
        type: MessageType.SIGNAL,
        payload: { signal },
        timestamp: Date.now(),
        priority: 0, // CRITICAL
        headers: {}
      };

      try {
        await handler(signalMessage);
        this.emit('signal:delivered', { to: pid, signal });
      } catch (error) {
        console.error(`Error delivering signal to ${pid}:`, error);
      }
    }
  }

  /**
   * Register an agent message handler
   */
  registerHandler(agentId: AgentID, handler: (msg: AgentMessage) => void | Promise<void>): void {
    this.agentMessageHandlers.set(agentId, handler);
  }

  /**
   * Unregister an agent message handler
   */
  unregisterHandler(agentId: AgentID): void {
    this.agentMessageHandlers.delete(agentId);
  }

  /**
   * Queue a message for delivery
   */
  private queueMessage(agentId: AgentID, message: AgentMessage): void {
    if (!this.messageQueues.has(agentId)) {
      this.messageQueues.set(agentId, []);
    }

    const queue = this.messageQueues.get(agentId)!;
    queue.push({
      message,
      receivedAt: Date.now()
    });

    // Limit queue size
    while (queue.length > 1000) {
      queue.shift();
    }
  }

  /**
   * Get queued messages for an agent
   */
  getQueuedMessages(agentId: AgentID): AgentMessage[] {
    const queue = this.messageQueues.get(agentId);
    if (!queue) return [];

    const messages = queue.map(entry => entry.message);
    this.messageQueues.delete(agentId);

    return messages;
  }

  /**
   * Ensure a connection exists between two agents
   */
  private ensureConnection(from: AgentID, to: AgentID): void {
    const connectionId = `${from}:${to}`;
    
    if (!this.connections.has(connectionId)) {
      const connection: AgentConnection = {
        id: connectionId,
        from,
        to,
        createdAt: Date.now(),
        messageCount: 0,
        lastMessage: Date.now()
      };

      this.connections.set(connectionId, connection);
      this.emit('connection:established', connection);
    } else {
      const connection = this.connections.get(connectionId)!;
      connection.messageCount++;
      connection.lastMessage = Date.now();
    }
  }

  /**
   * Get all connections for an agent
   */
  getConnections(agentId: AgentID): AgentConnection[] {
    return Array.from(this.connections.values()).filter(
      c => c.from === agentId || c.to === agentId
    );
  }

  /**
   * Close a connection
   */
  closeConnection(from: AgentID, to: AgentID): void {
    const connectionId = `${from}:${to}`;
    const connection = this.connections.get(connectionId);
    
    if (connection) {
      this.connections.delete(connectionId);
      this.emit('connection:closed', connection);
    }
  }

  /**
   * Get IPC statistics
   */
  getStats(): {
    queuedMessages: number;
    connections: number;
    streams: number;
    subscriptions: number;
    pendingResponses: number;
  } {
    let queuedMessages = 0;
    for (const queue of this.messageQueues.values()) {
      queuedMessages += queue.length;
    }

    return {
      queuedMessages,
      connections: this.connections.size,
      streams: this.eventStreams.size,
      subscriptions: this.subscriptions.size,
      pendingResponses: this.pendingResponses.size
    };
  }
}

/**
 * Create a message channel between two agents
 */
export class MessageChannel {
  private ipc: IPCManager;
  private localHandler: (msg: AgentMessage) => void | Promise<void>;
  public readonly id: string;
  public readonly from: AgentID;
  public readonly to: AgentID;

  constructor(
    ipc: IPCManager,
    from: AgentID,
    to: AgentID,
    handler: (msg: AgentMessage) => void | Promise<void>
  ) {
    this.ipc = ipc;
    this.from = from;
    this.to = to;
    this.id = `${from}:${to}`;
    this.localHandler = handler;
  }

  /**
   * Send a message through the channel
   */
  async send(type: MessageType, payload: unknown): Promise<AgentMessage> {
    const message: AgentMessage = {
      id: uuidv4(),
      sender: this.from,
      recipient: this.to,
      type,
      payload,
      timestamp: Date.now(),
      priority: 2,
      headers: { channel: this.id }
    };

    await this.ipc.send(this.to, message);
    return message;
  }

  /**
   * Close the channel
   */
  close(): void {
    this.ipc.closeConnection(this.from, this.to);
  }
}
