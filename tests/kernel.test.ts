/**
 * HiveMind - Multi-Agent Operating System
 * Kernel Tests
 */

import { Kernel } from '../src/kernel/Kernel';
import { AgentType, AgentPriority, AgentState } from '../src/types';

describe('Kernel', () => {
  let kernel: Kernel;

  beforeEach(async () => {
    kernel = new Kernel({
      tickRate: 10,
      maxAgents: 100,
      heartbeatInterval: 1000,
      watchdogTimeout: 5000
    });
  });

  afterEach(async () => {
    if (kernel.state === AgentState.RUNNING) {
      await kernel.stop();
    }
  });

  test('should create kernel instance', () => {
    expect(kernel).toBeDefined();
    expect(kernel.id).toBeDefined();
    expect(kernel.type).toBe(AgentType.KERNEL);
    expect(kernel.version).toBe('1.0.0');
  });

  test('should initialize kernel', async () => {
    await kernel.initialize({
      agent: {} as any,
      eventStream: {} as any,
      memory: {} as any,
      filesystem: {} as any,
      ipc: {} as any,
      network: {} as any
    });
    
    expect(kernel.state).toBe(AgentState.RUNNING);
  });

  test('should spawn an agent', async () => {
    await kernel.initialize({
      agent: {} as any,
      eventStream: {} as any,
      memory: {} as any,
      filesystem: {} as any,
      ipc: {} as any,
      network: {} as any
    });

    const agent = await kernel.spawnAgent('test-agent', 'process');
    
    expect(agent).toBeDefined();
    expect(agent.name).toBe('test-agent');
    expect(agent.type).toBe(AgentType.PROCESS);
  });

  test('should list agents', async () => {
    await kernel.initialize({
      agent: {} as any,
      eventStream: {} as any,
      memory: {} as any,
      filesystem: {} as any,
      ipc: {} as any,
      network: {} as any
    });

    await kernel.spawnAgent('agent-1', 'process');
    await kernel.spawnAgent('agent-2', 'process');

    const agents = kernel.listAgents();
    
    expect(agents.length).toBeGreaterThanOrEqual(3); // Kernel + 2 spawned
  });

  test('should terminate an agent', async () => {
    await kernel.initialize({
      agent: {} as any,
      eventStream: {} as any,
      memory: {} as any,
      filesystem: {} as any,
      ipc: {} as any,
      network: {} as any
    });

    const agent = await kernel.spawnAgent('test-agent', 'process');
    await kernel.terminateAgent(agent.id);

    const agents = kernel.listAgents();
    const terminated = agents.find(a => a.id === agent.id);
    
    expect(terminated).toBeUndefined();
  });

  test('should get system stats', async () => {
    await kernel.initialize({
      agent: {} as any,
      eventStream: {} as any,
      memory: {} as any,
      filesystem: {} as any,
      ipc: {} as any,
      network: {} as any
    });

    const stats = kernel.getSystemStats();
    
    expect(stats).toHaveProperty('uptime');
    expect(stats).toHaveProperty('agentCount');
    expect(stats).toHaveProperty('memory');
    expect(stats).toHaveProperty('scheduler');
    expect(stats).toHaveProperty('eventLoop');
  });

  test('should respect max agents limit', async () => {
    const limitedKernel = new Kernel({
      maxAgents: 2
    });

    await limitedKernel.initialize({
      agent: {} as any,
      eventStream: {} as any,
      memory: {} as any,
      filesystem: {} as any,
      ipc: {} as any,
      network: {} as any
    });

    await limitedKernel.spawnAgent('agent-1', 'process');
    
    await expect(
      limitedKernel.spawnAgent('agent-2', 'process')
    ).rejects.toThrow('Maximum agent limit reached');
  });
});
