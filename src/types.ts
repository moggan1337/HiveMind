/**
 * HiveMind - Multi-Agent Operating System
 * Core Type Definitions
 * 
 * This file contains all the fundamental types and interfaces that define
 * how agents operate within the HiveMind OS architecture.
 */

// ============================================================================
// Agent Core Types
// ============================================================================

export type AgentID = string;
export type ProcessID = string;
export type MessageID = string;
export type EventStreamID = string;
export type MountPointID = string;
export type NodeID = string;

export interface AgentCapabilities {
  canMigrate: boolean;
  canSpawnChildren: boolean;
  canHandleIPC: boolean;
  canAccessFilesystem: boolean;
  canNetwork: boolean;
  maxMemoryMB: number;
  priority: AgentPriority;
}

export enum AgentPriority {
  CRITICAL = 0,
  HIGH = 1,
  NORMAL = 2,
  LOW = 3,
  IDLE = 4
}

export enum AgentState {
  CREATED = 'created',
  INITIALIZING = 'initializing',
  RUNNING = 'running',
  WAITING = 'waiting',
  SUSPENDED = 'suspended',
  MIGRATING = 'migrating',
  TERMINATED = 'terminated',
  FAILED = 'failed'
}

export enum AgentType {
  KERNEL = 'kernel',
  PROCESS = 'process',
  FILESYSTEM = 'filesystem',
  NETWORK = 'network',
  USER = 'user',
  SYSTEM = 'system'
}

// ============================================================================
// Agent Interface
// ============================================================================

export interface Agent {
  id: AgentID;
  name: string;
  type: AgentType;
  state: AgentState;
  parent?: AgentID;
  children: AgentID[];
  capabilities: AgentCapabilities;
  metadata: Record<string, unknown>;
  createdAt: number;
  lastHeartbeat: number;
}

export interface AgentContext {
  agent: Agent;
  eventStream: EventStream;
  memory: AgentMemory;
  filesystem: FilesystemAPI;
  ipc: IPCAPI;
  network: NetworkAPI;
}

// ============================================================================
// Message Types (IPC)
// ============================================================================

export interface AgentMessage {
  id: MessageID;
  sender: AgentID;
  recipient: AgentID;
  type: MessageType;
  payload: unknown;
  timestamp: number;
  priority: AgentPriority;
  replyTo?: MessageID;
  expiresAt?: number;
  headers: Record<string, string>;
}

export enum MessageType {
  // Core messaging
  REQUEST = 'request',
  RESPONSE = 'response',
  NOTIFICATION = 'notification',
  BROADCAST = 'broadcast',
  
  // Agent-specific
  SPAWN = 'spawn',
  TERMINATE = 'terminate',
  MIGRATE = 'migrate',
  HEARTBEAT = 'heartbeat',
  
  // IPC
  PIPE = 'pipe',
  SIGNAL = 'signal',
  EVENT = 'event',
  
  // Filesystem
  READ = 'read',
  WRITE = 'write',
  STAT = 'stat',
  LIST = 'list',
  
  // Network
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  TRANSFER = 'transfer'
}

export interface MessageHandler {
  (message: AgentMessage): Promise<AgentMessage | void>;
}

export interface MessageFilter {
  sender?: AgentID;
  recipient?: AgentID;
  type?: MessageType;
  predicate?: (msg: AgentMessage) => boolean;
}

// ============================================================================
// Event Stream (pi-mono compatible)
// ============================================================================

export interface EventStream {
  id: EventStreamID;
  name: string;
  publisher: AgentID;
  subscribers: Map<AgentID, EventSubscription>;
  events: Event[];
  maxSize: number;
  ttl: number;
}

export interface Event {
  id: string;
  stream: EventStreamID;
  type: string;
  data: unknown;
  timestamp: number;
  source: AgentID;
  metadata: Record<string, unknown>;
}

export interface EventSubscription {
  id: string;
  subscriber: AgentID;
  stream: EventStreamID;
  filter?: EventFilter;
  callback: (event: Event) => void | Promise<void>;
  createdAt: number;
}

export interface EventFilter {
  type?: string | string[];
  source?: AgentID;
  predicate?: (event: Event) => boolean;
}

// ============================================================================
// Memory Management
// ============================================================================

export interface AgentMemory {
  agentId: AgentID;
  heap: Map<string, unknown>;
  stack: MemoryStackFrame[];
  segments: MemorySegment[];
  limits: MemoryLimits;
}

export interface MemoryStackFrame {
  id: string;
  functionName: string;
  localVariables: Map<string, unknown>;
  returnAddress: number;
}

export interface MemorySegment {
  id: string;
  name: string;
  start: number;
  size: number;
  type: MemoryType;
  permissions: MemoryPermissions[];
}

export enum MemoryType {
  CODE = 'code',
  DATA = 'data',
  HEAP = 'heap',
  STACK = 'stack',
  SHARED = 'shared'
}

export enum MemoryPermissions {
  READ = 'read',
  WRITE = 'write',
  EXECUTE = 'execute',
  SHARED = 'shared'
}

export interface MemoryLimits {
  maxHeapMB: number;
  maxStackKB: number;
  maxTotalMB: number;
}

// ============================================================================
// Process Agent
// ============================================================================

export interface ProcessAgent extends Agent {
  type: AgentType.PROCESS;
  pid: ProcessID;
  entryPoint: string;
  args: string[];
  env: Record<string, string>;
  workingDir: string;
  stdin?: EventStreamID;
  stdout?: EventStreamID;
  stderr?: EventStreamID;
  cpuUsage: number;
  memoryUsage: number;
  startTime: number;
  exitCode?: number;
}

// ============================================================================
// Filesystem Agent Types
// ============================================================================

export interface FilesystemAgent extends Agent {
  type: AgentType.FILESYSTEM;
  mountPoint: string;
  rootPath: string;
}

export interface FileAgent extends Agent {
  type: AgentType.FILESYSTEM;
  path: string;
  size: number;
  permissions: FilePermissions;
  content?: string;
  lastModified: number;
}

export interface DirectoryAgent extends Agent {
  type: AgentType.FILESYSTEM;
  path: string;
  entries: string[];
  children: AgentID[];
}

export interface FilePermissions {
  owner: PermissionSet;
  group: PermissionSet;
  other: PermissionSet;
}

export interface PermissionSet {
  read: boolean;
  write: boolean;
  execute: boolean;
}

export interface FilesystemAPI {
  read(path: string): Promise<unknown>;
  write(path: string, data: unknown): Promise<void>;
  stat(path: string): Promise<FileStats>;
  list(path: string): Promise<string[]>;
  create(type: 'file' | 'directory', path: string): Promise<void>;
  delete(path: string): Promise<void>;
  chmod(path: string, permissions: FilePermissions): Promise<void>;
  mount(source: string, target: string, options?: MountOptions): Promise<void>;
  unmount(target: string): Promise<void>;
}

export interface FileStats {
  size: number;
  isDirectory: boolean;
  isFile: boolean;
  permissions: FilePermissions;
  created: number;
  modified: number;
  accessed: number;
  owner: string;
  group: string;
}

export interface MountOptions {
  readOnly?: boolean;
  noExec?: boolean;
  noSuid?: boolean;
}

// ============================================================================
// Kernel Types
// ============================================================================

export interface KernelAgent extends Agent {
  type: AgentType.KERNEL;
  version: string;
  uptime: number;
  scheduler: SchedulerState;
  memoryManager: MemoryManagerState;
  processTable: Map<ProcessID, ProcessAgent>;
  eventLoop: EventLoopState;
}

export interface SchedulerState {
  algorithm: SchedulingAlgorithm;
  quantum: number;
  queue: ProcessSchedule[];
  lastSchedule: number;
}

export enum SchedulingAlgorithm {
  FIFO = 'fifo',
  ROUND_ROBIN = 'round_robin',
  PRIORITY = 'priority',
  MULTILEVEL_FEEDBACK_QUEUE = 'mlfq',
  FAIR_SHARE = 'fair_share'
}

export interface ProcessSchedule {
  processId: ProcessID;
  priority: AgentPriority;
  cpuBurst: number;
  ioBurst: number;
  remaining: number;
}

export interface MemoryManagerState {
  totalMemoryMB: number;
  usedMemoryMB: number;
  freeMemoryMB: number;
  pageSize: number;
  swapUsedMB: number;
}

export interface EventLoopState {
  running: boolean;
  tickRate: number;
  lastTick: number;
  eventsProcessed: number;
}

// ============================================================================
// Network & Distribution
// ============================================================================

export interface NetworkAPI {
  connect(nodeId: NodeID): Promise<void>;
  disconnect(nodeId: NodeID): Promise<void>;
  send(to: AgentID, message: AgentMessage): Promise<void>;
  broadcast(message: AgentMessage): Promise<void>;
  migrate(agentId: AgentID, toNode: NodeID): Promise<MigrationResult>;
}

export interface NodeInfo {
  id: NodeID;
  hostname: string;
  ip: string;
  port: number;
  agents: AgentID[];
  load: NodeLoad;
  capabilities: string[];
}

export interface NodeLoad {
  cpuUsage: number;
  memoryUsage: number;
  agentCount: number;
}

export interface MigrationResult {
  success: boolean;
  fromNode: NodeID;
  toNode: NodeID;
  agentId: AgentID;
  checkpoint?: string;
  error?: string;
}

export interface Checkpoint {
  agentId: AgentID;
  timestamp: number;
  memory: AgentMemory;
  state: AgentState;
  eventStreamPosition: number;
  openConnections: string[];
}

// ============================================================================
// IPC API
// ============================================================================

export interface IPCAPI {
  send(to: AgentID, message: AgentMessage): Promise<void>;
  broadcast(message: AgentMessage): Promise<void>;
  subscribe(stream: EventStreamID, handler: (event: Event) => void): Promise<string>;
  unsubscribe(subscriptionId: string): Promise<void>;
  createStream(name: string): Promise<EventStream>;
  pipe(from: EventStreamID, to: EventStreamID): Promise<void>;
  signal(pid: ProcessID, signal: Signal): Promise<void>;
}

export enum Signal {
  SIGTERM = 'SIGTERM',
  SIGKILL = 'SIGKILL',
  SIGSTOP = 'SIGSTOP',
  SIGCONT = 'SIGCONT',
  SIGUSR1 = 'SIGUSR1',
  SIGUSR2 = 'SIGUSR2',
  SIGINT = 'SIGINT'
}

// ============================================================================
// System Events
// ============================================================================

export enum SystemEventType {
  AGENT_SPAWNED = 'agent:spawned',
  AGENT_TERMINATED = 'agent:terminated',
  AGENT_MIGRATED = 'agent:migrated',
  AGENT_FAULTED = 'agent:faulted',
  MEMORY_PRESSURE = 'memory:pressure',
  PROCESS_SCHEDULED = 'process:scheduled',
  FILESYSTEM_MOUNTED = 'filesystem:mounted',
  NETWORK_CONNECTED = 'network:connected',
  NETWORK_DISCONNECTED = 'network:disconnected',
  KERNEL_TICK = 'kernel:tick'
}

// ============================================================================
// API & Configuration
// ============================================================================

export interface HiveMindConfig {
  kernel: KernelConfig;
  filesystem: FilesystemConfig;
  network: NetworkConfig;
  scheduler: SchedulerConfig;
  memory: MemoryConfig;
}

export interface KernelConfig {
  tickRate: number;
  maxAgents: number;
  heartbeatInterval: number;
  watchdogTimeout: number;
}

export interface FilesystemConfig {
  rootPath: string;
  mountPoints: MountPoint[];
  maxFileSize: number;
}

export interface MountPoint {
  path: string;
  agentEndpoint: string;
  options?: MountOptions;
}

export interface NetworkConfig {
  port: number;
  nodes: NodeInfo[];
  gossipInterval: number;
  migrationEnabled: boolean;
}

export interface SchedulerConfig {
  algorithm: SchedulingAlgorithm;
  quantum: number;
  priorityLevels: number;
}

export interface MemoryConfig {
  maxHeapMB: number;
  maxStackKB: number;
  pageSize: number;
  swapEnabled: boolean;
}

// ============================================================================
// Agent Protocol Messages (pi-mono compatible)
// ============================================================================

export interface ProtocolMessage {
  version: string;
  type: string;
  from: AgentID;
  to: AgentID;
  body: unknown;
  headers: Record<string, string>;
  timestamp: number;
}

export interface ProtocolResponse {
  success: boolean;
  body?: unknown;
  error?: string;
  timestamp: number;
}
