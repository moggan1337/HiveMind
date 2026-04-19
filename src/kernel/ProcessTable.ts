/**
 * HiveMind - Multi-Agent Operating System
 * Process Table - Agent/Process Management
 * 
 * Maintains information about all running processes (agents)
 * in the HiveMind OS.
 */

import { ProcessAgent, ProcessID, AgentID, AgentState } from '../types';

export interface ProcessTableEntry {
  pid: ProcessID;
  agentId: AgentID;
  name: string;
  state: AgentState;
  parentPid?: ProcessID;
  children: ProcessID[];
  cpuTime: number;
  memoryUsage: number;
  startTime: number;
  exitCode?: number;
  exitTime?: number;
}

export class ProcessTable {
  private processes: Map<ProcessID, ProcessTableEntry> = new Map();
  private agentToPid: Map<AgentID, ProcessID> = new Map();
  private nextPid: ProcessID = 1 as ProcessID;
  private zombieCleanupInterval: NodeJS.Timeout | null = null;

  constructor(cleanupIntervalMs: number = 60000) {
    // Periodic cleanup of zombie processes
    this.zombieCleanupInterval = setInterval(() => {
      this.cleanupZombies();
    }, cleanupIntervalMs);
  }

  /**
   * Add a process to the table
   */
  add(process: ProcessAgent): ProcessID {
    const pid = (this.nextPid++) as ProcessID;
    
    const entry: ProcessTableEntry = {
      pid,
      agentId: process.id,
      name: process.name,
      state: process.state,
      parentPid: process.parent as unknown as ProcessID,
      children: [],
      cpuTime: 0,
      memoryUsage: 0,
      startTime: process.createdAt
    };

    this.processes.set(pid, entry);
    this.agentToPid.set(process.id, pid);

    // Update parent's children list
    if (process.parent) {
      const parentPid = this.agentToPid.get(process.parent);
      if (parentPid) {
        const parent = this.processes.get(parentPid);
        if (parent) {
          parent.children.push(pid);
        }
      }
    }

    return pid;
  }

  /**
   * Remove a process from the table
   */
  remove(agentIdOrPid: AgentID | ProcessID): boolean {
    let pid: ProcessID;
    
    if (typeof agentIdOrPid === 'string' && agentIdOrPid.length > 5) {
      // It's an AgentID
      pid = this.agentToPid.get(agentIdOrPid)!;
      if (!pid) return false;
    } else {
      // It's a ProcessID
      pid = agentIdOrPid;
    }

    const entry = this.processes.get(pid);
    if (!entry) return false;

    // Remove from parent's children list
    if (entry.parentPid) {
      const parent = this.processes.get(entry.parentPid);
      if (parent) {
        const index = parent.children.indexOf(pid);
        if (index > -1) {
          parent.children.splice(index, 1);
        }
      }
    }

    // Re-parent children to init (PID 1) or the current process
    for (const childPid of entry.children) {
      const child = this.processes.get(childPid);
      if (child) {
        child.parentPid = 1 as ProcessID; // Init process
      }
    }

    // Mark as zombie instead of immediately removing
    // This allows parent to reap exit status
    entry.state = AgentState.TERMINATED;
    entry.exitTime = Date.now();

    this.agentToPid.delete(entry.agentId);
    this.processes.delete(pid);

    return true;
  }

  /**
   * Get process by PID
   */
  get(pid: ProcessID): ProcessTableEntry | undefined {
    return this.processes.get(pid);
  }

  /**
   * Get process by Agent ID
   */
  getByAgentId(agentId: AgentID): ProcessTableEntry | undefined {
    const pid = this.agentToPid.get(agentId);
    if (pid) {
      return this.processes.get(pid);
    }
    return undefined;
  }

  /**
   * Update process state
   */
  updateState(pid: ProcessID, state: AgentState): boolean {
    const entry = this.processes.get(pid);
    if (!entry) return false;
    entry.state = state;
    return true;
  }

  /**
   * Update process resource usage
   */
  updateResources(pid: ProcessID, cpuTime?: number, memoryUsage?: number): boolean {
    const entry = this.processes.get(pid);
    if (!entry) return false;

    if (cpuTime !== undefined) {
      entry.cpuTime = cpuTime;
    }
    if (memoryUsage !== undefined) {
      entry.memoryUsage = memoryUsage;
    }

    return true;
  }

  /**
   * Set process exit code
   */
  setExitCode(pid: ProcessID, exitCode: number): boolean {
    const entry = this.processes.get(pid);
    if (!entry) return false;

    entry.exitCode = exitCode;
    entry.state = AgentState.TERMINATED;
    entry.exitTime = Date.now();

    return true;
  }

  /**
   * Get all processes
   */
  getAll(): ProcessTableEntry[] {
    return Array.from(this.processes.values());
  }

  /**
   * Get processes by state
   */
  getByState(state: AgentState): ProcessTableEntry[] {
    return Array.from(this.processes.values()).filter(p => p.state === state);
  }

  /**
   * Get children of a process
   */
  getChildren(pid: ProcessID): ProcessTableEntry[] {
    const entry = this.processes.get(pid);
    if (!entry) return [];

    return entry.children
      .map(childPid => this.processes.get(childPid))
      .filter((p): p is ProcessTableEntry => p !== undefined);
  }

  /**
   * Get parent of a process
   */
  getParent(pid: ProcessID): ProcessTableEntry | undefined {
    const entry = this.processes.get(pid);
    if (!entry || !entry.parentPid) return undefined;
    return this.processes.get(entry.parentPid);
  }

  /**
   * Check if process is zombie
   */
  isZombie(pid: ProcessID): boolean {
    const entry = this.processes.get(pid);
    return entry?.state === AgentState.TERMINATED && entry.exitTime !== undefined;
  }

  /**
   * Get zombie processes waiting to be reaped
   */
  getZombies(): ProcessTableEntry[] {
    return Array.from(this.processes.values()).filter(p => 
      p.state === AgentState.TERMINATED && p.exitTime !== undefined
    );
  }

  /**
   * Reap a zombie process (parent collects exit status)
   */
  reap(pid: ProcessID): { exitCode?: number; exitTime?: number } | null {
    const entry = this.processes.get(pid);
    if (!entry || entry.state !== AgentState.TERMINATED) {
      return null;
    }

    const result = {
      exitCode: entry.exitCode,
      exitTime: entry.exitTime
    };

    // Actually remove from table
    this.processes.delete(pid);

    return result;
  }

  /**
   * Cleanup zombie processes older than threshold
   */
  cleanupZombies(maxAgeMs: number = 300000): void {
    const now = Date.now();
    const toRemove: ProcessID[] = [];

    for (const [pid, entry] of this.processes) {
      if (entry.state === AgentState.TERMINATED && entry.exitTime) {
        if (now - entry.exitTime > maxAgeMs) {
          toRemove.push(pid);
        }
      }
    }

    for (const pid of toRemove) {
      this.processes.delete(pid);
    }

    if (toRemove.length > 0) {
      console.log(`[ProcessTable] Cleaned up ${toRemove.length} zombie processes`);
    }
  }

  /**
   * Get process count by state
   */
  getCountByState(): Record<AgentState, number> {
    const counts: Record<AgentState, number> = {
      [AgentState.CREATED]: 0,
      [AgentState.INITIALIZING]: 0,
      [AgentState.RUNNING]: 0,
      [AgentState.WAITING]: 0,
      [AgentState.SUSPENDED]: 0,
      [AgentState.MIGRATING]: 0,
      [AgentState.TERMINATED]: 0,
      [AgentState.FAILED]: 0
    };

    for (const entry of this.processes.values()) {
      counts[entry.state]++;
    }

    return counts;
  }

  /**
   * Get total resource usage
   */
  getTotalResources(): { totalCpuTime: number; totalMemory: number; processCount: number } {
    let totalCpuTime = 0;
    let totalMemory = 0;

    for (const entry of this.processes.values()) {
      totalCpuTime += entry.cpuTime;
      totalMemory += entry.memoryUsage;
    }

    return {
      totalCpuTime,
      totalMemory,
      processCount: this.processes.size
    };
  }

  /**
   * Find processes by name pattern
   */
  findByName(pattern: RegExp): ProcessTableEntry[] {
    return Array.from(this.processes.values()).filter(p => 
      pattern.test(p.name)
    );
  }

  /**
   * Destroy the process table
   */
  destroy(): void {
    if (this.zombieCleanupInterval) {
      clearInterval(this.zombieCleanupInterval);
      this.zombieCleanupInterval = null;
    }
    this.processes.clear();
    this.agentToPid.clear();
  }
}
