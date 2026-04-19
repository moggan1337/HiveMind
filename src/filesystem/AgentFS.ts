/**
 * HiveMind - Multi-Agent Operating System
 * Agent FS - Mount Points as Agent Endpoints
 * 
 * Provides a filesystem-like interface where mount points
 * are agent endpoints that can receive messages and events.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  BaseAgent,
  AgentType,
  AgentID,
  MountPointID,
  MessageType,
  AgentMessage,
  MountOptions,
  FileStats,
  AgentPriority
} from '../types';
import { DirectoryAgentImpl } from './FilesystemAgent';

interface MountPoint {
  id: MountPointID;
  path: string;
  agentEndpoint: string;
  target: BaseAgent;
  options: MountOptions;
  mountedAt: number;
}

interface PathResolution {
  mountPoint: MountPoint;
  remainingPath: string;
  targetAgent: BaseAgent;
}

/**
 * AgentFS - Virtual filesystem where mount points are agent endpoints
 */
export class AgentFS {
  private mountPoints: Map<string, MountPoint> = new Map();
  private rootAgent: DirectoryAgentImpl;
  private agentRegistry: Map<AgentID, BaseAgent> = new Map();

  constructor() {
    // Create root directory agent
    this.rootAgent = new DirectoryAgentImpl('/');
    this.agentRegistry.set(this.rootAgent.id, this.rootAgent);
  }

  /**
   * Mount an agent at a path
   */
  async mount(
    path: string,
    target: BaseAgent,
    options: MountOptions = {}
  ): Promise<MountPoint> {
    // Normalize path
    const normalizedPath = this.normalizePath(path);

    if (this.mountPoints.has(normalizedPath)) {
      throw new Error(`Path ${normalizedPath} already mounted`);
    }

    const mountPoint: MountPoint = {
      id: uuidv4(),
      path: normalizedPath,
      agentEndpoint: target.id,
      target,
      options,
      mountedAt: Date.now()
    };

    this.mountPoints.set(normalizedPath, mountPoint);
    this.agentRegistry.set(target.id, target);

    // Create mount point agent
    const mountAgent = new MountPointAgent(normalizedPath, target);
    this.agentRegistry.set(mountAgent.id, mountAgent);

    // Publish mount event
    await this.publishMountEvent('mounted', mountPoint);

    return mountPoint;
  }

  /**
   * Unmount a path
   */
  async unmount(path: string): Promise<void> {
    const normalizedPath = this.normalizePath(path);
    const mountPoint = this.mountPoints.get(normalizedPath);

    if (!mountPoint) {
      throw new Error(`Path ${normalizedPath} not mounted`);
    }

    this.mountPoints.delete(normalizedPath);
    
    // Don't remove from agentRegistry as the target agent should persist

    await this.publishMountEvent('unmounted', mountPoint);
  }

  /**
   * Resolve a path to a mount point and target agent
   */
  resolvePath(path: string): PathResolution | null {
    const normalizedPath = this.normalizePath(path);

    // Exact match
    const exact = this.mountPoints.get(normalizedPath);
    if (exact) {
      return {
        mountPoint: exact,
        remainingPath: '',
        targetAgent: exact.target
      };
    }

    // Find longest matching prefix
    let longestMatch: MountPoint | null = null;
    let longestMatchPath = '';

    for (const [mountPath, mountPoint] of this.mountPoints) {
      if (normalizedPath.startsWith(mountPath + '/') && mountPath.length > longestMatchPath.length) {
        longestMatch = mountPoint;
        longestMatchPath = mountPath;
      }
    }

    if (longestMatch) {
      return {
        mountPoint: longestMatch,
        remainingPath: normalizedPath.slice(longestMatchPath.length + 1),
        targetAgent: longestMatch.target
      };
    }

    // Fall back to root directory agent
    return {
      mountPoint: {
        id: 'root',
        path: '/',
        agentEndpoint: this.rootAgent.id,
        target: this.rootAgent,
        options: {},
        mountedAt: 0
      },
      remainingPath: normalizedPath.slice(1),
      targetAgent: this.rootAgent
    };
  }

  /**
   * Send a message to the agent at a path
   */
  async sendToPath(path: string, message: Omit<AgentMessage, 'sender' | 'recipient'>): Promise<AgentMessage> {
    const resolution = this.resolvePath(path);
    
    if (!resolution) {
      throw new Error(`Cannot resolve path: ${path}`);
    }

    const fullMessage: AgentMessage = {
      ...message,
      sender: 'filesystem',
      recipient: resolution.targetAgent.id
    } as AgentMessage;

    await resolution.targetAgent.handleMessage(fullMessage);

    return fullMessage;
  }

  /**
   * Read from a path
   */
  async read(path: string, options?: { offset?: number; length?: number }): Promise<unknown> {
    const resolution = this.resolvePath(path);
    
    if (!resolution) {
      throw new Error(`Cannot resolve path: ${path}`);
    }

    // Forward to target agent
    const response = await this.sendToPath(path, {
      id: uuidv4(),
      type: MessageType.READ,
      payload: { path: resolution.remainingPath, ...options },
      timestamp: Date.now(),
      priority: AgentPriority.NORMAL,
      headers: {}
    });

    return response.payload;
  }

  /**
   * Write to a path
   */
  async write(path: string, data: unknown): Promise<void> {
    await this.sendToPath(path, {
      id: uuidv4(),
      type: MessageType.WRITE,
      payload: { path: this.resolvePath(path)?.remainingPath, data },
      timestamp: Date.now(),
      priority: AgentPriority.NORMAL,
      headers: {}
    });
  }

  /**
   * List directory contents
   */
  async list(path: string): Promise<string[]> {
    await this.sendToPath(path, {
      id: uuidv4(),
      type: MessageType.LIST,
      payload: { path: this.resolvePath(path)?.remainingPath },
      timestamp: Date.now(),
      priority: AgentPriority.NORMAL,
      headers: {}
    });

    // Return mounted paths at this level
    const mounts: string[] = [];
    for (const [mountPath] of this.mountPoints) {
      if (mountPath.startsWith(path === '/' ? '/' : path + '/')) {
        const relative = mountPath.slice((path === '/' ? '' : path + '/').length);
        const firstPart = relative.split('/')[0];
        if (firstPart && !mounts.includes(firstPart)) {
          mounts.push(firstPart);
        }
      }
    }

    return mounts;
  }

  /**
   * Stat a path
   */
  async stat(path: string): Promise<FileStats | null> {
    const resolution = this.resolvePath(path);
    
    if (!resolution) {
      return null;
    }

    const response = await this.sendToPath(path, {
      id: uuidv4(),
      type: MessageType.STAT,
      payload: { path: resolution.remainingPath },
      timestamp: Date.now(),
      priority: AgentPriority.NORMAL,
      headers: {}
    });

    return (response.payload as { stats: FileStats }).stats;
  }

  /**
   * Create a file or directory
   */
  async create(type: 'file' | 'directory', path: string, content?: string): Promise<void> {
    await this.sendToPath(path, {
      id: uuidv4(),
      type: MessageType.WRITE,
      payload: { type, path: this.resolvePath(path)?.remainingPath, content },
      timestamp: Date.now(),
      priority: AgentPriority.NORMAL,
      headers: {}
    });
  }

  /**
   * Delete a file or directory
   */
  async delete(path: string, recursive: boolean = false): Promise<void> {
    await this.sendToPath(path, {
      id: uuidv4(),
      type: MessageType.DELETE,
      payload: { path: this.resolvePath(path)?.remainingPath, recursive },
      timestamp: Date.now(),
      priority: AgentPriority.NORMAL,
      headers: {}
    });
  }

  /**
   * Get all mount points
   */
  getMountPoints(): MountPoint[] {
    return Array.from(this.mountPoints.values());
  }

  /**
   * Get mount point at a specific path
   */
  getMountPoint(path: string): MountPoint | undefined {
    return this.mountPoints.get(this.normalizePath(path));
  }

  /**
   * Check if a path is mounted
   */
  isMounted(path: string): boolean {
    return this.mountPoints.has(this.normalizePath(path));
  }

  /**
   * Get agent at a path
   */
  getAgentAtPath(path: string): BaseAgent | null {
    const resolution = this.resolvePath(path);
    return resolution?.targetAgent || null;
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: AgentID): BaseAgent | undefined {
    return this.agentRegistry.get(agentId);
  }

  /**
   * Register an agent
   */
  registerAgent(agent: BaseAgent): void {
    this.agentRegistry.set(agent.id, agent);
  }

  /**
   * Unregister an agent
   */
  unregisterAgent(agentId: AgentID): void {
    this.agentRegistry.delete(agentId);
  }

  /**
   * Get filesystem statistics
   */
  getStats(): {
    mountPointCount: number;
    agentCount: number;
    totalPaths: number;
  } {
    return {
      mountPointCount: this.mountPoints.size,
      agentCount: this.agentRegistry.size,
      totalPaths: this.countPaths()
    };
  }

  /**
   * Normalize a path
   */
  private normalizePath(path: string): string {
    // Remove trailing slash except for root
    let normalized = path.replace(/\/+$/, '') || '/';
    
    // Ensure starts with /
    if (!normalized.startsWith('/')) {
      normalized = '/' + normalized;
    }

    return normalized;
  }

  /**
   * Publish mount event
   */
  private async publishMountEvent(event: string, mountPoint: MountPoint): Promise<void> {
    // Emit on all relevant agents
    this.rootAgent.emit('filesystem:mount', { event, mountPoint });
    mountPoint.target.emit('filesystem:mount', { event, mountPoint });
  }

  /**
   * Count total paths in filesystem
   */
  private countPaths(): number {
    return this.mountPoints.size + 1; // +1 for root
  }
}

/**
 * Mount Point Agent - Represents a mount point as an agent
 */
class MountPointAgent extends BaseAgent {
  constructor(
    private mountPath: string,
    private targetAgent: BaseAgent
  ) {
    super(`mount:${mountPath}`, AgentType.FILESYSTEM, undefined, {
      canMigrate: false,
      canSpawnChildren: false,
      canHandleIPC: true,
      canAccessFilesystem: true
    });

    this.metadata = {
      mountPath,
      targetAgentId: targetAgent.id
    };

    this.setupProxyHandlers();
  }

  /**
   * Setup handlers to proxy messages to target agent
   */
  private setupProxyHandlers(): void {
    // Forward all messages to target agent
    this.onMessage(MessageType.REQUEST, async (msg) => {
      await this.targetAgent.handleMessage(msg);
    });

    this.onMessage(MessageType.READ, async (msg) => {
      await this.targetAgent.handleMessage(msg);
    });

    this.onMessage(MessageType.WRITE, async (msg) => {
      await this.targetAgent.handleMessage(msg);
    });

    // Subscribe to target agent's events
    this.targetAgent.on('event:published', (event: unknown) => {
      this.emit('event:forwarded', event);
    });
  }

  /**
   * Get mount point info
   */
  getMountInfo(): { path: string; targetId: AgentID } {
    return {
      path: this.mountPath,
      targetId: this.targetAgent.id
    };
  }
}
