/**
 * HiveMind - Multi-Agent Operating System
 * Filesystem Agent - Files and Directories as Messageable Agents
 * 
 * In HiveMind, every file and directory is an agent that can:
 * - Receive and respond to messages
 * - Publish events to streams
 * - Handle IPC with other agents
 * - Be mounted at agent endpoints
 */

import { v4 as uuidv4 } from 'uuid';
import {
  BaseAgent,
  AgentType,
  AgentID,
  AgentState,
  AgentPriority,
  MessageType,
  AgentMessage,
  FileAgent,
  DirectoryAgent,
  FilePermissions,
  PermissionSet,
  FileStats,
  MountOptions
} from '../types';

interface FileContent {
  data: string | Buffer;
  encoding: 'utf8' | 'binary';
}

/**
 * File Agent - Represents a file as an agent
 */
export class FileAgentImpl extends BaseAgent implements FileAgent {
  public readonly type = AgentType.FILESYSTEM;
  public path: string;
  public size: number;
  public permissions: FilePermissions;
  public lastModified: number;
  private content: FileContent;

  constructor(
    path: string,
    permissions?: Partial<FilePermissions>,
    content?: string
  ) {
    const fileName = path.split('/').pop() || 'unknown';
    super(fileName, AgentType.FILESYSTEM);

    this.path = path;
    this.permissions = permissions ? this.normalizePermissions(permissions) : this.defaultPermissions();
    this.lastModified = Date.now();
    this.content = {
      data: content || '',
      encoding: 'utf8'
    };
    this.size = content?.length || 0;

    this.metadata = {
      path,
      extension: this.getExtension(path),
      mimeType: this.guessMimeType(path)
    };

    this.setupFileHandlers();
  }

  /**
   * Setup message handlers for file operations
   */
  private setupFileHandlers(): void {
    this.onMessage(MessageType.READ, async (msg) => {
      return this.handleRead(msg);
    });

    this.onMessage(MessageType.WRITE, async (msg) => {
      return this.handleWrite(msg);
    });

    this.onMessage(MessageType.STAT, async (msg) => {
      return this.handleStat(msg);
    });

    this.onMessage(MessageType.REQUEST, async (msg) => {
      return this.handleFileRequest(msg);
    });
  }

  /**
   * Handle read request
   */
  private async handleRead(msg: AgentMessage): Promise<AgentMessage> {
    if (!this.canRead()) {
      return this.createErrorResponse(msg, 'Permission denied');
    }

    const { offset, length } = (msg.payload as { offset?: number; length?: number }) || {};

    let data: string | Buffer = this.content.data;
    if (typeof data === 'string' && offset !== undefined) {
      data = data.slice(offset, length ? offset + length : undefined);
    }

    return {
      id: uuidv4(),
      sender: this.id,
      recipient: msg.sender,
      type: MessageType.RESPONSE,
      payload: { success: true, data, size: this.size },
      timestamp: Date.now(),
      priority: this.capabilities.priority,
      replyTo: msg.id
    } as AgentMessage;
  }

  /**
   * Handle write request
   */
  private async handleWrite(msg: AgentMessage): Promise<AgentMessage> {
    if (!this.canWrite()) {
      return this.createErrorResponse(msg, 'Permission denied');
    }

    const { data, append } = msg.payload as { data: string; append?: boolean };

    if (append) {
      this.content.data = (this.content.data as string) + data;
    } else {
      this.content.data = data;
    }

    this.size = typeof this.content.data === 'string' 
      ? this.content.data.length 
      : this.content.data.length;
    this.lastModified = Date.now();

    await this.publish('file:modified', { path: this.path, size: this.size });

    return {
      id: uuidv4(),
      sender: this.id,
      recipient: msg.sender,
      type: MessageType.RESPONSE,
      payload: { success: true, size: this.size },
      timestamp: Date.now(),
      priority: this.capabilities.priority,
      replyTo: msg.id
    } as AgentMessage;
  }

  /**
   * Handle stat request
   */
  private async handleStat(msg: AgentMessage): Promise<AgentMessage> {
    const stats: FileStats = {
      size: this.size,
      isDirectory: false,
      isFile: true,
      permissions: this.permissions,
      created: this.createdAt,
      modified: this.lastModified,
      accessed: this.lastHeartbeat,
      owner: 'root',
      group: 'users'
    };

    return {
      id: uuidv4(),
      sender: this.id,
      recipient: msg.sender,
      type: MessageType.RESPONSE,
      payload: { success: true, stats },
      timestamp: Date.now(),
      priority: this.capabilities.priority,
      replyTo: msg.id
    } as AgentMessage;
  }

  /**
   * Handle generic file requests
   */
  private async handleFileRequest(msg: AgentMessage): Promise<AgentMessage> {
    const { action } = msg.payload as { action: string };

    switch (action) {
      case 'chmod':
        const { permissions } = msg.payload as { permissions: FilePermissions };
        this.permissions = permissions;
        return this.createSuccessResponse(msg);

      case 'truncate':
        const { length } = msg.payload as { length: number };
        if (typeof this.content.data === 'string') {
          this.content.data = this.content.data.slice(0, length);
          this.size = this.content.data.length;
        }
        return this.createSuccessResponse(msg, { size: this.size });

      case 'copy':
        const { targetPath } = msg.payload as { targetPath: string };
        return this.createSuccessResponse(msg, { 
          path: targetPath,
          agentId: this.id // In real implementation, would create new agent
        });

      case 'move':
        const { newPath } = msg.payload as { newPath: string };
        this.path = newPath;
        this.name = newPath.split('/').pop() || this.name;
        return this.createSuccessResponse(msg, { path: newPath });

      default:
        return this.createErrorResponse(msg, `Unknown action: ${action}`);
    }
  }

  /**
   * Check if current context can read
   */
  private canRead(): boolean {
    // In real implementation, would check against actual user context
    return this.permissions.owner.read || this.permissions.other.read;
  }

  /**
   * Check if current context can write
   */
  private canWrite(): boolean {
    return this.permissions.owner.write || this.permissions.other.write;
  }

  /**
   * Create success response
   */
  private createSuccessResponse(msg: AgentMessage, data?: unknown): AgentMessage {
    return {
      id: uuidv4(),
      sender: this.id,
      recipient: msg.sender,
      type: MessageType.RESPONSE,
      payload: { success: true, ...data },
      timestamp: Date.now(),
      priority: this.capabilities.priority,
      replyTo: msg.id
    } as AgentMessage;
  }

  /**
   * Create error response
   */
  private createErrorResponse(msg: AgentMessage, error: string): AgentMessage {
    return {
      id: uuidv4(),
      sender: this.id,
      recipient: msg.sender,
      type: MessageType.RESPONSE,
      payload: { success: false, error },
      timestamp: Date.now(),
      priority: this.capabilities.priority,
      replyTo: msg.id
    } as AgentMessage;
  }

  /**
   * Get file extension
   */
  private getExtension(path: string): string {
    const parts = path.split('.');
    return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
  }

  /**
   * Guess MIME type from extension
   */
  private guessMimeType(path: string): string {
    const ext = this.getExtension(path);
    const mimeTypes: Record<string, string> = {
      'txt': 'text/plain',
      'md': 'text/markdown',
      'json': 'application/json',
      'js': 'application/javascript',
      'ts': 'application/typescript',
      'html': 'text/html',
      'css': 'text/css',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'gif': 'image/gif',
      'pdf': 'application/pdf'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Normalize permissions
   */
  private normalizePermissions(p: Partial<FilePermissions>): FilePermissions {
    return {
      owner: { ...this.defaultPermissionSet(), ...p.owner },
      group: { ...this.defaultPermissionSet(), ...p.group },
      other: { ...this.defaultPermissionSet(), ...p.other }
    };
  }

  /**
   * Default permissions
   */
  private defaultPermissions(): FilePermissions {
    return {
      owner: this.defaultPermissionSet(),
      group: this.defaultPermissionSet(),
      other: this.defaultPermissionSet()
    };
  }

  /**
   * Default permission set (rw-r--r--)
   */
  private defaultPermissionSet(): PermissionSet {
    return {
      read: true,
      write: true,
      execute: false
    };
  }
}

/**
 * Directory Agent - Represents a directory as an agent
 */
export class DirectoryAgentImpl extends BaseAgent implements DirectoryAgent {
  public readonly type = AgentType.FILESYSTEM;
  public path: string;
  public entries: string[] = [];
  public children: AgentID[] = [];

  private fileAgents: Map<string, FileAgentImpl> = new Map();
  private directoryAgents: Map<string, DirectoryAgentImpl> = new Map();

  constructor(path: string, permissions?: Partial<FilePermissions>) {
    const dirName = path.split('/').pop() || '/';
    super(dirName, AgentType.FILESYSTEM);

    this.path = path;
    this.metadata = { path };

    this.setupDirectoryHandlers();
  }

  /**
   * Setup message handlers for directory operations
   */
  private setupDirectoryHandlers(): void {
    this.onMessage(MessageType.LIST, async (msg) => {
      return this.handleList(msg);
    });

    this.onMessage(MessageType.READ, async (msg) => {
      return this.handleReadEntry(msg);
    });

    this.onMessage(MessageType.WRITE, async (msg) => {
      return this.handleCreateEntry(msg);
    });

    this.onMessage(MessageType.DELETE, async (msg) => {
      return this.handleDeleteEntry(msg);
    });

    this.onMessage(MessageType.REQUEST, async (msg) => {
      return this.handleDirectoryRequest(msg);
    });
  }

  /**
   * Handle list request
   */
  private async handleList(msg: AgentMessage): Promise<AgentMessage> {
    const { recursive, includeHidden } = (msg.payload as { recursive?: boolean; includeHidden?: boolean }) || {};

    let entries = [...this.entries];

    if (!includeHidden) {
      entries = entries.filter(e => !e.startsWith('.'));
    }

    if (recursive) {
      const allEntries: Array<{ path: string; type: 'file' | 'directory' }> = [];
      
      for (const entry of entries) {
        const fullPath = this.path === '/' ? `/${entry}` : `${this.path}/${entry}`;
        
        if (this.directoryAgents.has(entry)) {
          allEntries.push({ path: fullPath, type: 'directory' });
          // TODO: Recursively list subdirectory
        } else {
          allEntries.push({ path: fullPath, type: 'file' });
        }
      }

      return {
        id: uuidv4(),
        sender: this.id,
        recipient: msg.sender,
        type: MessageType.RESPONSE,
        payload: { success: true, entries: allEntries },
        timestamp: Date.now(),
        priority: this.capabilities.priority,
        replyTo: msg.id
      } as AgentMessage;
    }

    return {
      id: uuidv4(),
      sender: this.id,
      recipient: msg.sender,
      type: MessageType.RESPONSE,
      payload: { success: true, entries },
      timestamp: Date.now(),
      priority: this.capabilities.priority,
      replyTo: msg.id
    } as AgentMessage;
  }

  /**
   * Handle read entry request
   */
  private async handleReadEntry(msg: AgentMessage): Promise<AgentMessage> {
    const { entryPath } = msg.payload as { entryPath: string };
    const name = entryPath.split('/').pop()!;

    // Check if it's a file
    const fileAgent = this.fileAgents.get(name);
    if (fileAgent) {
      return {
        id: uuidv4(),
        sender: this.id,
        recipient: msg.sender,
        type: MessageType.RESPONSE,
        payload: { success: true, type: 'file', agentId: fileAgent.id },
        timestamp: Date.now(),
        priority: this.capabilities.priority,
        replyTo: msg.id
      } as AgentMessage;
    }

    // Check if it's a directory
    const dirAgent = this.directoryAgents.get(name);
    if (dirAgent) {
      return {
        id: uuidv4(),
        sender: this.id,
        recipient: msg.sender,
        type: MessageType.RESPONSE,
        payload: { success: true, type: 'directory', agentId: dirAgent.id },
        timestamp: Date.now(),
        priority: this.capabilities.priority,
        replyTo: msg.id
      } as AgentMessage;
    }

    return {
      id: uuidv4(),
      sender: this.id,
      recipient: msg.sender,
      type: MessageType.RESPONSE,
      payload: { success: false, error: 'Entry not found' },
      timestamp: Date.now(),
      priority: this.capabilities.priority,
      replyTo: msg.id
    } as AgentMessage;
  }

  /**
   * Handle create entry request
   */
  private async handleCreateEntry(msg: AgentMessage): Promise<AgentMessage> {
    const { type, name, content } = msg.payload as { 
      type: 'file' | 'directory'; 
      name: string; 
      content?: string 
    };

    const fullPath = this.path === '/' ? `/${name}` : `${this.path}/${name}`;

    if (type === 'file') {
      const fileAgent = new FileAgentImpl(fullPath, undefined, content);
      this.fileAgents.set(name, fileAgent);
      this.entries.push(name);
      this.children.push(fileAgent.id);

      await this.publish('entry:created', { path: fullPath, type: 'file' });

      return {
        id: uuidv4(),
        sender: this.id,
        recipient: msg.sender,
        type: MessageType.RESPONSE,
        payload: { success: true, agentId: fileAgent.id },
        timestamp: Date.now(),
        priority: this.capabilities.priority,
        replyTo: msg.id
      } as AgentMessage;
    } else {
      const dirAgent = new DirectoryAgentImpl(fullPath);
      this.directoryAgents.set(name, dirAgent);
      this.entries.push(name);
      this.children.push(dirAgent.id);

      await this.publish('entry:created', { path: fullPath, type: 'directory' });

      return {
        id: uuidv4(),
        sender: this.id,
        recipient: msg.sender,
        type: MessageType.RESPONSE,
        payload: { success: true, agentId: dirAgent.id },
        timestamp: Date.now(),
        priority: this.capabilities.priority,
        replyTo: msg.id
      } as AgentMessage;
    }
  }

  /**
   * Handle delete entry request
   */
  private async handleDeleteEntry(msg: AgentMessage): Promise<AgentMessage> {
    const { name, recursive } = msg.payload as { name: string; recursive?: boolean };

    const fileAgent = this.fileAgents.get(name);
    if (fileAgent) {
      this.fileAgents.delete(name);
      const index = this.entries.indexOf(name);
      if (index > -1) this.entries.splice(index, 1);
      
      const childIndex = this.children.indexOf(fileAgent.id);
      if (childIndex > -1) this.children.splice(childIndex, 1);

      await this.publish('entry:deleted', { path: `${this.path}/${name}`, type: 'file' });

      return {
        id: uuidv4(),
        sender: this.id,
        recipient: msg.sender,
        type: MessageType.RESPONSE,
        payload: { success: true },
        timestamp: Date.now(),
        priority: this.capabilities.priority,
        replyTo: msg.id
      } as AgentMessage;
    }

    const dirAgent = this.directoryAgents.get(name);
    if (dirAgent) {
      if (!recursive && dirAgent.entries.length > 0) {
        return {
          id: uuidv4(),
          sender: this.id,
          recipient: msg.sender,
          type: MessageType.RESPONSE,
          payload: { success: false, error: 'Directory not empty' },
          timestamp: Date.now(),
          priority: this.capabilities.priority,
          replyTo: msg.id
        } as AgentMessage;
      }

      this.directoryAgents.delete(name);
      const index = this.entries.indexOf(name);
      if (index > -1) this.entries.splice(index, 1);
      
      const childIndex = this.children.indexOf(dirAgent.id);
      if (childIndex > -1) this.children.splice(childIndex, 1);

      await this.publish('entry:deleted', { path: `${this.path}/${name}`, type: 'directory' });

      return {
        id: uuidv4(),
        sender: this.id,
        recipient: msg.sender,
        type: MessageType.RESPONSE,
        payload: { success: true },
        timestamp: Date.now(),
        priority: this.capabilities.priority,
        replyTo: msg.id
      } as AgentMessage;
    }

    return {
      id: uuidv4(),
      sender: this.id,
      recipient: msg.sender,
      type: MessageType.RESPONSE,
      payload: { success: false, error: 'Entry not found' },
      timestamp: Date.now(),
      priority: this.capabilities.priority,
      replyTo: msg.id
    } as AgentMessage;
  }

  /**
   * Handle directory requests
   */
  private async handleDirectoryRequest(msg: AgentMessage): Promise<AgentMessage> {
    const { action, path: targetPath } = msg.payload as { action: string; path?: string };

    switch (action) {
      case 'mkdir':
        return this.handleCreateEntry({
          ...msg,
          payload: { type: 'directory', name: targetPath?.split('/').pop() }
        } as AgentMessage);

      case 'exists':
        const name = targetPath?.split('/').pop()!;
        const exists = this.entries.includes(name);
        return {
          id: uuidv4(),
          sender: this.id,
          recipient: msg.sender,
          type: MessageType.RESPONSE,
          payload: { success: true, exists },
          timestamp: Date.now(),
          priority: this.capabilities.priority,
          replyTo: msg.id
        } as AgentMessage;

      case 'stat':
        const stats: FileStats = {
          size: 4096, // Directory block size
          isDirectory: true,
          isFile: false,
          permissions: this.defaultPermissions(),
          created: this.createdAt,
          modified: this.lastModified,
          accessed: this.lastHeartbeat,
          owner: 'root',
          group: 'users'
        };
        return {
          id: uuidv4(),
          sender: this.id,
          recipient: msg.sender,
          type: MessageType.RESPONSE,
          payload: { success: true, stats },
          timestamp: Date.now(),
          priority: this.capabilities.priority,
          replyTo: msg.id
        } as AgentMessage;

      default:
        return {
          id: uuidv4(),
          sender: this.id,
          recipient: msg.sender,
          type: MessageType.RESPONSE,
          payload: { success: false, error: `Unknown action: ${action}` },
          timestamp: Date.now(),
          priority: this.capabilities.priority,
          replyTo: msg.id
        } as AgentMessage;
    }
  }

  /**
   * Default permissions for directories
   */
  private defaultPermissions(): FilePermissions {
    return {
      owner: { read: true, write: true, execute: true },
      group: { read: true, execute: true, write: false },
      other: { read: true, execute: true, write: false }
    };
  }

  /**
   * Get file agent by name
   */
  getFileAgent(name: string): FileAgentImpl | undefined {
    return this.fileAgents.get(name);
  }

  /**
   * Get directory agent by name
   */
  getDirectoryAgent(name: string): DirectoryAgentImpl | undefined {
    return this.directoryAgents.get(name);
  }
}
