/**
 * HiveMind - Multi-Agent Operating System
 * Scheduler - Process/Agent Scheduling
 * 
 * Implements multiple scheduling algorithms:
 * - FIFO
 * - Round Robin
 * - Priority-based
 * - Multilevel Feedback Queue (MLFQ)
 * - Fair Share
 */

import { v4 as uuidv4 } from 'uuid';
import {
  AgentID,
  AgentPriority,
  SchedulingAlgorithm,
  ProcessSchedule,
  SchedulerState,
  SchedulerConfig
} from '../types';

interface ScheduledProcess {
  processId: AgentID;
  priority: AgentPriority;
  cpuBurst: number;
  ioBurst: number;
  remaining: number;
  waitTime: number;
  cpuTime: number;
  lastScheduled: number;
  age: number;
  queueLevel: number;
}

export class Scheduler {
  private algorithm: SchedulingAlgorithm;
  public readonly quantum: number;
  private priorityLevels: number;
  
  private queues: Map<number, ScheduledProcess[]> = new Map();
  private allProcesses: Map<AgentID, ScheduledProcess> = new Map();
  private currentProcess: AgentID | null = null;
  private lastSchedule: number = 0;
  private tickCount: number = 0;
  private totalCpuTime: Map<AgentID, number> = new Map();

  constructor(config: SchedulerConfig) {
    this.algorithm = config.algorithm;
    this.quantum = config.quantum;
    this.priorityLevels = config.priorityLevels;

    // Initialize priority queues
    for (let i = 0; i < this.priorityLevels; i++) {
      this.queues.set(i, []);
    }
  }

  /**
   * Register a process with the scheduler
   */
  register(processId: AgentID, priority: AgentPriority = AgentPriority.NORMAL): void {
    const process: ScheduledProcess = {
      processId,
      priority,
      cpuBurst: 0,
      ioBurst: 0,
      remaining: 0,
      waitTime: 0,
      cpuTime: 0,
      lastScheduled: 0,
      age: 0,
      queueLevel: this.priorityToQueueLevel(priority)
    };

    this.allProcesses.set(processId, process);
    this.addToQueue(process);
    this.totalCpuTime.set(processId, 0);
  }

  /**
   * Unregister a process from the scheduler
   */
  unregister(processId: AgentID): void {
    const process = this.allProcesses.get(processId);
    if (process) {
      this.removeFromQueue(process);
      this.allProcesses.delete(processId);
      this.totalCpuTime.delete(processId);
      if (this.currentProcess === processId) {
        this.currentProcess = null;
      }
    }
  }

  /**
   * Update process priority
   */
  updatePriority(processId: AgentID, newPriority: AgentPriority): void {
    const process = this.allProcesses.get(processId);
    if (process && process.priority !== newPriority) {
      this.removeFromQueue(process);
      process.priority = newPriority;
      process.queueLevel = this.priorityToQueueLevel(newPriority);
      this.addToQueue(process);
    }
  }

  /**
   * Update process CPU burst estimate
   */
  updateCpuBurst(processId: AgentID, burst: number): void {
    const process = this.allProcesses.get(processId);
    if (process) {
      process.cpuBurst = burst;
      process.remaining = burst;
    }
  }

  /**
   * Record CPU time used by a process
   */
  recordCpuTime(processId: AgentID, time: number): void {
    const process = this.allProcesses.get(processId);
    if (process) {
      process.cpuTime += time;
      const total = this.totalCpuTime.get(processId) || 0;
      this.totalCpuTime.set(processId, total + time);
    }
  }

  /**
   * Schedule the next process to run
   */
  schedule(): ProcessSchedule[] {
    this.tickCount++;
    this.lastSchedule = Date.now();

    // Update wait times for all waiting processes
    for (const process of this.allProcesses.values()) {
      if (process.processId !== this.currentProcess) {
        process.waitTime++;
        process.age++;
      }
    }

    let selectedProcess: ScheduledProcess | null = null;

    switch (this.algorithm) {
      case SchedulingAlgorithm.FIFO:
        selectedProcess = this.scheduleFIFO();
        break;
      case SchedulingAlgorithm.ROUND_ROBIN:
        selectedProcess = this.scheduleRoundRobin();
        break;
      case SchedulingAlgorithm.PRIORITY:
        selectedProcess = this.schedulePriority();
        break;
      case SchedulingAlgorithm.MULTILEVEL_FEEDBACK_QUEUE:
        selectedProcess = this.scheduleMLFQ();
        break;
      case SchedulingAlgorithm.FAIR_SHARE:
        selectedProcess = this.scheduleFairShare();
        break;
    }

    if (selectedProcess) {
      this.currentProcess = selectedProcess.processId;
      selectedProcess.lastScheduled = this.tickCount;
      selectedProcess.age = 0;

      return [{
        processId: selectedProcess.processId,
        priority: selectedProcess.priority,
        cpuBurst: selectedProcess.cpuBurst,
        ioBurst: selectedProcess.ioBurst,
        remaining: selectedProcess.remaining
      }];
    }

    return [];
  }

  /**
   * FIFO scheduling - first in, first out
   */
  private scheduleFIFO(): ScheduledProcess | null {
    // Find the oldest process in any queue
    let oldest: ScheduledProcess | null = null;
    let oldestTime = Infinity;

    for (const queue of this.queues.values()) {
      if (queue.length > 0) {
        const process = queue[0];
        if (process.lastScheduled < oldestTime) {
          oldestTime = process.lastScheduled;
          oldest = process;
        }
      }
    }

    if (oldest) {
      this.removeFromQueue(oldest);
      return oldest;
    }

    return null;
  }

  /**
   * Round Robin scheduling
   */
  private scheduleRoundRobin(): ScheduledProcess | null {
    // Start from current position and find next process
    let foundCurrent = false;
    
    for (const queue of this.queues.values()) {
      for (let i = 0; i < queue.length; i++) {
        const process = queue[i];
        if (foundCurrent) {
          this.removeFromQueue(process);
          queue.push(process); // Move to end
          return process;
        }
        if (process.processId === this.currentProcess) {
          foundCurrent = true;
        }
      }
    }

    // If no current process, return first in highest priority queue
    return this.schedulePriority();
  }

  /**
   * Priority-based scheduling
   */
  private schedulePriority(): ScheduledProcess | null {
    // Higher priority = lower number = higher queue level
    for (let level = this.priorityLevels - 1; level >= 0; level--) {
      const queue = this.queues.get(level);
      if (queue && queue.length > 0) {
        // Find highest priority (oldest in queue at that level)
        const process = queue.shift()!;
        return process;
      }
    }
    return null;
  }

  /**
   * Multilevel Feedback Queue scheduling
   */
  private scheduleMLFQ(): ScheduledProcess | null {
    // 1. First, age processes - move down queues if waiting too long
    this.ageProcesses();

    // 2. Check for I/O bound processes (boost priority)
    for (const process of this.allProcesses.values()) {
      if (process.ioBurst > process.cpuBurst * 0.5) {
        this.promoteProcess(process);
      }
    }

    // 3. Run from highest non-empty queue
    for (let level = this.priorityLevels - 1; level >= 0; level--) {
      const queue = this.queues.get(level);
      if (queue && queue.length > 0) {
        const process = queue.shift()!;
        
        // If process used full quantum, demote it
        if (process.remaining > 0 && this.quantum > 0) {
          this.demoteProcess(process);
        }
        
        return process;
      }
    }

    return null;
  }

  /**
   * Fair Share scheduling
   */
  private scheduleFairShare(): ScheduledProcess | null {
    // Calculate share for each process
    const totalShare = 100; // percentage
    const perProcessShare = totalShare / Math.max(1, this.allProcesses.size);

    let lowestUsage: ScheduledProcess | null = null;
    let lowestRatio = Infinity;

    for (const process of this.allProcesses.values()) {
      const cpuTime = this.totalCpuTime.get(process.processId) || 0;
      const expectedShare = process.cpuTime / Math.max(1, this.tickCount);
      const ratio = expectedShare / perProcessShare;

      if (ratio < lowestRatio) {
        lowestRatio = ratio;
        lowestUsage = process;
      }
    }

    if (lowestUsage) {
      this.removeFromQueue(lowestUsage);
      return lowestUsage;
    }

    return this.schedulePriority();
  }

  /**
   * Age processes in queues
   */
  private ageProcesses(): void {
    for (const process of this.allProcesses.values()) {
      if (process.age > 100 && process.queueLevel > 0) {
        // Move to higher priority queue
        this.removeFromQueue(process);
        process.queueLevel--;
        this.addToQueue(process);
        process.age = 0;
      }
    }
  }

  /**
   * Promote a process (increase priority)
   */
  private promoteProcess(process: ScheduledProcess): void {
    if (process.queueLevel < this.priorityLevels - 1) {
      this.removeFromQueue(process);
      process.queueLevel++;
      this.addToQueue(process);
    }
  }

  /**
   * Demote a process (decrease priority)
   */
  private demoteProcess(process: ScheduledProcess): void {
    if (process.queueLevel > 0) {
      this.removeFromQueue(process);
      process.queueLevel--;
      this.addToQueue(process);
    }
  }

  /**
   * Add process to appropriate queue
   */
  private addToQueue(process: ScheduledProcess): void {
    const queue = this.queues.get(process.queueLevel);
    if (queue) {
      queue.push(process);
    }
  }

  /**
   * Remove process from all queues
   */
  private removeFromQueue(process: ScheduledProcess): void {
    for (const queue of this.queues.values()) {
      const index = queue.findIndex(p => p.processId === process.processId);
      if (index > -1) {
        queue.splice(index, 1);
        return;
      }
    }
  }

  /**
   * Convert priority to queue level
   */
  private priorityToQueueLevel(priority: AgentPriority): number {
    // CRITICAL (0) = highest queue (4), IDLE (4) = lowest queue (0)
    return this.priorityLevels - 1 - priority;
  }

  /**
   * Get scheduler state
   */
  getState(): SchedulerState {
    return {
      algorithm: this.algorithm,
      quantum: this.quantum,
      queue: Array.from(this.allProcesses.values()).map(p => ({
        processId: p.processId,
        priority: p.priority,
        cpuBurst: p.cpuBurst,
        ioBurst: p.ioBurst,
        remaining: p.remaining
      })),
      lastSchedule: this.lastSchedule
    };
  }

  /**
   * Get queue status
   */
  getQueueStatus(): Record<number, number> {
    const status: Record<number, number> = {};
    for (const [level, queue] of this.queues) {
      status[level] = queue.length;
    }
    return status;
  }

  /**
   * Set scheduling algorithm
   */
  setAlgorithm(algorithm: SchedulingAlgorithm): void {
    this.algorithm = algorithm;
    
    // Migrate all processes to new scheduling scheme
    const processes = Array.from(this.allProcesses.values());
    for (const process of processes) {
      this.removeFromQueue(process);
      process.queueLevel = this.priorityToQueueLevel(process.priority);
      this.addToQueue(process);
    }
  }

  /**
   * Yield CPU (process voluntarily gives up time slice)
   */
  yield(processId: AgentID): void {
    if (this.currentProcess === processId) {
      this.currentProcess = null;
    }
  }

  /**
   * Block process (waiting for I/O)
   */
  block(processId: AgentID): void {
    const process = this.allProcesses.get(processId);
    if (process) {
      process.ioBurst++;
      if (this.currentProcess === processId) {
        this.currentProcess = null;
      }
    }
  }
}
