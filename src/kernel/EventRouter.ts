/**
 * HiveMind - Multi-Agent Operating System
 * Event Router - Event Stream Management (pi-mono compatible)
 * 
 * Manages event streams, subscriptions, and event routing
 * between agents in the HiveMind OS.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  AgentID,
  EventStreamID,
  Event,
  EventStream,
  EventSubscription,
  EventFilter,
  SystemEventType
} from '../types';

export class EventRouter extends EventEmitter {
  private streams: Map<EventStreamID, EventStream> = new Map();
  private subscriptions: Map<string, EventSubscription> = new Map();
  private pipeConnections: Map<EventStreamID, Set<EventStreamID>> = new Map();
  private eventQueue: Event[] = [];
  public eventsProcessed: number = 0;
  private maxQueueSize: number = 10000;

  constructor(kernel: unknown) {
    super();
  }

  /**
   * Create a new event stream
   */
  createStream(name: string, publisher?: AgentID, maxSize?: number, ttl?: number): EventStream {
    const stream: EventStream = {
      id: uuidv4(),
      name,
      publisher: publisher || 'system',
      subscribers: new Map(),
      events: [],
      maxSize: maxSize || 1000,
      ttl: ttl || 3600000 // 1 hour default
    };

    this.streams.set(stream.id, stream);
    this.pipeConnections.set(stream.id, new Set());

    this.emit('stream:created', stream);

    return stream;
  }

  /**
   * Delete an event stream
   */
  deleteStream(streamId: EventStreamID): boolean {
    const stream = this.streams.get(streamId);
    if (!stream) return false;

    // Remove all subscriptions
    for (const [subId, sub] of this.subscriptions) {
      if (sub.stream === streamId) {
        this.subscriptions.delete(subId);
      }
    }

    // Remove pipe connections
    this.pipeConnections.delete(streamId);
    for (const pipes of this.pipeConnections.values()) {
      pipes.delete(streamId);
    }

    this.streams.delete(streamId);
    this.emit('stream:deleted', streamId);

    return true;
  }

  /**
   * Publish an event to a stream
   */
  async publish(streamId: EventStreamID, event: Omit<Event, 'id' | 'timestamp'>): Promise<Event> {
    const stream = this.streams.get(streamId);
    if (!stream) {
      throw new Error(`Stream ${streamId} not found`);
    }

    const fullEvent: Event = {
      ...event,
      id: uuidv4(),
      timestamp: Date.now()
    };

    // Add to stream history
    stream.events.push(fullEvent);

    // Trim if exceeds max size
    while (stream.events.length > stream.maxSize) {
      stream.events.shift();
    }

    // Deliver to subscribers
    await this.deliverEvent(fullEvent, stream);

    // Deliver to piped streams
    await this.deliverToPipes(fullEvent, streamId);

    this.eventsProcessed++;
    this.emit('event:published', fullEvent);

    return fullEvent;
  }

  /**
   * Subscribe to an event stream
   */
  subscribe(
    streamIdOrName: string,
    callback: (event: Event) => void | Promise<void>,
    subscriber?: AgentID,
    filter?: EventFilter
  ): string {
    // Find stream by ID or name
    let stream = this.streams.get(streamIdOrName);
    if (!stream) {
      stream = Array.from(this.streams.values()).find(s => s.name === streamIdOrName);
    }
    if (!stream) {
      throw new Error(`Stream ${streamIdOrName} not found`);
    }

    const subscriptionId = uuidv4();
    const subscription: EventSubscription = {
      id: subscriptionId,
      subscriber: subscriber || 'anonymous',
      stream: stream.id,
      filter,
      callback,
      createdAt: Date.now()
    };

    this.subscriptions.set(subscriptionId, subscription);
    stream.subscribers.set(subscriptionId, subscription);

    this.emit('subscription:created', subscription);

    return subscriptionId;
  }

  /**
   * Unsubscribe from an event stream
   */
  unsubscribe(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return false;

    const stream = this.streams.get(subscription.stream);
    if (stream) {
      stream.subscribers.delete(subscriptionId);
    }

    this.subscriptions.delete(subscriptionId);
    this.emit('subscription:removed', subscriptionId);

    return true;
  }

  /**
   * Subscribe to multiple streams matching a pattern
   */
  subscribePattern(
    pattern: RegExp,
    callback: (event: Event) => void | Promise<void>,
    subscriber?: AgentID
  ): string[] {
    const subscriptionIds: string[] = [];

    for (const stream of this.streams.values()) {
      if (pattern.test(stream.name)) {
        const id = this.subscribe(stream.id, callback, subscriber);
        subscriptionIds.push(id);
      }
    }

    return subscriptionIds;
  }

  /**
   * Create a pipe between two streams
   */
  pipe(fromStreamId: EventStreamID, toStreamId: EventStreamID): void {
    const fromStream = this.streams.get(fromStreamId);
    const toStream = this.streams.get(toStreamId);

    if (!fromStream || !toStream) {
      throw new Error('One or both streams not found');
    }

    const pipes = this.pipeConnections.get(fromStreamId);
    if (pipes) {
      pipes.add(toStreamId);
    }

    this.emit('stream:piped', { from: fromStreamId, to: toStreamId });
  }

  /**
   * Remove a pipe between streams
   */
  unpipe(fromStreamId: EventStreamID, toStreamId: EventStreamID): void {
    const pipes = this.pipeConnections.get(fromStreamId);
    if (pipes) {
      pipes.delete(toStreamId);
    }

    this.emit('stream:unpiped', { from: fromStreamId, to: toStreamId });
  }

  /**
   * Get events from a stream
   */
  getEvents(streamId: EventStreamID, limit?: number, offset?: number): Event[] {
    const stream = this.streams.get(streamId);
    if (!stream) return [];

    const events = stream.events;
    const start = offset || 0;
    const end = limit ? start + limit : events.length;

    return events.slice(start, end);
  }

  /**
   * Get stream info
   */
  getStream(streamId: EventStreamID): EventStream | undefined {
    return this.streams.get(streamId);
  }

  /**
   * Get all streams
   */
  getAllStreams(): EventStream[] {
    return Array.from(this.streams.values());
  }

  /**
   * Get subscription info
   */
  getSubscription(subscriptionId: string): EventSubscription | undefined {
    return this.subscriptions.get(subscriptionId);
  }

  /**
   * Get all subscriptions for a subscriber
   */
  getSubscriptionsForSubscriber(subscriberId: AgentID): EventSubscription[] {
    return Array.from(this.subscriptions.values()).filter(
      sub => sub.subscriber === subscriberId
    );
  }

  /**
   * Process queued events
   */
  async processQueue(): Promise<void> {
    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift();
      if (event) {
        const stream = this.streams.get(event.stream);
        if (stream) {
          await this.deliverEvent(event, stream);
        }
      }
    }
  }

  /**
   * Deliver event to all matching subscribers
   */
  private async deliverEvent(event: Event, stream: EventStream): Promise<void> {
    const now = Date.now();

    for (const subscription of stream.subscribers.values()) {
      // Check if subscription has expired
      if (stream.ttl > 0 && now - subscription.createdAt > stream.ttl) {
        this.unsubscribe(subscription.id);
        continue;
      }

      // Apply filter if present
      if (subscription.filter && !this.matchesFilter(event, subscription.filter)) {
        continue;
      }

      try {
        await subscription.callback(event);
      } catch (error) {
        console.error(`Error in event callback for ${subscription.id}:`, error);
      }
    }

    this.emit('event:delivered', { event, subscriberCount: stream.subscribers.size });
  }

  /**
   * Deliver event to piped streams
   */
  private async deliverToPipes(event: Event, fromStreamId: EventStreamID): Promise<void> {
    const pipes = this.pipeConnections.get(fromStreamId);
    if (!pipes) return;

    for (const toStreamId of pipes) {
      const toStream = this.streams.get(toStreamId);
      if (toStream) {
        // Create new event for the destination stream
        const pipedEvent: Event = {
          ...event,
          id: uuidv4(),
          stream: toStreamId
        };

        await this.deliverEvent(pipedEvent, toStream);
      }
    }
  }

  /**
   * Check if event matches a filter
   */
  private matchesFilter(event: Event, filter: EventFilter): boolean {
    if (filter.type) {
      const types = Array.isArray(filter.type) ? filter.type : [filter.type];
      if (!types.includes(event.type)) {
        return false;
      }
    }

    if (filter.source) {
      if (event.source !== filter.source) {
        return false;
      }
    }

    if (filter.predicate) {
      if (!filter.predicate(event)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Queue an event for processing
   */
  enqueue(event: Event): void {
    if (this.eventQueue.length < this.maxQueueSize) {
      this.eventQueue.push(event);
    } else {
      console.warn('Event queue full, dropping event');
    }
  }

  /**
   * Clear all events from a stream
   */
  clearStream(streamId: EventStreamID): void {
    const stream = this.streams.get(streamId);
    if (stream) {
      stream.events = [];
    }
  }

  /**
   * Get stream statistics
   */
  getStats(): {
    streamCount: number;
    subscriptionCount: number;
    eventCount: number;
    pipeCount: number;
    queueSize: number;
  } {
    let eventCount = 0;
    for (const stream of this.streams.values()) {
      eventCount += stream.events.length;
    }

    let pipeCount = 0;
    for (const pipes of this.pipeConnections.values()) {
      pipeCount += pipes.size;
    }

    return {
      streamCount: this.streams.size,
      subscriptionCount: this.subscriptions.size,
      eventCount,
      pipeCount,
      queueSize: this.eventQueue.length
    };
  }
}
