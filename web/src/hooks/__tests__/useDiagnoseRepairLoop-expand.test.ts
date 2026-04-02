import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Mock useMissions
const mockStartMission = vi.fn(() => 'mission-123')
const mockSendMessage = vi.fn()

vi.mock('../useMissions', () => ({
  useMissions: vi.fn(() => ({
    startMission: mockStartMission,
    sendMessage: mockSendMessage,
    missions: [],
    activeMission: null,
    isSidebarOpen: false,
    agents: [],
    selectedAgent: null,
    defaultAgent: null,
  })),
}))

vi.mock('../../lib/constants', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>
  return { ...actual, LOCAL_AGENT_HTTP_URL: 'http://localhost:8585' }
})

vi.mock('../../lib/constants/network', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>
  return { ...actual, FETCH_DEFAULT_TIMEOUT_MS: 10000 }
})

import { useDiagnoseRepairLoop } from '../useDiagnoseRepairLoop'
import type { MonitoredResource, MonitorIssue } from '../../types/workloadMonitor'

function makeResource(overrides: Partial<MonitoredResource> = {}): MonitoredResource {
  return {
    id: 'Deployment/default/test-app',
    kind: 'Deployment',
    name: 'test-app',
    namespace: 'default',
    cluster: 'cluster-1',
    status: 'unhealthy',
    category: 'workload',
    message: 'Pod crash looping',
    lastChecked: new Date().toISOString(),
    optional: false,
    order: 0,
    ...overrides,
  }
}

function makeIssue(overrides: Partial<MonitorIssue> = {}): MonitorIssue {
  return {
    id: 'issue-1',
    resource: makeResource(),
    severity: 'critical',
    title: 'Pod CrashLoopBackOff',
    description: 'Container is crash looping',
    detectedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('useDiagnoseRepairLoop — expanded edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // 1. Default repair action for missing resource
  it('generates "Create" action for missing resources', () => {
    const { result } = renderHook(() =>
      useDiagnoseRepairLoop({ monitorType: 'workload' })
    )
    const issue = makeIssue({
      resource: makeResource({ kind: 'ConfigMap', status: 'missing' }),
    })
    act(() => { result.current.startDiagnose([makeResource()], [issue], {}) })
    act(() => { vi.advanceTimersByTime(3000) })

    const repair = result.current.state.proposedRepairs[0]
    expect(repair.action).toContain('Create')
  })

  // 2. Default repair action for unhealthy Deployment
  it('generates "Restart" action for unhealthy Deployment', () => {
    const { result } = renderHook(() =>
      useDiagnoseRepairLoop({ monitorType: 'workload' })
    )
    const issue = makeIssue({
      resource: makeResource({ kind: 'Deployment', status: 'unhealthy' }),
    })
    act(() => { result.current.startDiagnose([makeResource()], [issue], {}) })
    act(() => { vi.advanceTimersByTime(3000) })

    expect(result.current.state.proposedRepairs[0].action).toContain('Restart')
  })

  // 3. Default repair action for non-unhealthy Deployment
  it('generates "Scale" action for degraded Deployment', () => {
    const { result } = renderHook(() =>
      useDiagnoseRepairLoop({ monitorType: 'workload' })
    )
    const issue = makeIssue({
      resource: makeResource({ kind: 'Deployment', status: 'degraded' }),
    })
    act(() => { result.current.startDiagnose([makeResource()], [issue], {}) })
    act(() => { vi.advanceTimersByTime(3000) })

    expect(result.current.state.proposedRepairs[0].action).toContain('Scale')
  })

  // 4. Default repair action for Service
  it('generates "Check endpoints" action for Service', () => {
    const { result } = renderHook(() =>
      useDiagnoseRepairLoop({ monitorType: 'workload' })
    )
    const issue = makeIssue({
      resource: makeResource({ kind: 'Service', status: 'unhealthy' }),
    })
    act(() => { result.current.startDiagnose([makeResource()], [issue], {}) })
    act(() => { vi.advanceTimersByTime(3000) })

    expect(result.current.state.proposedRepairs[0].action).toBe('Check endpoints')
  })

  // 5. Default repair action for PVC
  it('generates "Investigate PVC" for PersistentVolumeClaim', () => {
    const { result } = renderHook(() =>
      useDiagnoseRepairLoop({ monitorType: 'workload' })
    )
    const issue = makeIssue({
      resource: makeResource({ kind: 'PersistentVolumeClaim', status: 'unhealthy' }),
    })
    act(() => { result.current.startDiagnose([makeResource()], [issue], {}) })
    act(() => { vi.advanceTimersByTime(3000) })

    expect(result.current.state.proposedRepairs[0].action).toBe('Investigate PVC')
  })

  // 6. Default repair action for unknown kind
  it('generates "Investigate" for unknown resource kind', () => {
    const { result } = renderHook(() =>
      useDiagnoseRepairLoop({ monitorType: 'workload' })
    )
    const issue = makeIssue({
      resource: makeResource({ kind: 'CustomResource', status: 'unhealthy' }),
    })
    act(() => { result.current.startDiagnose([makeResource()], [issue], {}) })
    act(() => { vi.advanceTimersByTime(3000) })

    expect(result.current.state.proposedRepairs[0].action).toContain('Investigate')
  })

  // 7. Risk assessment for critical severity
  it('assigns medium risk for critical severity issues', () => {
    const { result } = renderHook(() =>
      useDiagnoseRepairLoop({ monitorType: 'workload' })
    )
    const issue = makeIssue({ severity: 'critical' })
    act(() => { result.current.startDiagnose([makeResource()], [issue], {}) })
    act(() => { vi.advanceTimersByTime(3000) })

    expect(result.current.state.proposedRepairs[0].risk).toBe('medium')
  })

  // 8. Risk assessment for Deployment kind
  it('assigns medium risk for Deployment kind regardless of severity', () => {
    const { result } = renderHook(() =>
      useDiagnoseRepairLoop({ monitorType: 'workload' })
    )
    const issue = makeIssue({
      severity: 'warning',
      resource: makeResource({ kind: 'Deployment' }),
    })
    act(() => { result.current.startDiagnose([makeResource()], [issue], {}) })
    act(() => { vi.advanceTimersByTime(3000) })

    expect(result.current.state.proposedRepairs[0].risk).toBe('medium')
  })

  // 9. Risk assessment for StatefulSet kind
  it('assigns medium risk for StatefulSet kind', () => {
    const { result } = renderHook(() =>
      useDiagnoseRepairLoop({ monitorType: 'workload' })
    )
    const issue = makeIssue({
      severity: 'warning',
      resource: makeResource({ kind: 'StatefulSet' }),
    })
    act(() => { result.current.startDiagnose([makeResource()], [issue], {}) })
    act(() => { vi.advanceTimersByTime(3000) })

    expect(result.current.state.proposedRepairs[0].risk).toBe('medium')
  })

  // 10. Risk assessment defaults to low
  it('defaults to low risk for non-critical, non-workload resources', () => {
    const { result } = renderHook(() =>
      useDiagnoseRepairLoop({ monitorType: 'workload' })
    )
    const issue = makeIssue({
      severity: 'warning',
      resource: makeResource({ kind: 'ConfigMap' }),
    })
    act(() => { result.current.startDiagnose([makeResource()], [issue], {}) })
    act(() => { vi.advanceTimersByTime(3000) })

    expect(result.current.state.proposedRepairs[0].risk).toBe('low')
  })

  // 11. Cancel sets phase to idle with error message
  it('cancel sets phase to idle and records cancellation', () => {
    const { result } = renderHook(() =>
      useDiagnoseRepairLoop({ monitorType: 'workload' })
    )
    act(() => { result.current.startDiagnose([makeResource()], [makeIssue()], {}) })
    expect(result.current.state.phase).toBe('diagnosing')

    act(() => { result.current.cancel() })
    expect(result.current.state.phase).toBe('idle')
    expect(result.current.state.error).toBe('Cancelled by user')
  })

  // 12. Reset clears everything including maxLoops override
  it('reset restores initial state with custom maxLoops', () => {
    const { result } = renderHook(() =>
      useDiagnoseRepairLoop({ monitorType: 'workload', maxLoops: 7 })
    )
    act(() => { result.current.startDiagnose([makeResource()], [makeIssue()], {}) })
    act(() => { result.current.reset() })
    expect(result.current.state.phase).toBe('idle')
    expect(result.current.state.maxLoops).toBe(7)
    expect(result.current.state.loopCount).toBe(0)
    expect(result.current.state.issuesFound).toEqual([])
  })

  // 13. executeRepairs sends prompt to mission
  it('executeRepairs sends repair prompt via sendMessage', () => {
    const { result } = renderHook(() =>
      useDiagnoseRepairLoop({ monitorType: 'workload' })
    )
    act(() => { result.current.startDiagnose([makeResource()], [makeIssue()], {}) })
    act(() => { vi.advanceTimersByTime(3000) })
    act(() => { result.current.approveAllRepairs() })
    act(() => { result.current.executeRepairs() })

    expect(mockSendMessage).toHaveBeenCalledWith(
      'mission-123',
      expect.stringContaining('Execute the following approved repairs'),
    )
  })

  // 14. Loop terminates when maxLoops reached
  it('transitions to complete when maxLoops is reached during repair', () => {
    const { result } = renderHook(() =>
      useDiagnoseRepairLoop({ monitorType: 'workload', maxLoops: 1 })
    )
    act(() => { result.current.startDiagnose([makeResource()], [makeIssue()], {}) })
    act(() => { vi.advanceTimersByTime(3000) })
    act(() => { result.current.approveAllRepairs() })
    act(() => { result.current.executeRepairs() })
    // After 5s repair delay, should complete (maxLoops=1, loopCount=0, 0 >= 1-1 = 0)
    act(() => { vi.advanceTimersByTime(5000) })
    expect(result.current.state.phase).toBe('complete')
  })

  // 15. Diagnose prompt includes repairable flag
  it('includes repair instructions in prompt when repairable is true', () => {
    const { result } = renderHook(() =>
      useDiagnoseRepairLoop({ monitorType: 'workload', repairable: true })
    )
    act(() => { result.current.startDiagnose([makeResource()], [makeIssue()], {}) })
    const callArgs = mockStartMission.mock.calls[0][0]
    expect(callArgs.initialPrompt).toContain('propose a specific repair action')
  })

  // 16. Diagnose prompt excludes repair when not repairable
  it('excludes repair instructions when repairable is false', () => {
    const { result } = renderHook(() =>
      useDiagnoseRepairLoop({ monitorType: 'workload', repairable: false })
    )
    act(() => { result.current.startDiagnose([makeResource()], [makeIssue()], {}) })
    const callArgs = mockStartMission.mock.calls[0][0]
    expect(callArgs.initialPrompt).toContain('Recommendations for addressing')
    expect(callArgs.initialPrompt).toContain('no automated repairs')
  })
})
