/**
 * HiveMind - Multi-Agent Operating System
 * Scheduler Tests
 */

import { Scheduler } from '../src/kernel/Scheduler';
import { SchedulingAlgorithm, AgentPriority } from '../src/types';

describe('Scheduler', () => {
  let scheduler: Scheduler;

  beforeEach(() => {
    scheduler = new Scheduler({
      algorithm: SchedulingAlgorithm.MULTILEVEL_FEEDBACK_QUEUE,
      quantum: 100,
      priorityLevels: 5
    });
  });

  test('should register a process', () => {
    scheduler.register('agent-1', AgentPriority.NORMAL);
    
    const state = scheduler.getState();
    expect(state.queue.length).toBe(1);
  });

  test('should unregister a process', () => {
    scheduler.register('agent-1', AgentPriority.NORMAL);
    scheduler.unregister('agent-1');
    
    const state = scheduler.getState();
    expect(state.queue.length).toBe(0);
  });

  test('should schedule processes', () => {
    scheduler.register('agent-1', AgentPriority.NORMAL);
    scheduler.register('agent-2', AgentPriority.HIGH);
    scheduler.register('agent-3', AgentPriority.LOW);
    
    const scheduled = scheduler.schedule();
    
    expect(scheduled.length).toBeGreaterThan(0);
    expect(scheduled[0].processId).toBeDefined();
  });

  test('should respect priority in scheduling', () => {
    scheduler.register('low-priority', AgentPriority.LOW);
    scheduler.register('high-priority', AgentPriority.HIGH);
    
    const state = scheduler.getState();
    
    // High priority should be scheduled first
    const scheduled = scheduler.schedule();
    expect(scheduled[0].priority).toBeLessThanOrEqual(scheduled[1]?.priority ?? AgentPriority.CRITICAL);
  });

  test('should yield CPU on request', () => {
    scheduler.register('agent-1', AgentPriority.NORMAL);
    
    scheduler.yield('agent-1');
    
    // Process should be able to be scheduled again
    const scheduled = scheduler.schedule();
    expect(scheduled.some(p => p.processId === 'agent-1')).toBe(true);
  });

  test('should block process for I/O', () => {
    scheduler.register('agent-1', AgentPriority.NORMAL);
    
    scheduler.block('agent-1');
    
    // Process should still be registered but not scheduled
    const state = scheduler.getState();
    expect(state.queue.some(p => p.processId === 'agent-1')).toBe(true);
  });

  test('should change scheduling algorithm', () => {
    scheduler.setAlgorithm(SchedulingAlgorithm.ROUND_ROBIN);
    
    const state = scheduler.getState();
    expect(state.algorithm).toBe(SchedulingAlgorithm.ROUND_ROBIN);
  });

  test('should record CPU time', () => {
    scheduler.register('agent-1', AgentPriority.NORMAL);
    
    scheduler.recordCpuTime('agent-1', 50);
    scheduler.recordCpuTime('agent-1', 30);
    
    // CPU time should be accumulated
    const scheduled = scheduler.schedule();
    const process = scheduled.find(p => p.processId === 'agent-1');
    expect(process).toBeDefined();
  });

  test('should get queue status', () => {
    scheduler.register('agent-1', AgentPriority.CRITICAL);
    scheduler.register('agent-2', AgentPriority.LOW);
    
    const status = scheduler.getQueueStatus();
    
    expect(status).toHaveProperty('0'); // Critical queue
    expect(status).toHaveProperty('4'); // Idle queue
  });
});
