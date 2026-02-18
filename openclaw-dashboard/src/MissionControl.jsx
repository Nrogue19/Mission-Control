import React, { useState, useEffect, useCallback, useRef } from 'react';
import './MissionControl.css';
import './components/Header.css';
import './components/KanbanColumn.css';
import './components/TaskCard.css';
import './components/Modal.css';
import './MonitoringStyles.css';
import { TaskModal } from './components/TaskModal';
import { AddAgentModal, EditAgentModal } from './components/AgentModals';
import { MissionChatSection } from './components/MissionChatSection';
import { TokenUsageMonitor, SecurityDashboard, AgentHealthMonitor } from './MonitoringComponents';
import { runtimeConfig } from './config/runtimeConfig';
import { minimaxConfig, sendMessageToMiniMax } from './services/minimaxChat';
import {
  fetchMissionSnapshot,
  postEmergencyAction,
  postTaskColumnUpdate,
  postTaskUpdate,
  deleteTaskById,
  postMissionChatMessage,
  postCreateAgent,
  putUpdateAgent,
  deleteAgentById,
  fetchTelegramStatus
} from './services/openclawApiClient';
import { createOpenClawRealtimeClient } from './services/openclawRealtime';
import {
  agentColors,
  agents as initialAgents,
  localFiles as initialFiles,
  tasks as initialTasks,
  feedItems as initialFeedItems,
  missionChatSeed as initialMissionChat,
  auditTimeline as initialAuditTimeline,
  skillIntegrations as initialSkillIntegrations,
  memorySpaces as initialMemorySpaces,
  memoryGraphLinks as initialMemoryGraphLinks,
  configurationValidator as configurationValidatorData
} from './data';

const DARK_MODE_STORAGE_KEY = 'openclaw.darkMode';
const EMERGENCY_MODE = {
  NORMAL: 'normal',
  STOPPED: 'stopped',
  LOCKDOWN: 'lockdown',
  SAFE: 'safe'
};

const CONNECTION_STATUS = {
  MOCK: 'mock',
  SYNCING: 'syncing',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  DISCONNECTED: 'disconnected',
  FALLBACK: 'fallback',
  DISABLED: 'disabled'
};

const chatTimeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
});

const getChatTimestamp = () => chatTimeFormatter.format(new Date());

const normalizeTaskId = (value) => String(value ?? '').trim();

const taskIdsMatch = (left, right) => normalizeTaskId(left) === normalizeTaskId(right);

const normalizeMessageId = (value) => String(value ?? '').trim();

const mergeChatMessages = (existingMessages, incomingMessages) => {
  if (!Array.isArray(incomingMessages) || incomingMessages.length === 0) {
    return Array.isArray(existingMessages) ? existingMessages : [];
  }

  const nextMessages = Array.isArray(existingMessages) ? [...existingMessages] : [];
  const knownIds = new Set(
    nextMessages
      .map((message) => normalizeMessageId(message?.id))
      .filter(Boolean)
  );

  incomingMessages.forEach((message) => {
    if (!message || typeof message !== 'object') {
      return;
    }

    const incomingId = normalizeMessageId(message.id);
    if (incomingId && knownIds.has(incomingId)) {
      return;
    }

    if (incomingId) {
      knownIds.add(incomingId);
    }

    nextMessages.push(message);
  });

  return nextMessages;
};

const EMPTY_CONFIGURATION_VALIDATOR = {
  healthScore: 0,
  issues: [],
  validatedFiles: []
};

const EMPTY_TOKEN_USAGE = {
  today: 0,
  cost: 0,
  budget: 25,
  topConsumers: [],
  weeklyTrend: [0, 0, 0, 0, 0, 0, 0],
  suggestions: ['Waiting for live token usage data...']
};

const EMPTY_SECURITY = {
  score: 100,
  alerts: [],
  apiKeys: [],
  recentActivity: []
};

const EMPTY_HEALTH = {
  healthy: 0,
  degraded: 0,
  down: 0,
  systemHealth: [],
  recentErrors: [],
  agents: []
};

const FALLBACK_AGENT_COLORS = ['#0ea5e9', '#22c55e', '#f97316', '#14b8a6', '#ef4444', '#3b82f6'];

const normalizeAgentName = (value) => String(value || '').trim();

const getAgentColor = (agentName) => {
  const normalizedName = normalizeAgentName(agentName);
  if (!normalizedName) {
    return FALLBACK_AGENT_COLORS[0];
  }

  if (agentColors[normalizedName]) {
    return agentColors[normalizedName];
  }

  const hash = normalizedName
    .split('')
    .reduce((accumulator, character) => accumulator + character.charCodeAt(0), 0);
  return FALLBACK_AGENT_COLORS[hash % FALLBACK_AGENT_COLORS.length];
};

const toAgentInitial = (agentName) => {
  const normalizedName = normalizeAgentName(agentName);
  return normalizedName ? normalizedName.charAt(0).toUpperCase() : 'A';
};

const agentIdsMatch = (left, right) => String(left ?? '').trim() === String(right ?? '').trim();

// Dark Mode Toggle Component
const DarkModeToggle = ({ isDark, onToggle }) => (
  <button 
    className={`dark-mode-toggle ${isDark ? 'active' : ''}`}
    onClick={onToggle}
    aria-label="Toggle dark mode"
  >
    <div className="dark-mode-toggle-slider">
      {isDark ? '🌙' : '☀️'}
    </div>
  </button>
);

// Header Component
const Header = ({
  time,
  date,
  isDarkMode,
  onToggleDarkMode,
  awakeAgentCount,
  totalTaskCount,
  dataSourceMode,
  connectionStatus,
  hasConnectionError,
  telegramStatus
}) => {
  const connectionStatusLabel = {
    [CONNECTION_STATUS.MOCK]: 'MOCK DATA',
    [CONNECTION_STATUS.SYNCING]: 'SYNCING',
    [CONNECTION_STATUS.CONNECTING]: 'CONNECTING',
    [CONNECTION_STATUS.CONNECTED]: 'LIVE',
    [CONNECTION_STATUS.RECONNECTING]: 'RECONNECTING',
    [CONNECTION_STATUS.DISCONNECTED]: 'OFFLINE',
    [CONNECTION_STATUS.FALLBACK]: 'FALLBACK',
    [CONNECTION_STATUS.DISABLED]: 'DISABLED'
  };

  const statusLabel = dataSourceMode === 'mock'
    ? 'MOCK DATA'
    : connectionStatusLabel[connectionStatus] || 'LIVE';

  return (
    <div className="top-header">
      <div className="logo-section">
        <button className="mobile-menu-btn" onClick={() => {
          document.getElementById('agentsSidebar')?.classList.toggle('open');
          document.querySelector('.overlay')?.classList.toggle('active');
        }}>
          ☰
        </button>
        <div className="logo">OC</div>
        <div className="logo-text">MISSION CONTROL</div>
      </div>

      <div className="header-center">
        <div className="stat-item">
          <div className="stat-number">{awakeAgentCount}</div>
          <div className="stat-label">Agents Awake</div>
        </div>
        <div className="stat-item">
          <div className="stat-number">{totalTaskCount}</div>
          <div className="stat-label">Tasks in Queue</div>
        </div>
      </div>

      <div className="header-right">
        <DarkModeToggle isDark={isDarkMode} onToggle={onToggleDarkMode} />
        {telegramStatus?.enabled && (
          <div className={`telegram-status ${telegramStatus?.connected ? 'connected' : 'disconnected'}`} title={telegramStatus?.bot?.username || 'Telegram Bot'}>
            <span className="telegram-icon">📱</span>
            <span className="telegram-label">TG</span>
          </div>
        )}
        <div className="time-display">
          <div className="time-value">{time}</div>
          <div className="time-date">{date}</div>
        </div>
        <div className={`status-badge status-badge-${dataSourceMode} ${hasConnectionError ? 'status-badge-error' : ''}`}>
          <span className="status-dot"></span>
          {statusLabel}
        </div>
      </div>
    </div>
  );
};

const EmergencyStatusBanner = ({ mode, onResumeOperations }) => {
  if (mode === EMERGENCY_MODE.NORMAL) {
    return null;
  }

  const bannerCopy = {
    [EMERGENCY_MODE.STOPPED]: {
      title: 'Emergency stop active',
      detail: 'All agents were paused and task movement is disabled.'
    },
    [EMERGENCY_MODE.LOCKDOWN]: {
      title: 'Lockdown mode active',
      detail: 'External actions are restricted until operations are resumed.'
    },
    [EMERGENCY_MODE.SAFE]: {
      title: 'Safe mode active',
      detail: 'Agents are running with minimal permissions.'
    }
  };

  const { title, detail } = bannerCopy[mode];

  return (
    <div className={`emergency-banner emergency-banner-${mode}`} role="status">
      <div>
        <div className="emergency-banner-title">🚨 {title}</div>
        <div className="emergency-banner-detail">{detail}</div>
      </div>
      <button className="emergency-banner-action" onClick={onResumeOperations}>
        Resume Operations
      </button>
    </div>
  );
};

const EmergencyControls = ({
  emergencyMode,
  onStopAllAgents,
  onLockdownMode,
  onSafeModeRestart,
  onResumeOperations
}) => (
  <div className="emergency-controls">
    <button
      className="emergency-btn emergency-btn-stop"
      onClick={onStopAllAgents}
      disabled={emergencyMode === EMERGENCY_MODE.STOPPED}
      aria-label="Stop all agents"
    >
      🛑 Stop All Agents
    </button>
    <button
      className="emergency-btn emergency-btn-lockdown"
      onClick={onLockdownMode}
      disabled={emergencyMode === EMERGENCY_MODE.LOCKDOWN}
      aria-label="Enable lockdown mode"
    >
      🔒 Lockdown Mode
    </button>
    <button
      className="emergency-btn emergency-btn-safe"
      onClick={onSafeModeRestart}
      disabled={emergencyMode === EMERGENCY_MODE.SAFE}
      aria-label="Restart in safe mode"
    >
      🔄 Safe Restart
    </button>
    <button
      className="emergency-btn emergency-btn-resume"
      onClick={onResumeOperations}
      disabled={emergencyMode === EMERGENCY_MODE.NORMAL}
      aria-label="Resume operations"
    >
      ✅ Resume
    </button>
  </div>
);

// Agent Item Component
const AgentItem = ({ agent, canManage, isBusy, onEdit, onDelete }) => (
  <div className="agent-item">
    <div className="agent-avatar" style={{ background: getAgentColor(agent.name) }}>
      {agent.initial || toAgentInitial(agent.name)}
    </div>
    <div className="agent-info">
      <div className="agent-name">{agent.name}</div>
      <div className="agent-role">{agent.role}</div>
    </div>
    {canManage && (
      <div className="agent-item-actions">
        <button
          type="button"
          className="agent-action-btn"
          onClick={() => onEdit(agent)}
          disabled={isBusy}
          aria-label={`Edit ${agent.name}`}
        >
          Edit
        </button>
        <button
          type="button"
          className="agent-action-btn agent-action-btn-danger"
          onClick={() => onDelete(agent)}
          disabled={isBusy}
          aria-label={`Delete ${agent.name}`}
        >
          Del
        </button>
      </div>
    )}
    <div className={`agent-status status-${agent.status}`}>{agent.status}</div>
  </div>
);

// File Item Component
const FileItem = ({ file, onView }) => (
  <div className="file-item" onClick={() => onView(file)}>
    <div className="file-icon">{file.icon}</div>
    <div className="file-info">
      <div className="file-name">{file.name}</div>
      <div className="file-description">{file.description}</div>
    </div>
    <div className={`file-badge badge-${file.type}`}>{file.type}</div>
  </div>
);

// Files Section Component
const FilesSection = ({ files, onFileView }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="files-section">
      <div className="files-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="files-title">
          <span>📁</span>
          <span>Local Files</span>
        </div>
        <span className={`files-toggle ${isExpanded ? 'open' : ''}`}>▼</span>
      </div>
      <div className={`files-list ${isExpanded ? 'expanded' : ''}`}>
        {files.map((file, index) => (
          <FileItem key={index} file={file} onView={onFileView} />
        ))}
      </div>
    </div>
  );
};

// Agents Sidebar Component
const AgentsSidebar = ({
  agents,
  files,
  tokenUsageData,
  securityData,
  healthData,
  onFileView,
  isOpen,
  onClose,
  expandedMonitor,
  onToggleMonitor,
  onAddAgent,
  onEditAgent,
  onDeleteAgent,
  allowAgentManagement,
  isManagingAgents
}) => (
  <div className={`agents-sidebar ${isOpen ? 'open' : ''}`} id="agentsSidebar">
    <button className="mobile-close-btn" onClick={onClose}>✕</button>
    <div className="sidebar-header">
      <span className="sidebar-title">Agents</span>
      <div className="sidebar-header-actions">
        <span className="agent-count">{agents.length}</span>
        <button type="button" className="add-agent-btn" onClick={onAddAgent}>
          + Add Agent
        </button>
      </div>
    </div>
    <div className="agents-list">
      {agents.map((agent, index) => (
        <AgentItem
          key={agent.id || `${agent.name}-${index}`}
          agent={agent}
          canManage={allowAgentManagement || Boolean(agent.isConfigManaged)}
          isBusy={isManagingAgents}
          onEdit={onEditAgent}
          onDelete={onDeleteAgent}
        />
      ))}
    </div>
    <FilesSection files={files} onFileView={onFileView} />
    <TokenUsageMonitor
      data={tokenUsageData}
      isExpanded={expandedMonitor === 'token'}
      onToggle={() => onToggleMonitor('token')}
    />
    <SecurityDashboard
      data={securityData}
      isExpanded={expandedMonitor === 'security'}
      onToggle={() => onToggleMonitor('security')}
    />
    <AgentHealthMonitor
      agents={agents}
      data={healthData}
      isExpanded={expandedMonitor === 'health'}
      onToggle={() => onToggleMonitor('health')}
    />
  </div>
);

// Task Card Component with Drag & Drop
const TaskCard = ({ task, onDragStart, onDragEnd, onClick, isInteractionLocked }) => {
  return (
    <div
      className={`task-card ${task.column} ${isInteractionLocked ? 'locked' : ''}`}
      draggable={!isInteractionLocked}
      onDragStart={(e) => {
        if (isInteractionLocked) {
          e.preventDefault();
          return;
        }

        onDragStart(e, task);
      }}
      onDragEnd={onDragEnd}
      onClick={() => {
        if (!isInteractionLocked) {
          onClick();
        }
      }}
    >
      <div className="task-title">{task.title}</div>
      <div className="task-description">{task.description}</div>
      <div className="task-footer">
        <div className="task-meta">
          <div className="task-time">
            <span className="time-icon">📅</span>
            {task.time}
          </div>
        </div>
        {task.assignee ? (
          <div className="task-assignee" style={{ background: getAgentColor(task.assignee) }}>
            {task.assigneeInitial}
          </div>
        ) : (
          <div className="unassigned">Unassigned</div>
        )}
      </div>
    </div>
  );
};

// Kanban Column Component with Drop functionality
const KanbanColumn = ({
  title,
  indicator,
  tasks,
  count,
  columnId,
  onDrop,
  onDragOver,
  onDragLeave,
  onTaskClick,
  isInteractionLocked
}) => {
  return (
    <div
      className="kanban-column"
      onDrop={(e) => {
        if (!isInteractionLocked) {
          onDrop(e, columnId);
        }
      }}
      onDragOver={(e) => {
        if (!isInteractionLocked) {
          onDragOver(e);
        }
      }}
      onDragLeave={(e) => {
        if (!isInteractionLocked) {
          onDragLeave(e);
        }
      }}
    >
      <div className="column-header">
        <div className="column-title">
          <span className={`column-indicator indicator-${indicator}`}></span>
          {title}
        </div>
        <span className="column-count">{count}</span>
      </div>
      <div className="cards-container">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onDragStart={(e) => e.dataTransfer.setData('taskId', String(task.id))}
            onDragEnd={(e) => e.currentTarget.classList.remove('dragging')}
            onClick={() => onTaskClick(task)}
            isInteractionLocked={isInteractionLocked}
          />
        ))}
      </div>
    </div>
  );
};

// Feed Item Component
const FeedItem = ({ item }) => (
  <div className="feed-item">
    <div className="feed-avatar" style={{ background: getAgentColor(item.agent) }}>
      {item.agent.charAt(0)}
    </div>
    <div className="feed-details">
      <div className="feed-agent">{item.agent}</div>
      <div className="feed-action">
        <span className={`feed-status-dot dot-${item.status}`}></span>
        {item.action}
      </div>
      <div className="feed-message">"{item.message}"</div>
      <div className="feed-time">{item.time}</div>
    </div>
  </div>
);

// Live Feed Component
const LiveFeed = ({ items, timelineItems, skillIntegrations, memorySpaces, memoryGraphLinks, configurationValidator }) => {
  const [activeTab, setActiveTab] = useState('tasks');
  const [agentFilter, setAgentFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [selectedMemorySpaceId, setSelectedMemorySpaceId] = useState(memorySpaces[0]?.id ?? '');
  const [contextIsolationEnabled, setContextIsolationEnabled] = useState(true);
  const [configIssues, setConfigIssues] = useState(
    Array.isArray(configurationValidator.issues) ? configurationValidator.issues : []
  );

  useEffect(() => {
    if (memorySpaces.length === 0) {
      setSelectedMemorySpaceId('');
      return;
    }

    if (!memorySpaces.some((space) => space.id === selectedMemorySpaceId)) {
      setSelectedMemorySpaceId(memorySpaces[0].id);
    }
  }, [memorySpaces, selectedMemorySpaceId]);

  useEffect(() => {
    setConfigIssues(Array.isArray(configurationValidator.issues) ? configurationValidator.issues : []);
  }, [configurationValidator]);

  const agentFilterOptions = Array.from(new Set(timelineItems.map((item) => item.agent)));
  const typeFilterOptions = Array.from(new Set(timelineItems.map((item) => item.type)));
  const selectedMemorySpace = memorySpaces.find((space) => space.id === selectedMemorySpaceId) || memorySpaces[0];
  const validatedConfigFiles = Array.isArray(configurationValidator.validatedFiles)
    ? configurationValidator.validatedFiles
    : [];
  const memoryTotals = memorySpaces.reduce((acc, space) => ({
    sizeMb: acc.sizeMb + space.sizeMb,
    entries: acc.entries + space.entries,
    staleEntries: acc.staleEntries + space.staleEntries
  }), { sizeMb: 0, entries: 0, staleEntries: 0 });

  const resolvedIssuesCount = configIssues.filter((issue) => issue.status !== 'open').length;
  const baseConfigHealthScore = Number.isFinite(configurationValidator.healthScore)
    ? configurationValidator.healthScore
    : 0;
  const configHealthScore = Math.min(100, baseConfigHealthScore + (resolvedIssuesCount * 2));

  const filteredTimeline = timelineItems.filter((item) => {
    const matchesAgent = agentFilter === 'all' || item.agent === agentFilter;
    const matchesType = typeFilter === 'all' || item.type === typeFilter;
    const searchableText = `${item.agent} ${item.action} ${item.detail}`.toLowerCase();
    const matchesSearch = searchableText.includes(searchText.toLowerCase());

    return matchesAgent && matchesType && matchesSearch;
  });

  const handleExportTimeline = () => {
    window.alert(`Exported ${filteredTimeline.length} timeline events (demo mode).`);
  };

  const handleFixIssue = (issueId) => {
    setConfigIssues((current) => current.map((issue) => {
      if (issue.id !== issueId) {
        return issue;
      }

      const nextStatus = issue.severity === 'review' ? 'reviewing' : 'fixed';
      return { ...issue, status: nextStatus };
    }));
  };

  const handleFixAllIssues = () => {
    setConfigIssues((current) => current.map((issue) => {
      if (issue.severity === 'review') {
        return issue;
      }

      return { ...issue, status: 'fixed' };
    }));
  };

  const handleMemoryCleanup = () => {
    if (!selectedMemorySpace) {
      return;
    }

    window.alert(`Cleanup queued for ${selectedMemorySpace.name} (demo mode).`);
  };

  return (
    <div className="live-feed-sidebar">
      <div className="feed-header">
        <div className="feed-title">
          <span className="live-indicator"></span>
          LIVE FEED
        </div>
        <div className="feed-tabs">
          <div className={`feed-tab ${activeTab === 'tasks' ? 'active' : ''}`} onClick={() => setActiveTab('tasks')}>
            Tasks
          </div>
          <div className={`feed-tab ${activeTab === 'timeline' ? 'active' : ''}`} onClick={() => setActiveTab('timeline')}>
            Timeline
          </div>
          <div className={`feed-tab ${activeTab === 'skills' ? 'active' : ''}`} onClick={() => setActiveTab('skills')}>
            Skills
          </div>
          <div className={`feed-tab ${activeTab === 'memory' ? 'active' : ''}`} onClick={() => setActiveTab('memory')}>
            Memory
          </div>
          <div className={`feed-tab ${activeTab === 'config' ? 'active' : ''}`} onClick={() => setActiveTab('config')}>
            Config
          </div>
        </div>
      </div>
      <div className="feed-content">
        {activeTab === 'tasks' && items.map((item, index) => (
          <FeedItem key={index} item={item} />
        ))}

        {activeTab === 'timeline' && (
          <div className="timeline-panel">
            <div className="timeline-controls">
              <label className="timeline-control">
                Agent
                <select
                  aria-label="Filter timeline by agent"
                  value={agentFilter}
                  onChange={(e) => setAgentFilter(e.target.value)}
                >
                  <option value="all">All agents</option>
                  {agentFilterOptions.map((agent) => (
                    <option key={agent} value={agent}>{agent}</option>
                  ))}
                </select>
              </label>

              <label className="timeline-control">
                Type
                <select
                  aria-label="Filter timeline by type"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                >
                  <option value="all">All types</option>
                  {typeFilterOptions.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </label>

              <label className="timeline-control timeline-control-search">
                Search
                <input
                  aria-label="Search timeline"
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Find an event..."
                />
              </label>

              <button className="timeline-export" onClick={handleExportTimeline}>📥 Export</button>
            </div>

            <div className="timeline-list">
              {filteredTimeline.map((item) => (
                <div key={item.id} className="timeline-item">
                  <div className="timeline-item-time">{item.time}</div>
                  <div className="timeline-item-body">
                    <div className="timeline-item-headline">{item.agent} • {item.action}</div>
                    <div className="timeline-item-detail">{item.detail}</div>
                  </div>
                  <div className={`timeline-item-type timeline-type-${item.type}`}>{item.type}</div>
                </div>
              ))}

              {filteredTimeline.length === 0 && (
                <div className="timeline-empty">No timeline events match your filters.</div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'skills' && (
          <div className="skills-panel">
            {skillIntegrations.map((skill) => (
              <div key={skill.id} className="skill-card">
                <div className="skill-card-header">
                  <div>
                    <div className="skill-name">{skill.name} v{skill.version}</div>
                    <div className="skill-rating">{'★'.repeat(skill.rating)}{'☆'.repeat(5 - skill.rating)}</div>
                  </div>
                  <div className={`skill-security skill-security-${skill.security}`}>
                    {skill.security === 'safe' ? 'Safe' : 'Review needed'}
                  </div>
                </div>
                <div className="skill-summary">{skill.summary}</div>
                <div className="skill-permissions">
                  Permissions: {skill.permissions.join(', ')}
                </div>
                <div className="skill-actions">
                  <button>Configure</button>
                  <button>{skill.updateAvailable ? 'Update' : 'Check Update'}</button>
                  <button>Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'memory' && selectedMemorySpace && (
          <div className="memory-panel">
            <div className="memory-summary-grid">
              <div className="memory-summary-card">
                <div className="memory-summary-value">{memoryTotals.sizeMb.toFixed(1)} MB</div>
                <div className="memory-summary-label">Total Memory</div>
              </div>
              <div className="memory-summary-card">
                <div className="memory-summary-value">{memoryTotals.entries.toLocaleString()}</div>
                <div className="memory-summary-label">Entries</div>
              </div>
              <div className="memory-summary-card">
                <div className="memory-summary-value">{memoryTotals.staleEntries.toLocaleString()}</div>
                <div className="memory-summary-label">Stale</div>
              </div>
            </div>

            <div className="memory-space-list" role="tablist" aria-label="Memory spaces">
              {memorySpaces.map((space) => (
                <button
                  key={space.id}
                  className={`memory-space-chip ${selectedMemorySpaceId === space.id ? 'active' : ''}`}
                  onClick={() => setSelectedMemorySpaceId(space.id)}
                  type="button"
                >
                  {space.name}
                </button>
              ))}
            </div>

            <div className="memory-space-card">
              <div className="memory-space-title">{selectedMemorySpace.name}</div>
              <div className="memory-space-meta">
                {selectedMemorySpace.entries.toLocaleString()} entries • {selectedMemorySpace.sizeMb.toFixed(1)} MB • {selectedMemorySpace.staleEntries} stale
              </div>
              <div className="memory-clusters">
                {selectedMemorySpace.clusters.map((cluster) => (
                  <span key={cluster} className="memory-cluster-pill">{cluster}</span>
                ))}
              </div>
            </div>

            <div className="memory-graph-card">
              <div className="memory-graph-title">Knowledge Graph (Preview)</div>
              <div className="memory-graph-links">
                {memoryGraphLinks.map((link, index) => (
                  <div key={`${link.from}-${link.to}-${index}`} className="memory-graph-link">
                    {link.from} → {link.to}
                  </div>
                ))}
              </div>
            </div>

            <label className="memory-isolation-toggle">
              <input
                type="checkbox"
                checked={contextIsolationEnabled}
                onChange={(e) => setContextIsolationEnabled(e.target.checked)}
              />
              Context isolation enabled
            </label>

            <div className="memory-actions">
              <button type="button" onClick={handleMemoryCleanup}>Cleanup</button>
              <button type="button" onClick={() => window.alert('Export queued (demo mode).')}>Export</button>
              <button type="button" onClick={() => window.alert('Search memory opened (demo mode).')}>Search</button>
            </div>
          </div>
        )}

        {activeTab === 'config' && (
          <div className="config-panel">
            <div className="config-score-card">
              <div className="config-score-label">Configuration Health Score</div>
              <div className="config-score-value">{configHealthScore}/100</div>
              <div className="config-score-bar">
                <div className="config-score-fill" style={{ width: `${configHealthScore}%` }}></div>
              </div>
            </div>

            <div className="config-issues">
              {configIssues.map((issue) => (
                <div key={issue.id} className={`config-issue config-issue-${issue.severity}`}>
                  <div>
                    <div className="config-issue-title">{issue.title}</div>
                    <div className="config-issue-suggestion">{issue.suggestion}</div>
                    <div className="config-issue-status">Status: {issue.status}</div>
                  </div>
                  <button type="button" onClick={() => handleFixIssue(issue.id)}>
                    {issue.autoFixLabel}
                  </button>
                </div>
              ))}
            </div>

            <div className="config-files">
              <div className="config-files-title">Validated Files</div>
              {validatedConfigFiles.map((file) => (
                <div key={file.name} className="config-file-item">
                  <span>{file.name}</span>
                  <span className={`config-file-status config-file-status-${file.status}`}>{file.status}</span>
                </div>
              ))}
            </div>

            <button type="button" className="config-fix-all" onClick={handleFixAllIssues}>
              Fix All Issues
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// LocalStorage keys
const AGENTS_STORAGE_KEY = 'openclaw.agents';
const TASKS_STORAGE_KEY = 'openclaw.tasks';

// Load from localStorage
const loadFromStorage = (key, fallback) => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
};

// Save to localStorage
const saveToStorage = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to save to localStorage:', e);
  }
};

// Main Mission Control Component
const MissionControl = () => {
  const shouldUseSeedData = !runtimeConfig.liveDataEnabled;

  const [time, setTime] = useState('');
  const [date, setDate] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [overlayActive, setOverlayActive] = useState(false);
  
  // Load agents from localStorage or use seed data
  const [agents, setAgents] = useState(() => {
    if (shouldUseSeedData) {
      const stored = loadFromStorage(AGENTS_STORAGE_KEY, null);
      return stored || initialAgents;
    }
    return [];
  });
  
  // Save agents to localStorage when they change (in mock mode)
  useEffect(() => {
    if (shouldUseSeedData) {
      saveToStorage(AGENTS_STORAGE_KEY, agents);
    }
  }, [agents, shouldUseSeedData]);
  
  const [files, setFiles] = useState(() => (shouldUseSeedData ? initialFiles : []));
  const [tasks, setTasks] = useState(() => loadFromStorage(TASKS_STORAGE_KEY, shouldUseSeedData ? initialTasks : []));
  
  // Save tasks to localStorage when they change (in mock mode)
  useEffect(() => {
    if (shouldUseSeedData) {
      saveToStorage(TASKS_STORAGE_KEY, tasks);
    }
  }, [tasks, shouldUseSeedData]);
  const [feedItems, setFeedItems] = useState(() => (shouldUseSeedData ? initialFeedItems : []));
  const [chatMessages, setChatMessages] = useState(() => (shouldUseSeedData ? initialMissionChat : []));
  const [timelineItems, setTimelineItems] = useState(() => (shouldUseSeedData ? initialAuditTimeline : []));
  const [skillIntegrations, setSkillIntegrations] = useState(() => (shouldUseSeedData ? initialSkillIntegrations : []));
  const [memorySpaces, setMemorySpaces] = useState(() => (shouldUseSeedData ? initialMemorySpaces : []));
  const [memoryGraphLinks, setMemoryGraphLinks] = useState(() => (shouldUseSeedData ? initialMemoryGraphLinks : []));
  const [configurationValidatorState, setConfigurationValidatorState] = useState(
    () => (shouldUseSeedData ? configurationValidatorData : EMPTY_CONFIGURATION_VALIDATOR)
  );
  const [tokenUsageState, setTokenUsageState] = useState(EMPTY_TOKEN_USAGE);
  const [securityState, setSecurityState] = useState(EMPTY_SECURITY);
  const [healthState, setHealthState] = useState(EMPTY_HEALTH);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedMode = window.localStorage.getItem(DARK_MODE_STORAGE_KEY);
    return savedMode === 'true';
  });
  const [expandedMonitor, setExpandedMonitor] = useState('token');
  const [emergencyMode, setEmergencyMode] = useState(EMERGENCY_MODE.NORMAL);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [isAddAgentModalOpen, setIsAddAgentModalOpen] = useState(false);
  const [isAddingAgent, setIsAddingAgent] = useState(false);
  const [addAgentError, setAddAgentError] = useState('');
  const [isEditAgentModalOpen, setIsEditAgentModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null);
  const [isEditingAgent, setIsEditingAgent] = useState(false);
  const [editAgentError, setEditAgentError] = useState('');
  const [telegramStatus, setTelegramStatus] = useState({
    enabled: false,
    connected: false,
    bot: null
  });
  const [connectionState, setConnectionState] = useState(() => (
    runtimeConfig.liveDataEnabled
      ? {
        mode: 'live',
        status: CONNECTION_STATUS.SYNCING,
        lastSyncAt: null,
        error: null
      }
      : {
        mode: 'mock',
        status: CONNECTION_STATUS.MOCK,
        lastSyncAt: null,
        error: null
      }
  ));

  const isInteractionLocked = emergencyMode === EMERGENCY_MODE.LOCKDOWN || emergencyMode === EMERGENCY_MODE.STOPPED;

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
      const dateStr = now.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      }).toUpperCase();
      
      setTime(timeStr);
      setDate(dateStr);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }

    window.localStorage.setItem(DARK_MODE_STORAGE_KEY, String(isDarkMode));
  }, [isDarkMode]);

  const reportIntegrationError = useCallback((error) => {
    setConnectionState((current) => ({
      ...current,
      error: error?.message || 'OpenClaw integration error.'
    }));
  }, []);

  const applyMissionSnapshot = useCallback((snapshot) => {
    if (!snapshot || typeof snapshot !== 'object') {
      return;
    }

    if (Array.isArray(snapshot.agents)) {
      setAgents(snapshot.agents);
    }

    if (Array.isArray(snapshot.localFiles)) {
      setFiles(snapshot.localFiles);
    }

    if (Array.isArray(snapshot.tasks)) {
      setTasks(snapshot.tasks);
    }

    if (Array.isArray(snapshot.feedItems)) {
      setFeedItems(snapshot.feedItems);
    }

    if (Array.isArray(snapshot.chatMessages)) {
      setChatMessages((current) => mergeChatMessages(current, snapshot.chatMessages));
    } else if (Array.isArray(snapshot.missionChat)) {
      setChatMessages((current) => mergeChatMessages(current, snapshot.missionChat));
    }

    if (Array.isArray(snapshot.timelineItems)) {
      setTimelineItems(snapshot.timelineItems);
    }

    if (Array.isArray(snapshot.skillIntegrations)) {
      setSkillIntegrations(snapshot.skillIntegrations);
    }

    if (Array.isArray(snapshot.memorySpaces)) {
      setMemorySpaces(snapshot.memorySpaces);
    }

    if (Array.isArray(snapshot.memoryGraphLinks)) {
      setMemoryGraphLinks(snapshot.memoryGraphLinks);
    }

    if (snapshot.configurationValidator && typeof snapshot.configurationValidator === 'object') {
      setConfigurationValidatorState(snapshot.configurationValidator);
    }

    if (snapshot.tokenUsage && typeof snapshot.tokenUsage === 'object') {
      setTokenUsageState(snapshot.tokenUsage);
    }

    if (snapshot.security && typeof snapshot.security === 'object') {
      setSecurityState(snapshot.security);
    }

    if (snapshot.health && typeof snapshot.health === 'object') {
      setHealthState(snapshot.health);
    }

    if (typeof snapshot.emergencyMode === 'string' && Object.values(EMERGENCY_MODE).includes(snapshot.emergencyMode)) {
      setEmergencyMode(snapshot.emergencyMode);
    }

    setConnectionState((current) => ({
      ...current,
      mode: 'live',
      status: current.status === CONNECTION_STATUS.DISCONNECTED ? CONNECTION_STATUS.CONNECTING : current.status,
      lastSyncAt: new Date().toISOString(),
      error: null
    }));
  }, []);

  useEffect(() => {
    if (!runtimeConfig.liveDataEnabled) {
      return undefined;
    }

    let isMounted = true;

    const hydrateMissionSnapshot = async () => {
      try {
        const snapshot = await fetchMissionSnapshot();

        if (!isMounted) {
          return;
        }

        applyMissionSnapshot(snapshot);
        setConnectionState((current) => ({
          ...current,
          mode: 'live',
          status: CONNECTION_STATUS.CONNECTED,
          lastSyncAt: new Date().toISOString(),
          error: null
        }));
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setConnectionState((current) => ({
          ...current,
          mode: 'mock',
          status: CONNECTION_STATUS.FALLBACK,
          error: error?.message || 'Failed to load live OpenClaw snapshot.'
        }));
      }
    };

    hydrateMissionSnapshot();
    const refreshInterval = window.setInterval(hydrateMissionSnapshot, 30000);

    const realtimeClient = createOpenClawRealtimeClient({
      onStatusChange: (status) => {
        if (!isMounted) {
          return;
        }

        setConnectionState((current) => ({
          ...current,
          status
        }));
      },
      onError: (error) => {
        if (!isMounted) {
          return;
        }

        reportIntegrationError(error);
      },
      onEvent: (event) => {
        if (!isMounted || !event || typeof event !== 'object') {
          return;
        }

        const { type, payload } = event;

        switch (type) {
          case 'mission.snapshot':
            applyMissionSnapshot(payload);
            break;
          case 'mission.timeline.append':
            if (payload && typeof payload === 'object') {
              setTimelineItems((current) => [payload, ...current]);
            }
            break;
          case 'mission.chat.append':
            if (payload && typeof payload === 'object') {
              setChatMessages((current) => mergeChatMessages(current, [payload]));
            }
            break;
          case 'mission.tasks.replace':
            if (payload && Array.isArray(payload.tasks)) {
              setTasks(payload.tasks);
            }
            break;
          case 'mission.agents.replace':
            if (payload && Array.isArray(payload.agents)) {
              setAgents(payload.agents);
            }
            break;
          default:
            break;
        }
      }
    });

    realtimeClient.connect();

    return () => {
      isMounted = false;
      window.clearInterval(refreshInterval);
      realtimeClient.disconnect();
    };
  }, [applyMissionSnapshot, reportIntegrationError]);

  // Fetch Telegram status
  useEffect(() => {
    if (!runtimeConfig.liveDataEnabled) {
      return undefined;
    }

    let isMounted = true;

    const fetchStatus = async () => {
      try {
        const status = await fetchTelegramStatus();
        if (isMounted && status) {
          setTelegramStatus({
            enabled: status.enabled || false,
            connected: status.connected || false,
            bot: status.bot || null
          });
        }
      } catch {
        // Silently ignore errors
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!isChatOpen) {
      return undefined;
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsChatOpen(false);
      }
    };

    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isChatOpen]);

  const handleFileView = (file) => {
    alert(`📄 ${file.name}\n\n${file.description}\n\nType: ${file.type}\nLast modified: ${file.lastModified}\n\nClick to open and edit this file in your local editor.`);
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
    setOverlayActive(!overlayActive);
  };

  const handleToggleMonitor = (monitorKey) => {
    setExpandedMonitor((current) => (current === monitorKey ? null : monitorKey));
  };

  const handleOpenAddAgentModal = () => {
    setAddAgentError('');
    setIsAddAgentModalOpen(true);
  };

  const handleCloseAddAgentModal = () => {
    if (isAddingAgent) {
      return;
    }

    setIsAddAgentModalOpen(false);
    setAddAgentError('');
  };

  const pushTimelineEvent = ({ type, action, detail }) => {
    const timestamp = new Date();
    const formattedTime = timestamp.toLocaleTimeString('en-US', { hour12: false });

    setTimelineItems((current) => [
      {
        id: Number(timestamp),
        time: formattedTime,
        agent: 'System',
        type,
        action,
        detail
      },
      ...current
    ]);
  };

  const handleAddAgent = async (agentInput) => {
    const normalizedName = normalizeAgentName(agentInput?.name);
    const normalizedRole = normalizeAgentName(agentInput?.role);
    const normalizedModel = normalizeAgentName(agentInput?.model);
    const normalizedApiKey = String(agentInput?.apiKey || '').trim();

    if (!normalizedName || !normalizedRole || !normalizedModel || !normalizedApiKey) {
      setAddAgentError('All fields are required to add an agent.');
      return;
    }

    if (agents.some((agent) => String(agent.name || '').toLowerCase() === normalizedName.toLowerCase())) {
      setAddAgentError('Agent name already exists.');
      return;
    }

    setIsAddingAgent(true);
    setAddAgentError('');

    const createdAgentFallback = {
      id: `agent-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      name: normalizedName,
      role: normalizedRole,
      status: 'working',
      initial: toAgentInitial(normalizedName),
      model: normalizedModel
    };

    if (!runtimeConfig.liveDataEnabled || dataSourceMode !== 'live') {
      setAgents((currentAgents) => [...currentAgents, createdAgentFallback]);
      pushTimelineEvent({
        type: 'workflow',
        action: `Agent added: ${normalizedName}`,
        detail: `Running in mock mode. ${normalizedRole} configured on ${normalizedModel}.`
      });
      setIsAddAgentModalOpen(false);
      setIsAddingAgent(false);
      return;
    }

    try {
      const response = await postCreateAgent({
        name: normalizedName,
        role: normalizedRole,
        model: normalizedModel,
        apiKey: normalizedApiKey
      });

      if (response?.snapshot && typeof response.snapshot === 'object') {
        applyMissionSnapshot(response.snapshot);
      } else if (response?.agent && typeof response.agent === 'object') {
        setAgents((currentAgents) => [...currentAgents, {
          name: response.agent.name || createdAgentFallback.name,
          role: response.agent.role || createdAgentFallback.role,
          status: response.agent.status || 'working',
          initial: response.agent.initial || toAgentInitial(response.agent.name || createdAgentFallback.name),
          model: response.agent.model || createdAgentFallback.model
        }]);
      } else {
        setAgents((currentAgents) => [...currentAgents, createdAgentFallback]);
      }

      pushTimelineEvent({
        type: 'workflow',
        action: `Agent added: ${normalizedName}`,
        detail: `${normalizedRole} configured on ${normalizedModel} and set to working.`
      });

      setIsAddAgentModalOpen(false);
      setAddAgentError('');
    } catch (error) {
      reportIntegrationError(error);
      setAddAgentError(error?.message || 'Failed to add agent.');
    } finally {
      setIsAddingAgent(false);
    }
  };

  const handleOpenEditAgentModal = (agent) => {
    setEditingAgent(agent);
    setEditAgentError('');
    setIsEditAgentModalOpen(true);
  };

  const handleCloseEditAgentModal = () => {
    if (isEditingAgent) {
      return;
    }
    setIsEditAgentModalOpen(false);
    setEditingAgent(null);
    setEditAgentError('');
  };

  const handleEditAgent = async (agentPayload) => {
    const agentId = agentPayload?.id || editingAgent?.id;
    const normalizedName = normalizeAgentName(agentPayload?.name);
    const normalizedRole = normalizeAgentName(agentPayload?.role);
    const normalizedModel = normalizeAgentName(agentPayload?.model);
    const normalizedApiKey = String(agentPayload?.apiKey || '').trim();

    if (!normalizedName || !normalizedRole || !normalizedModel) {
      setEditAgentError('Agent name, role, and model are required.');
      return;
    }

    // Check for duplicate name (excluding current agent)
    if (agents.some((agent) => 
      String(agent.name || '').toLowerCase() === normalizedName.toLowerCase() &&
      agent.id !== agentId
    )) {
      setEditAgentError('Agent name already exists.');
      return;
    }

    setIsEditingAgent(true);
    setEditAgentError('');

    const updatedAgentFallback = {
      ...editingAgent,
      name: normalizedName,
      role: normalizedRole,
      model: normalizedModel,
      initial: toAgentInitial(normalizedName)
    };

    if (!runtimeConfig.liveDataEnabled || dataSourceMode !== 'live') {
      setAgents((currentAgents) =>
        currentAgents.map((agent) =>
          agent.id === agentId ? updatedAgentFallback : agent
        )
      );
      pushTimelineEvent({
        type: 'workflow',
        action: `Agent updated: ${normalizedName}`,
        detail: `Running in mock mode. ${normalizedRole} configured on ${normalizedModel}.`
      });
      setIsEditAgentModalOpen(false);
      setEditingAgent(null);
      setIsEditingAgent(false);
      return;
    }

    try {
      const response = await putUpdateAgent(agentId, {
        name: normalizedName,
        role: normalizedRole,
        model: normalizedModel,
        ...(normalizedApiKey && { apiKey: normalizedApiKey })
      });

      if (response?.snapshot && typeof response.snapshot === 'object') {
        applyMissionSnapshot(response.snapshot);
      } else if (response?.agent && typeof response.agent === 'object') {
        setAgents((currentAgents) =>
          currentAgents.map((agent) =>
            agent.id === agentId
              ? {
                  ...agent,
                  name: response.agent.name || updatedAgentFallback.name,
                  role: response.agent.role || updatedAgentFallback.role,
                  model: response.agent.model || updatedAgentFallback.model,
                  initial: response.agent.initial || toAgentInitial(response.agent.name || updatedAgentFallback.name)
                }
              : agent
          )
        );
      } else {
        setAgents((currentAgents) =>
          currentAgents.map((agent) =>
            agent.id === agentId ? updatedAgentFallback : agent
          )
        );
      }

      pushTimelineEvent({
        type: 'workflow',
        action: `Agent updated: ${normalizedName}`,
        detail: `${normalizedRole} configured on ${normalizedModel}.`
      });

      setIsEditAgentModalOpen(false);
      setEditingAgent(null);
      setEditAgentError('');
    } catch (error) {
      reportIntegrationError(error);
      setEditAgentError(error?.message || 'Failed to update agent.');
    } finally {
      setIsEditingAgent(false);
    }
  };

  const handleDeleteAgent = async (agent) => {
    const agentId = agent?.id;
    const agentName = agent?.name;

    if (!agentId) {
      return;
    }

    const confirmDelete = window.confirm(
      `Are you sure you want to delete agent "${agentName}"? This action cannot be undone.`
    );

    if (!confirmDelete) {
      return;
    }

    setIsEditingAgent(true);

    if (!runtimeConfig.liveDataEnabled || dataSourceMode !== 'live') {
      setAgents((currentAgents) => currentAgents.filter((a) => a.id !== agentId));
      pushTimelineEvent({
        type: 'workflow',
        action: `Agent deleted: ${agentName}`,
        detail: 'Running in mock mode. Agent removed from roster.'
      });
      setIsEditingAgent(false);
      return;
    }

    try {
      await deleteAgentById(agentId);
      setAgents((currentAgents) => currentAgents.filter((a) => a.id !== agentId));
      pushTimelineEvent({
        type: 'workflow',
        action: `Agent deleted: ${agentName}`,
        detail: 'Agent removed from roster.'
      });
    } catch (error) {
      reportIntegrationError(error);
      alert(`Failed to delete agent: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsEditingAgent(false);
    }
  };

  const handleStopAllAgents = () => {
    setEmergencyMode(EMERGENCY_MODE.STOPPED);
    setSelectedTask(null);
    setAgents((currentAgents) => currentAgents.map((agent) => ({ ...agent, status: 'idle' })));
    pushTimelineEvent({
      type: 'safety',
      action: 'Emergency stop activated',
      detail: 'All agents moved to idle and board interactions are paused.'
    });

    if (runtimeConfig.liveDataEnabled) {
      postEmergencyAction('stop').catch(reportIntegrationError);
    }
  };

  const handleLockdownMode = () => {
    setEmergencyMode(EMERGENCY_MODE.LOCKDOWN);
    setSelectedTask(null);
    pushTimelineEvent({
      type: 'security',
      action: 'Lockdown mode enabled',
      detail: 'Task interactions restricted until operators resume normal mode.'
    });

    if (runtimeConfig.liveDataEnabled) {
      postEmergencyAction('lockdown').catch(reportIntegrationError);
    }
  };

  const handleSafeModeRestart = () => {
    setEmergencyMode(EMERGENCY_MODE.SAFE);
    setAgents((currentAgents) => currentAgents.map((agent) => ({
      ...agent,
      status: agent.name === 'Jarvis' ? 'awake' : 'idle'
    })));
    pushTimelineEvent({
      type: 'safety',
      action: 'Safe mode restart completed',
      detail: 'Only core orchestration tasks are active while dependencies are validated.'
    });

    if (runtimeConfig.liveDataEnabled) {
      postEmergencyAction('safe-restart').catch(reportIntegrationError);
    }
  };

  const handleResumeOperations = () => {
    setEmergencyMode(EMERGENCY_MODE.NORMAL);
    setAgents((currentAgents) => currentAgents.map((agent) => ({
      ...agent,
      status: agent.status === 'working' ? 'working' : (agent.name === 'Jarvis' ? 'awake' : 'idle')
    })));
    pushTimelineEvent({
      type: 'workflow',
      action: 'Operations resumed',
      detail: 'Emergency restrictions lifted and normal mission flow restored.'
    });

    if (runtimeConfig.liveDataEnabled) {
      postEmergencyAction('resume').catch(reportIntegrationError);
    }
  };

  const handleDrop = (e, newColumn) => {
    if (isInteractionLocked) {
      return;
    }

    e.preventDefault();
    const taskId = normalizeTaskId(e.dataTransfer.getData('taskId'));

    if (!taskId) {
      e.currentTarget.classList.remove('drag-over');
      return;
    }
    
    setTasks(prevTasks =>
      prevTasks.map(task =>
        taskIdsMatch(task.id, taskId) ? { ...task, column: newColumn } : task
      )
    );

    if (runtimeConfig.liveDataEnabled) {
      postTaskColumnUpdate(taskId, newColumn).catch(reportIntegrationError);
    }

    e.currentTarget.classList.remove('drag-over');
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
  };

  const handleDragLeave = (e) => {
    e.currentTarget.classList.remove('drag-over');
  };

  const handleTaskClick = (task) => {
    if (isInteractionLocked) {
      return;
    }

    setSelectedTask(task);
  };

  const handleSaveTask = (updatedTask) => {
    setTasks(prevTasks =>
      prevTasks.map(task =>
        taskIdsMatch(task.id, updatedTask.id) ? updatedTask : task
      )
    );

    if (runtimeConfig.liveDataEnabled) {
      postTaskUpdate(updatedTask).catch(reportIntegrationError);
    }

    setSelectedTask(null);
  };

  const handleDeleteTask = (taskId) => {
    setTasks(prevTasks => prevTasks.filter(task => !taskIdsMatch(task.id, taskId)));

    if (runtimeConfig.liveDataEnabled) {
      deleteTaskById(taskId).catch(reportIntegrationError);
    }

    setSelectedTask(null);
  };

  const handleToggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  const appendChatMessage = useCallback((message) => {
    if (!message || typeof message !== 'object') {
      return;
    }

    setChatMessages((current) => {
      const incomingId = normalizeMessageId(message.id);
      if (incomingId) {
        return mergeChatMessages(current, [message]);
      }

      return [...current, { ...message, id: `chat-${Date.now()}-${Math.random().toString(16).slice(2, 7)}` }];
    });
  }, []);

  const handleSendChatMessage = async (messageText) => {
    const userMessage = {
      id: `chat-user-${Date.now()}`,
      role: 'user',
      author: 'You',
      message: messageText,
      time: getChatTimestamp()
    };

    appendChatMessage(userMessage);

    // Check if MiniMax is configured
    if (minimaxConfig.isConfigured()) {
      setIsSendingChat(true);
      try {
        // Get conversation history for context
        const history = chatMessages.slice(-10).map(msg => ({
          role: msg.role,
          message: msg.message
        }));
        
        const response = await sendMessageToMiniMax(messageText, history);
        
        const aiReply = {
          id: `chat-minimax-${Date.now()}`,
          role: 'assistant',
          author: 'Mark',
          message: response.message,
          time: getChatTimestamp()
        };
        
        appendChatMessage(aiReply);
        setIsSendingChat(false);
        return;
      } catch (error) {
        console.error('MiniMax error:', error);
        // Fall through to other options
        setIsSendingChat(false);
      }
    }

    if (dataSourceMode === 'mock' || !runtimeConfig.liveDataEnabled) {
      const localReply = {
        id: `chat-local-${Date.now()}`,
        role: 'assistant',
        author: 'Mark',
        message: `Hi! I'm Mark 🏃\n\nI'm the AI assistant here in Mission Board! To chat with me:\n\n1. Add your MiniMax API key to the .env file\n2. Set REACT_APP_MINIMAX_API_KEY=your_key\n\nOr connect to a live OpenClaw backend.\n\nTry setting up the API and let's chat!`,
        time: getChatTimestamp()
      };

      appendChatMessage(localReply);
      return;
    }

    setIsSendingChat(true);

    try {
      const chatResponse = await postMissionChatMessage(messageText, {
        author: userMessage.author,
        messageId: userMessage.id,
        source: 'dashboard'
      });
      const replyPayload = chatResponse?.reply;

      if (replyPayload && typeof replyPayload === 'object') {
        appendChatMessage({
          id: replyPayload.id || `chat-assistant-${Date.now()}`,
          role: replyPayload.role || 'assistant',
          author: replyPayload.author || 'Jarvis',
          message: replyPayload.message || '',
          time: replyPayload.time || getChatTimestamp()
        });
      } else if (typeof replyPayload === 'string' && replyPayload.trim()) {
        appendChatMessage({
          id: `chat-assistant-${Date.now()}`,
          role: 'assistant',
          author: 'Jarvis',
          message: replyPayload,
          time: getChatTimestamp()
        });
      }
    } catch (error) {
      reportIntegrationError(error);
      appendChatMessage({
        id: `chat-error-${Date.now()}`,
        role: 'system',
        author: 'System',
        message: 'Chat request failed because the OpenClaw backend is unreachable.',
        time: getChatTimestamp()
      });
    } finally {
      setIsSendingChat(false);
    }
  };

  // Group tasks by column
  const inboxTasks = tasks.filter(t => t.column === 'inbox');
  const assignedTasks = tasks.filter(t => t.column === 'assigned');
  const progressTasks = tasks.filter(t => t.column === 'progress');
  const reviewTasks = tasks.filter(t => t.column === 'review');
  const awakeAgentCount = agents.filter((agent) => (
    agent.status === 'awake' || agent.status === 'working'
  )).length;
  const dataSourceMode = connectionState.mode;

  return (
    <div className="mission-control">
      <Header 
        time={time} 
        date={date} 
        isDarkMode={isDarkMode}
        onToggleDarkMode={handleToggleDarkMode}
        awakeAgentCount={awakeAgentCount}
        totalTaskCount={tasks.length}
        dataSourceMode={dataSourceMode}
        connectionStatus={connectionState.status}
        hasConnectionError={Boolean(connectionState.error)}
        telegramStatus={telegramStatus}
      />

      <EmergencyStatusBanner mode={emergencyMode} onResumeOperations={handleResumeOperations} />
      
      <div className={`overlay ${overlayActive ? 'active' : ''}`} onClick={toggleSidebar}></div>
      
      <div className="main-container">
        <AgentsSidebar 
          agents={agents} 
          files={files} 
          tokenUsageData={tokenUsageState}
          securityData={securityState}
          healthData={healthState}
          onFileView={handleFileView}
          isOpen={sidebarOpen}
          onClose={toggleSidebar}
          expandedMonitor={expandedMonitor}
          onToggleMonitor={handleToggleMonitor}
          onAddAgent={handleOpenAddAgentModal}
          onEditAgent={handleOpenEditAgentModal}
          onDeleteAgent={handleDeleteAgent}
          allowAgentManagement={runtimeConfig.liveDataEnabled}
          isManagingAgents={isAddingAgent || isEditingAgent}
        />
        
        <div className="mission-board">
          <div className="board-header">
            <div className="board-title-row">
              <div className="board-title">MISSION QUEUE</div>
              <span className={`data-source-pill data-source-pill-${dataSourceMode}`}>
                {dataSourceMode === 'live' ? 'Live data' : 'Mock data'}
              </span>
              {isInteractionLocked && <span className="interaction-lock-pill">Interaction locked</span>}
            </div>
            {connectionState.error && (
              <div className="connection-error-banner">{connectionState.error}</div>
            )}
            <EmergencyControls
              emergencyMode={emergencyMode}
              onStopAllAgents={handleStopAllAgents}
              onLockdownMode={handleLockdownMode}
              onSafeModeRestart={handleSafeModeRestart}
              onResumeOperations={handleResumeOperations}
            />
          </div>
          
          <div className="kanban-container">
            <KanbanColumn 
              title="INBOX" 
              indicator="inbox" 
              tasks={inboxTasks} 
              count={inboxTasks.length}
              columnId="inbox"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onTaskClick={handleTaskClick}
              isInteractionLocked={isInteractionLocked}
            />
            <KanbanColumn 
              title="ASSIGNED" 
              indicator="assigned" 
              tasks={assignedTasks} 
              count={assignedTasks.length}
              columnId="assigned"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onTaskClick={handleTaskClick}
              isInteractionLocked={isInteractionLocked}
            />
            <KanbanColumn 
              title="IN PROGRESS" 
              indicator="progress" 
              tasks={progressTasks} 
              count={progressTasks.length}
              columnId="progress"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onTaskClick={handleTaskClick}
              isInteractionLocked={isInteractionLocked}
            />
            <KanbanColumn 
              title="REVIEW" 
              indicator="review" 
              tasks={reviewTasks} 
              count={reviewTasks.length}
              columnId="review"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onTaskClick={handleTaskClick}
              isInteractionLocked={isInteractionLocked}
            />
          </div>
        </div>
        
        <LiveFeed
          items={feedItems}
          timelineItems={timelineItems}
          skillIntegrations={skillIntegrations}
          memorySpaces={memorySpaces}
          memoryGraphLinks={memoryGraphLinks}
          configurationValidator={configurationValidatorState}
        />
      </div>

      <MissionChatSection
        messages={chatMessages}
        onSendMessage={handleSendChatMessage}
        isSending={isSendingChat}
        dataSourceMode={dataSourceMode}
        connectionStatus={connectionState.status}
        isOpen={isChatOpen}
        onOpen={() => setIsChatOpen(true)}
        onClose={() => setIsChatOpen(false)}
      />

      {selectedTask && (
        <TaskModal
          task={selectedTask}
          agents={agents}
          onClose={() => setSelectedTask(null)}
          onSave={handleSaveTask}
          onDelete={handleDeleteTask}
        />
      )}

      {isAddAgentModalOpen && (
        <AddAgentModal
          onClose={handleCloseAddAgentModal}
          onSubmit={handleAddAgent}
          isSubmitting={isAddingAgent}
          errorMessage={addAgentError}
        />
      )}

      {isEditAgentModalOpen && editingAgent && (
        <EditAgentModal
          agent={editingAgent}
          onClose={handleCloseEditAgentModal}
          onSubmit={handleEditAgent}
          isSubmitting={isEditingAgent}
          errorMessage={editAgentError}
        />
      )}
    </div>
  );
};

export default MissionControl;
