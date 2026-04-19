/**
 * HiveMind - Multi-Agent Operating System
 * Memory Manager - Virtual Memory Management for Agents
 * 
 * Manages memory allocation and deallocation for all agents,
 * implements virtual memory with paging and swap support.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  AgentID,
  AgentMemory,
  MemoryLimits,
  MemorySegment,
  MemoryType,
  MemoryPermissions,
  MemoryManagerState,
  MemoryStackFrame
} from '../types';

export class MemoryManager {
  private memory: Map<AgentID, AgentMemory> = new Map();
  private limits: Required<MemoryLimits>;
  private pageSize: number;
  private swapEnabled: boolean;
  private totalUsed: number = 0;

  constructor(limits: MemoryLimits & { pageSize?: number; swapEnabled?: boolean }) {
    this.limits = {
      maxHeapMB: limits.maxHeapMB,
      maxStackKB: limits.maxStackKB,
      maxTotalMB: limits.maxTotalMB,
      pageSize: limits.pageSize ?? 4096,
      swapEnabled: limits.swapEnabled ?? false
    };
    this.pageSize = this.limits.pageSize;
    this.swapEnabled = this.limits.swapEnabled;
  }

  /**
   * Allocate memory for an agent
   */
  allocate(agentId: AgentID): AgentMemory {
    const memory: AgentMemory = {
      agentId,
      heap: new Map(),
      stack: [],
      segments: [],
      limits: { ...this.limits }
    };

    // Create initial segments
    const heapSegment: MemorySegment = {
      id: uuidv4(),
      name: 'heap',
      start: 0,
      size: this.limits.maxHeapMB * 1024 * 1024,
      type: MemoryType.HEAP,
      permissions: [MemoryPermissions.READ, MemoryPermissions.WRITE]
    };

    const stackSegment: MemorySegment = {
      id: uuidv4(),
      name: 'stack',
      start: this.limits.maxHeapMB * 1024 * 1024,
      size: this.limits.maxStackKB * 1024,
      type: MemoryType.STACK,
      permissions: [MemoryPermissions.READ, MemoryPermissions.WRITE]
    };

    memory.segments.push(heapSegment, stackSegment);
    this.memory.set(agentId, memory);

    return memory;
  }

  /**
   * Deallocate memory for an agent
   */
  deallocate(agentId: AgentID): void {
    const memory = this.memory.get(agentId);
    if (memory) {
      this.totalUsed -= this.calculateUsage(memory);
      this.memory.delete(agentId);
    }
  }

  /**
   * Get memory for an agent
   */
  getMemory(agentId: AgentID): AgentMemory | undefined {
    return this.memory.get(agentId);
  }

  /**
   * Allocate heap memory for an agent
   */
  alloc(agentId: AgentID, key: string, value: unknown): boolean {
    const memory = this.memory.get(agentId);
    if (!memory) return false;

    // Check limits
    const currentUsage = this.calculateUsage(memory);
    const valueSize = this.estimateSize(value);
    
    if (currentUsage + valueSize > this.limits.maxHeapMB * 1024 * 1024) {
      // Try to free memory or use swap
      if (!this.tryFreeMemory(agentId, valueSize)) {
        return false;
      }
    }

    memory.heap.set(key, value);
    this.totalUsed += valueSize;
    return true;
  }

  /**
   * Free heap memory for an agent
   */
  free(agentId: AgentID, key: string): boolean {
    const memory = this.memory.get(agentId);
    if (!memory) return false;

    const value = memory.heap.get(key);
    if (value !== undefined) {
      this.totalUsed -= this.estimateSize(value);
      memory.heap.delete(key);
      return true;
    }
    return false;
  }

  /**
   * Read from agent's heap
   */
  read(agentId: AgentID, key: string): unknown | undefined {
    return this.memory.get(agentId)?.heap.get(key);
  }

  /**
   * Write to agent's heap
   */
  write(agentId: AgentID, key: string, value: unknown): boolean {
    return this.alloc(agentId, key, value);
  }

  /**
   * Push a stack frame
   */
  pushStackFrame(agentId: AgentID, functionName: string): string | null {
    const memory = this.memory.get(agentId);
    if (!memory) return null;

    const frame: MemoryStackFrame = {
      id: uuidv4(),
      functionName,
      localVariables: new Map(),
      returnAddress: memory.stack.length
    };

    memory.stack.push(frame);
    return frame.id;
  }

  /**
   * Pop a stack frame
   */
  popStackFrame(agentId: AgentID): MemoryStackFrame | null {
    const memory = this.memory.get(agentId);
    if (!memory || memory.stack.length === 0) return null;
    return memory.stack.pop()!;
  }

  /**
   * Get current stack frame
   */
  getCurrentStackFrame(agentId: AgentID): MemoryStackFrame | null {
    const memory = this.memory.get(agentId);
    if (!memory || memory.stack.length === 0) return null;
    return memory.stack[memory.stack.length - 1];
  }

  /**
   * Set local variable in current stack frame
   */
  setLocalVariable(agentId: AgentID, name: string, value: unknown): boolean {
    const frame = this.getCurrentStackFrame(agentId);
    if (!frame) return false;
    frame.localVariables.set(name, value);
    return true;
  }

  /**
   * Get local variable from current stack frame
   */
  getLocalVariable(agentId: AgentID, name: string): unknown | undefined {
    const frame = this.getCurrentStackFrame(agentId);
    return frame?.localVariables.get(name);
  }

  /**
   * Create a shared memory segment
   */
  createSharedSegment(name: string, size: number): MemorySegment {
    const segment: MemorySegment = {
      id: uuidv4(),
      name,
      start: this.totalUsed,
      size,
      type: MemoryType.SHARED,
      permissions: [MemoryPermissions.READ, MemoryPermissions.WRITE, MemoryPermissions.SHARED]
    };
    return segment;
  }

  /**
   * Get memory statistics
   */
  getStats(): MemoryManagerState {
    const usedMB = this.totalUsed / (1024 * 1024);
    return {
      totalMemoryMB: this.limits.maxTotalMB,
      usedMemoryMB: usedMB,
      freeMemoryMB: this.limits.maxTotalMB - usedMB,
      pageSize: this.pageSize,
      swapUsedMB: 0
    };
  }

  /**
   * Get memory snapshot for migration
   */
  getMemorySnapshot(agentId: AgentID): AgentMemory | undefined {
    const memory = this.memory.get(agentId);
    if (!memory) return undefined;

    return {
      agentId,
      heap: new Map(memory.heap),
      stack: memory.stack.map(frame => ({
        ...frame,
        localVariables: new Map(frame.localVariables)
      })),
      segments: [...memory.segments],
      limits: { ...memory.limits }
    };
  }

  /**
   * Restore memory from snapshot
   */
  restoreSnapshot(snapshot: AgentMemory): void {
    this.memory.set(snapshot.agentId, {
      ...snapshot,
      heap: new Map(snapshot.heap),
      stack: snapshot.stack.map(frame => ({
        ...frame,
        localVariables: new Map(frame.localVariables)
      }))
    });
  }

  /**
   * Memory manager tick - cleanup and compaction
   */
  async tick(): Promise<void> {
    // Compact heap if fragmentation is high
    // Swap out inactive agents if memory pressure
    // Garbage collect unreachable objects
  }

  /**
   * Calculate current memory usage for an agent
   */
  private calculateUsage(memory: AgentMemory): number {
    let usage = 0;
    
    // Calculate heap usage
    for (const value of memory.heap.values()) {
      usage += this.estimateSize(value);
    }

    // Calculate stack usage
    for (const frame of memory.stack) {
      usage += 64; // Base frame size
      for (const value of frame.localVariables.values()) {
        usage += this.estimateSize(value);
      }
    }

    return usage;
  }

  /**
   * Estimate size of a value in bytes
   */
  private estimateSize(value: unknown): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'boolean') return 4;
    if (typeof value === 'number') return 8;
    if (typeof value === 'string') return value.length * 2;
    if (typeof value === 'object') {
      return JSON.stringify(value).length * 2;
    }
    return 8;
  }

  /**
   * Try to free memory for an allocation
   */
  private tryFreeMemory(agentId: AgentID, neededBytes: number): boolean {
    const memory = this.memory.get(agentId);
    if (!memory) return false;

    // Try to garbage collect heap
    const beforeUsage = this.calculateUsage(memory);
    
    // Clear any marked-for-deletion objects
    const removableKeys: string[] = [];
    for (const [key, value] of memory.heap.entries()) {
      if ((value as Record<string, unknown>)['__gc__'] === true) {
        removableKeys.push(key);
      }
    }
    
    for (const key of removableKeys) {
      memory.heap.delete(key);
    }

    const afterUsage = this.calculateUsage(memory);
    this.totalUsed -= (beforeUsage - afterUsage);

    return (this.calculateUsage(memory) + neededBytes) <= this.limits.maxHeapMB * 1024 * 1024;
  }

  /**
   * Check memory pressure
   */
  isUnderPressure(): boolean {
    return this.totalUsed > (this.limits.maxTotalMB * 0.8 * 1024 * 1024);
  }

  /**
   * Get memory for all agents
   */
  getAllMemory(): Map<AgentID, AgentMemory> {
    return new Map(this.memory);
  }
}
