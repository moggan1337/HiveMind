/**
 * HiveMind - Multi-Agent Operating System
 * Agent Tests
 */

import { BaseAgent, AgentFactory } from '../src/kernel/Agent';
import { AgentType, AgentState, AgentPriority, MessageType } from '../src/types';

describe('BaseAgent', () => {
  class TestAgent extends BaseAgent {
    constructor() {
      super('test-agent', AgentType.PROCESS, undefined, {
        canMigrate: true,
        canSpawnChildren: true,
        maxMemoryMB: 128
      });
    }

    async onInitialize(): Promise<void> {
      this.onMessage(MessageType.REQUEST, async (msg) => {
        await this.send(msg.sender, MessageType.RESPONSE, { echo: msg.payload });
      });
    }
  }

  let agent: TestAgent;

  beforeEach(() => {
    agent = new TestAgent();
  });

  test('should create agent with correct properties', () => {
    expect(agent.id).toBeDefined();
    expect(agent.name).toBe('test-agent');
    expect(agent.type).toBe(AgentType.PROCESS);
    expect(agent.state).toBe(AgentState.CREATED);
    expect(agent.capabilities.canMigrate).toBe(true);
  });

  test('should initialize agent', async () => {
    await agent.initialize({
      agent: agent.getInfo() as any,
      eventStream: { id: 'test-stream', name: 'test', publisher: agent.id, subscribers: new Map(), events: [], maxSize: 100, ttl: 3600 } as any,
      memory: { agentId: agent.id, heap: new Map(), stack: [], segments: [], limits: { maxHeapMB: 128, maxStackKB: 1024, maxTotalMB: 256 } } as any,
      filesystem: {} as any,
      ipc: {} as any,
      network: {} as any
    });

    expect(agent.state).toBe(AgentState.RUNNING);
  });

  test('should handle messages', async () => {
    await agent.initialize({
      agent: agent.getInfo() as any,
      eventStream: { id: 'test-stream', name: 'test', publisher: agent.id, subscribers: new Map(), events: [], maxSize: 100, ttl: 3600 } as any,
      memory: { agentId: agent.id, heap: new Map(), stack: [], segments: [], limits: { maxHeapMB: 128, maxStackKB: 1024, maxTotalMB: 256 } } as any,
      filesystem: {} as any,
      ipc: {
        send: jest.fn()
      } as any,
      network: {} as any
    });

    const responsePromise = agent.request('test-recipient', MessageType.REQUEST, { test: 'data' });
    
    // The message should be sent via IPC
    expect((agent.context?.ipc as any).send).toHaveBeenCalled();
  });

  test('should terminate gracefully', async () => {
    await agent.initialize({
      agent: agent.getInfo() as any,
      eventStream: { id: 'test-stream', name: 'test', publisher: agent.id, subscribers: new Map(), events: [], maxSize: 100, ttl: 3600 } as any,
      memory: { agentId: agent.id, heap: new Map(), stack: [], segments: [], limits: { maxHeapMB: 128, maxStackKB: 1024, maxTotalMB: 256 } } as any,
      filesystem: {} as any,
      ipc: {} as any,
      network: {} as any
    });

    await agent.terminate(0);
    
    expect(agent.state).toBe(AgentState.TERMINATED);
  });

  test('should suspend and resume', async () => {
    await agent.initialize({
      agent: agent.getInfo() as any,
      eventStream: { id: 'test-stream', name: 'test', publisher: agent.id, subscribers: new Map(), events: [], maxSize: 100, ttl: 3600 } as any,
      memory: { agentId: agent.id, heap: new Map(), stack: [], segments: [], limits: { maxHeapMB: 128, maxStackKB: 1024, maxTotalMB: 256 } } as any,
      filesystem: {} as any,
      ipc: {} as any,
      network: {} as any
    });

    agent.suspend();
    expect(agent.state).toBe(AgentState.SUSPENDED);

    agent.resume();
    expect(agent.state).toBe(AgentState.RUNNING);
  });

  test('should get agent info', () => {
    const info = agent.getInfo();
    
    expect(info.id).toBe(agent.id);
    expect(info.name).toBe(agent.name);
    expect(info.type).toBe(agent.type);
    expect(info.state).toBe(agent.state);
  });
});

describe('AgentFactory', () => {
  test('should create kernel agent', () => {
    const KernelAgent = AgentFactory.createKernelAgent('test-kernel');
    const agent = new KernelAgent();
    
    expect(agent.type).toBe(AgentType.KERNEL);
    expect(agent.capabilities.priority).toBe(AgentPriority.CRITICAL);
    expect(agent.capabilities.canNetwork).toBe(true);
  });

  test('should create process agent', () => {
    const ProcessAgent = AgentFactory.createProcessAgent('test-process', 'parent-id', '/path');
    const agent = new ProcessAgent();
    
    expect(agent.type).toBe(AgentType.PROCESS);
    expect(agent.parent).toBe('parent-id');
  });

  test('should create filesystem agent', () => {
    const FilesystemAgent = AgentFactory.createFilesystemAgent('test-fs', '/mnt');
    const agent = new FilesystemAgent();
    
    expect(agent.type).toBe(AgentType.FILESYSTEM);
    expect(agent.metadata.mountPoint).toBe('/mnt');
  });
});
