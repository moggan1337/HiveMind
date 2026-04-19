/**
 * HiveMind - Multi-Agent Operating System
 * Main Entry Point
 * 
 * Where Processes ARE Agents.
 * This is the heart of HiveMind - a distributed multi-agent
 * operating system built on event streams and message passing.
 */

import { Kernel } from './kernel/Kernel';
import { AgentFS } from './filesystem/AgentFS';
import { DistributedNetwork } from './network/DistributedNetwork';
import { IPCManager } from './ipc/IPC';
import {
  HiveMindConfig,
  KernelConfig,
  NetworkConfig,
  SchedulerConfig,
  MemoryConfig,
  FilesystemConfig,
  SchedulingAlgorithm,
  AgentType,
  AgentPriority
} from './types';
import { BaseAgent } from './kernel/Agent';

// Re-export all public types and classes
export * from './types';
export { Kernel } from './kernel/Kernel';
export { BaseAgent } from './kernel/Agent';
export { AgentFS } from './filesystem/AgentFS';
export { DistributedNetwork } from './network/DistributedNetwork';
export { IPCManager } from './ipc/IPC';
export { FileAgentImpl, DirectoryAgentImpl } from './filesystem/FilesystemAgent';

/**
 * Default configuration for HiveMind
 */
export const DEFAULT_CONFIG: HiveMindConfig = {
  kernel: {
    tickRate: 10,
    maxAgents: 10000,
    heartbeatInterval: 1000,
    watchdogTimeout: 30000
  },
  filesystem: {
    rootPath: '/',
    mountPoints: [],
    maxFileSize: 100 * 1024 * 1024 // 100MB
  },
  network: {
    port: 8080,
    nodes: [],
    gossipInterval: 5000,
    migrationEnabled: true
  },
  scheduler: {
    algorithm: SchedulingAlgorithm.MULTILEVEL_FEEDBACK_QUEUE,
    quantum: 100,
    priorityLevels: 5
  },
  memory: {
    maxHeapMB: 4096,
    maxStackKB: 8192,
    pageSize: 4096,
    swapEnabled: true
  }
};

/**
 * HiveMind OS - Main class
 */
export class HiveMind {
  public readonly kernel: Kernel;
  public readonly filesystem: AgentFS;
  public readonly network: DistributedNetwork;
  public readonly ipc: IPCManager;
  private config: HiveMindConfig;
  private running: boolean = false;

  constructor(config?: Partial<HiveMindConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Initialize components
    this.kernel = new Kernel(this.config.kernel);
    this.filesystem = new AgentFS();
    this.network = new DistributedNetwork('local', this.config.network);
    this.ipc = new IPCManager();
  }

  /**
   * Start HiveMind OS
   */
  async start(): Promise<void> {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                                                            ║');
    console.log('║     ██╗███╗   ██╗███████╗██╗  ██╗███████╗███╗   ██╗     ║');
    console.log('║     ██║████╗  ██║██╔════╝╚██╗██╔╝██╔════╝████╗  ██║     ║');
    console.log('║     ██║██╔██╗ ██║█████╗   ╚███╔╝ █████╗  ██╔██╗ ██║     ║');
    console.log('║     ██║██║╚██╗██║██╔══╝   ██╔██╗ ██╔══╝  ██║╚██╗██║     ║');
    console.log('║     ██║██║ ╚████║███████╗██╔╝ ██╗███████╗██║ ╚████║     ║');
    console.log('║     ╚═╝╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝     ║');
    console.log('║                                                            ║');
    console.log('║          Multi-Agent Operating System v1.0                ║');
    console.log('║          Where Processes ARE Agents                       ║');
    console.log('║                                                            ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');

    console.log('[HiveMind] Initializing operating system...');
    
    // Start kernel
    await this.kernel.start();
    
    // Mount filesystem
    await this.filesystem.mount('/', this.kernel);
    
    // Start network services
    this.network.startGossip();
    this.network.startHeartbeat();

    this.running = true;
    
    console.log('[HiveMind] Operating system started successfully');
    console.log(`[HiveMind] Kernel uptime: ${this.kernel.uptime}ms`);
    console.log(`[HiveMind] Agent capacity: ${this.config.kernel.maxAgents}`);
    console.log('');
  }

  /**
   * Stop HiveMind OS
   */
  async stop(): Promise<void> {
    console.log('[HiveMind] Shutting down...');
    
    this.running = false;
    
    // Stop network
    this.network.stopGossip();
    this.network.stopHeartbeat();
    
    // Stop kernel
    await this.kernel.stop();
    
    console.log('[HiveMind] Shutdown complete');
  }

  /**
   * Spawn a new agent
   */
  async spawnAgent(
    name: string,
    agentClass: string,
    parent?: string,
    capabilities?: {
      canMigrate?: boolean;
      canSpawnChildren?: boolean;
      maxMemoryMB?: number;
      priority?: AgentPriority;
    }
  ): Promise<BaseAgent> {
    return this.kernel.spawnAgent(agentClass, name, parent, capabilities);
  }

  /**
   * Terminate an agent
   */
  async terminateAgent(agentId: string): Promise<void> {
    await this.kernel.terminateAgent(agentId);
  }

  /**
   * List all running agents
   */
  listAgents() {
    return this.kernel.listAgents();
  }

  /**
   * Get system statistics
   */
  getStats() {
    return {
      kernel: this.kernel.getSystemStats(),
      filesystem: this.filesystem.getStats(),
      network: this.network.getStats(),
      ipc: this.ipc.getStats()
    };
  }

  /**
   * Check if HiveMind is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get configuration
   */
  getConfig(): HiveMindConfig {
    return { ...this.config };
  }
}

// Quick start function
export async function createHiveMind(config?: Partial<HiveMindConfig>): Promise<HiveMind> {
  const hivemind = new HiveMind(config);
  await hivemind.start();
  return hivemind;
}

// CLI interface
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] || 'start';

  switch (command) {
    case 'start':
      const hivemind = new HiveMind();
      await hivemind.start();
      
      // Keep running
      process.on('SIGINT', async () => {
        await hivemind.stop();
        process.exit(0);
      });
      
      process.on('SIGTERM', async () => {
        await hivemind.stop();
        process.exit(0);
      });
      break;

    case 'stats':
      console.log('Fetching HiveMind statistics...');
      // Would connect to running instance and fetch stats
      break;

    case 'list':
      console.log('Listing agents...');
      // Would connect to running instance and list agents
      break;

    default:
      console.log(`Unknown command: ${command}`);
      console.log('Available commands: start, stats, list');
      process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}
