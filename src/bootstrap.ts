/**
 * HiveMind - Multi-Agent Operating System
 * Bootstrap - Initial System Setup
 * 
 * This file handles the initial bootstrap process,
 * creating essential system agents and setting up
 * the initial OS state.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  HiveMind,
  Kernel,
  AgentFS,
  BaseAgent,
  AgentType,
  AgentPriority,
  MessageType,
  AgentMessage,
  FileAgentImpl,
  DirectoryAgentImpl
} from './index';
import { FilePermissions } from './types';

/**
 * Bootstrap configuration
 */
interface BootstrapConfig {
  createSystemAgents: boolean;
  createFilesystemTree: boolean;
  createNetworkAgents: boolean;
  setupMountPoints: boolean;
}

/**
 * Default bootstrap configuration
 */
const DEFAULT_BOOTSTRAP: BootstrapConfig = {
  createSystemAgents: true,
  createFilesystemTree: true,
  createNetworkAgents: true,
  setupMountPoints: true
};

/**
 * Bootstrap Manager - Handles initial system setup
 */
export class BootstrapManager {
  private hivemind: HiveMind;
  private config: BootstrapConfig;
  private bootLog: Array<{ step: string; status: 'pending' | 'running' | 'complete' | 'failed'; error?: string }> = [];

  constructor(hivemind: HiveMind, config?: Partial<BootstrapConfig>) {
    this.hivemind = hivemind;
    this.config = { ...DEFAULT_BOOTSTRAP, ...config };
  }

  /**
   * Run the bootstrap process
   */
  async bootstrap(): Promise<void> {
    console.log('[Bootstrap] Starting system bootstrap...');
    console.log('');

    try {
      // Phase 1: Create system agents
      if (this.config.createSystemAgents) {
        await this.createSystemAgents();
      }

      // Phase 2: Create filesystem tree
      if (this.config.createFilesystemTree) {
        await this.createFilesystemTree();
      }

      // Phase 3: Create network agents
      if (this.config.createNetworkAgents) {
        await this.createNetworkAgents();
      }

      // Phase 4: Setup mount points
      if (this.config.setupMountPoints) {
        await this.setupMountPoints();
      }

      console.log('');
      console.log('[Bootstrap] System bootstrap complete!');
      console.log('');
      this.printBootLog();
    } catch (error) {
      console.error('[Bootstrap] Bootstrap failed:', error);
      throw error;
    }
  }

  /**
   * Create essential system agents
   */
  private async createSystemAgents(): Promise<void> {
    this.log('Creating system agents', 'running');

    try {
      // Create init process (PID 1)
      const initAgent = await this.hivemind.spawnAgent(
        'init',
        'process',
        undefined,
        {
          canMigrate: false,
          canSpawnChildren: true,
          maxMemoryMB: 64,
          priority: AgentPriority.CRITICAL
        }
      );
      this.log('Created init agent');

      // Create systemd equivalent
      const systemdAgent = await this.hivemind.spawnAgent(
        'systemd',
        'process',
        undefined,
        {
          canMigrate: false,
          canSpawnChildren: true,
          maxMemoryMB: 128,
          priority: AgentPriority.HIGH
        }
      );
      this.log('Created systemd agent');

      // Create logger agent
      const loggerAgent = await this.hivemind.spawnAgent(
        'hivemind-logger',
        'process',
        undefined,
        {
          canMigrate: false,
          canSpawnChildren: false,
          maxMemoryMB: 256,
          priority: AgentPriority.HIGH
        }
      );
      this.log('Created logger agent');

      // Create scheduler monitor agent
      const schedulerAgent = await this.hivemind.spawnAgent(
        'scheduler',
        'process',
        undefined,
        {
          canMigrate: false,
          canSpawnChildren: true,
          maxMemoryMB: 128,
          priority: AgentPriority.HIGH
        }
      );
      this.log('Created scheduler agent');

      this.log('Creating system agents', 'complete');
    } catch (error) {
      this.log('Creating system agents', 'failed', (error as Error).message);
      throw error;
    }
  }

  /**
   * Create the initial filesystem tree
   */
  private async createFilesystemTree(): Promise<void> {
    this.log('Creating filesystem tree', 'running');

    try {
      const fs = this.hivemind.filesystem;

      // Create essential directories
      const directories = [
        '/bin',      // Binaries
        '/sbin',     // System binaries
        '/etc',      // Configuration
        '/var',      // Variable data
        '/tmp',      // Temporary files
        '/home',     // User home directories
        '/root',     // Root home
        '/opt',      // Optional software
        '/usr',      // User programs
        '/dev',      // Devices
        '/proc',     // Process information
        '/sys',      // System information
        '/mnt',      // Mount points
        '/media',    // Removable media
        '/srv'       // Service data
      ];

      for (const dir of directories) {
        await fs.create('directory', dir);
      }
      this.log(`Created ${directories.length} system directories`);

      // Create virtual device agents
      await this.createVirtualDevices();

      // Create /proc virtual filesystem
      await this.createProcFS();

      // Create /sys virtual filesystem
      await this.createSysFS();

      this.log('Creating filesystem tree', 'complete');
    } catch (error) {
      this.log('Creating filesystem tree', 'failed', (error as Error).message);
      throw error;
    }
  }

  /**
   * Create virtual device agents in /dev
   */
  private async createVirtualDevices(): Promise<void> {
    const devices = [
      { name: 'null', type: 'file', content: '' },
      { name: 'zero', type: 'file', content: '\0'.repeat(4096) },
      { name: 'random', type: 'file', content: '' },
      { name: 'urandom', type: 'file', content: '' }
    ];

    for (const device of devices) {
      await this.hivemind.filesystem.create('file', `/dev/${device.name}`, device.content);
    }
  }

  /**
   * Create virtual /proc filesystem
   */
  private async createProcFS(): Promise<void> {
    // Create process info directory
    await this.hivemind.filesystem.create('directory', '/proc');
    
    // Create system info files
    await this.hivemind.filesystem.create('file', '/proc/cpuinfo', 'processor : 0\nmodel name : HiveMind Virtual CPU\n');
    await this.hivemind.filesystem.create('file', '/proc/meminfo', 'MemTotal: 8192000 kB\nMemFree: 4096000 kB\n');
    await this.hivemind.filesystem.create('file', '/proc/uptime', `${Math.floor(Date.now() / 1000)}`);
  }

  /**
   * Create virtual /sys filesystem
   */
  private async createSysFS(): Promise<void> {
    await this.hivemind.filesystem.create('directory', '/sys');
    await this.hivemind.filesystem.create('file', '/sys/kernel/version', 'HiveMind 1.0.0');
    await this.hivemind.filesystem.create('file', '/sys/kernel/hostname', 'hivemind-node');
  }

  /**
   * Create network agents
   */
  private async createNetworkAgents(): Promise<void> {
    this.log('Creating network agents', 'running');

    try {
      // Create network manager agent
      const networkAgent = await this.hivemind.spawnAgent(
        'NetworkManager',
        'network',
        undefined,
        {
          canMigrate: false,
          canSpawnChildren: true,
          canNetwork: true,
          maxMemoryMB: 128,
          priority: AgentPriority.HIGH
        }
      );
      this.log('Created NetworkManager agent');

      // Create firewall agent
      const firewallAgent = await this.hivemind.spawnAgent(
        'firewall',
        'process',
        undefined,
        {
          canMigrate: false,
          canSpawnChildren: false,
          canNetwork: true,
          maxMemoryMB: 64,
          priority: AgentPriority.HIGH
        }
      );
      this.log('Created firewall agent');

      // Create DNS resolver agent
      const dnsAgent = await this.hivemind.spawnAgent(
        'dns-resolver',
        'process',
        undefined,
        {
          canMigrate: true,
          canSpawnChildren: false,
          canNetwork: true,
          maxMemoryMB: 64,
          priority: AgentPriority.NORMAL
        }
      );
      this.log('Created DNS resolver agent');

      this.log('Creating network agents', 'complete');
    } catch (error) {
      this.log('Creating network agents', 'failed', (error as Error).message);
      throw error;
    }
  }

  /**
   * Setup initial mount points
   */
  private async setupMountPoints(): Promise<void> {
    this.log('Setting up mount points', 'running');

    try {
      const fs = this.hivemind.filesystem;

      // Mount /proc at /proc
      const procDir = new DirectoryAgentImpl('/proc');
      await fs.mount('/proc', procDir, { noExec: false });
      this.log('Mounted /proc');

      // Mount /sys at /sys
      const sysDir = new DirectoryAgentImpl('/sys');
      await fs.mount('/sys', sysDir, { noExec: true, readOnly: true });
      this.log('Mounted /sys');

      // Mount /dev at /dev
      const devDir = new DirectoryAgentImpl('/dev');
      await fs.mount('/dev', devDir, { noExec: true });
      this.log('Mounted /dev');

      this.log('Setting up mount points', 'complete');
    } catch (error) {
      this.log('Setting up mount points', 'failed', (error as Error).message);
      throw error;
    }
  }

  /**
   * Log a bootstrap step
   */
  private log(step: string, status: 'pending' | 'running' | 'complete' | 'failed', error?: string): void {
    const entry = this.bootLog.find(e => e.step === step) || { step, status };
    entry.status = status;
    if (error) entry.error = error;
    
    const existingIndex = this.bootLog.findIndex(e => e.step === step);
    if (existingIndex >= 0) {
      this.bootLog[existingIndex] = entry;
    } else {
      this.bootLog.push(entry);
    }

    const statusIcon = {
      pending: '⏳',
      running: '🔄',
      complete: '✅',
      failed: '❌'
    }[status];

    console.log(`  ${statusIcon} ${step}${error ? ` - ${error}` : ''}`);
  }

  /**
   * Print the boot log summary
   */
  private printBootLog(): void {
    console.log('Bootstrap Summary:');
    console.log('─'.repeat(50));
    
    const total = this.bootLog.length;
    const completed = this.bootLog.filter(e => e.status === 'complete').length;
    const failed = this.bootLog.filter(e => e.status === 'failed').length;

    for (const entry of this.bootLog) {
      const statusIcon = {
        pending: '⏳',
        running: '🔄',
        complete: '✅',
        failed: '❌'
      }[entry.status];
      console.log(`  ${statusIcon} ${entry.step}`);
      if (entry.error) {
        console.log(`      Error: ${entry.error}`);
      }
    }

    console.log('─'.repeat(50));
    console.log(`Total: ${total} | Completed: ${completed} | Failed: ${failed}`);
    console.log('');
  }

  /**
   * Get boot log
   */
  getBootLog() {
    return [...this.bootLog];
  }
}

/**
 * Quick bootstrap function
 */
export async function bootstrap(hivemind: HiveMind): Promise<BootstrapManager> {
  const bootstrapManager = new BootstrapManager(hivemind);
  await bootstrapManager.bootstrap();
  return bootstrapManager;
}
