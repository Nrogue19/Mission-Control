import React, { useState, useEffect } from 'react';
import './MissionControl.css';

// Agent colors configuration
const agentColors = {
  'Jarvis': '#ec4899',
  'Friday': '#f59e0b',
  'Fury': '#8b5cf6',
  'Coach': '#10b981',
  'Loki': '#f59e0b',
  'Pepper': '#ef4444',
  'Quill': '#f59e0b',
  'Shuri': '#ec4899',
  'Vision': '#6366f1',
  'Wanda': '#10b981',
  'Wong': '#10b981'
};

// Sample data
const initialAgents = [
  { name: 'Jarvis', role: 'Squad Lead', status: 'awake', initial: 'J' },
  { name: 'Friday', role: 'Developer', status: 'idle', initial: 'F' },
  { name: 'Fury', role: 'Customer Researcher', status: 'idle', initial: 'F' },
  { name: 'Coach', role: 'Coach Entrepreneur', status: 'idle', initial: 'C' },
  { name: 'Loki', role: 'Content Writer', status: 'idle', initial: 'L' },
  { name: 'Pepper', role: 'Email Marketing Spec', status: 'idle', initial: 'P' },
  { name: 'Quill', role: 'Social Media Manager', status: 'idle', initial: 'Q' },
  { name: 'Shuri', role: 'Product Analyst', status: 'idle', initial: 'S' },
  { name: 'Vision', role: 'SEO Analyst', status: 'idle', initial: 'V' },
  { name: 'Wanda', role: 'Designer', status: 'idle', initial: 'W' },
  { name: 'Wong', role: 'Documentation Spec', status: 'idle', initial: 'W' }
];

const initialFiles = [
  {
    name: 'USER.md',
    description: 'User profile & preferences',
    icon: '👤',
    type: 'config',
    lastModified: '2 hours ago'
  },
  {
    name: 'AGENT.md',
    description: 'Agent configuration',
    icon: '🤖',
    type: 'config',
    lastModified: '1 day ago'
  },
  {
    name: 'SOUL.md',
    description: 'Personality & behavior rules',
    icon: '✨',
    type: 'config',
    lastModified: '3 days ago'
  },
  {
    name: 'HEARTBEAT.md',
    description: 'Background monitoring checklist',
    icon: '💓',
    type: 'schedule',
    lastModified: '5 hours ago'
  },
  {
    name: 'MEMORY.md',
    description: 'Long-term memory storage',
    icon: '🧠',
    type: 'data',
    lastModified: '30 mins ago'
  },
  {
    name: 'CRON.md',
    description: 'Scheduled tasks & jobs',
    icon: '⏰',
    type: 'schedule',
    lastModified: '1 day ago'
  },
  {
    name: 'TOOLS.md',
    description: 'Tool configurations',
    icon: '🔧',
    type: 'config',
    lastModified: '2 days ago'
  }
];

const initialTasks = [
  {
    id: 1,
    column: 'inbox',
    title: 'Review testimonials section design',
    description: 'Review and modernize the testimonials section of the website...',
    time: 'Feb 14',
    assignee: null
  },
  {
    id: 2,
    column: 'inbox',
    title: 'Add FAQ section',
    description: 'Create a new FAQ section with frequently asked questions...',
    time: 'Feb 15',
    assignee: null
  },
  {
    id: 3,
    column: 'assigned',
    title: 'Fix ARIA accessibility',
    description: 'Add ARIA labels, alt text on all images, and improve accessibility...',
    time: 'Feb 10',
    assignee: 'Wanda',
    assigneeInitial: 'W'
  },
  {
    id: 4,
    column: 'assigned',
    title: 'Improve mobile menu animation',
    description: 'Improve transitions and animations of the mobile burger menu...',
    time: 'Feb 11',
    assignee: 'Vision',
    assigneeInitial: 'V'
  },
  {
    id: 5,
    column: 'assigned',
    title: 'Add floating WhatsApp button',
    description: 'Add a floating WhatsApp button at the bottom right of the page...',
    time: 'Feb 11',
    assignee: 'Loki',
    assigneeInitial: 'L'
  },
  {
    id: 6,
    column: 'assigned',
    title: 'Optimize loading performance',
    description: 'Optimize page loading speed and improve performance metrics...',
    time: 'Feb 10',
    assignee: 'Quill',
    assigneeInitial: 'Q'
  },
  {
    id: 7,
    column: 'progress',
    title: 'Optimize website images',
    description: 'Compress and convert all images in the folder for better performance...',
    time: 'Feb 9',
    assignee: 'Shuri',
    assigneeInitial: 'S'
  },
  {
    id: 8,
    column: 'review',
    title: 'Add SEO meta tags and Open Graph',
    description: 'Add meta tags for SEO (description, keywords) and social sharing...',
    time: 'Feb 10',
    assignee: 'Friday',
    assigneeInitial: 'F'
  }
];

const initialFeedItems = [
  {
    agent: 'Jarvis',
    action: 'message sent',
    message: 'Commented on task',
    time: 'about 4 days ago',
    status: 'yellow'
  },
  {
    agent: 'Jarvis',
    action: 'task completed',
    message: 'Completed Sicarro Marketing Image using Gemini 3 Pro (nano-banana-pro). Output...',
    time: 'about 4 days ago',
    status: 'green'
  },
  {
    agent: 'Jarvis',
    action: 'message sent',
    message: 'Commented on task',
    time: 'about 4 days ago',
    status: 'yellow'
  },
  {
    agent: 'Jarvis',
    action: 'heartbeat check',
    message: 'Friday unresponsive on Sicarro marketing image task (3.5 hrs). Attempted contact faile...',
    time: 'about 4 days ago',
    status: 'yellow'
  },
  {
    agent: 'Jarvis',
    action: 'message sent',
    message: 'Commented on task',
    time: 'about 5 days ago',
    status: 'yellow'
  },
  {
    agent: 'Wanda',
    action: 'task completed',
    message: 'Completed Sicarro Car Image v6 using Gemini image generation. Output: sicarro-ca...',
    time: 'about 5 days ago',
    status: 'green'
  }
];

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

// Task Modal Component
const TaskModal = ({ task, agents, onClose, onSave, onDelete }) => {
  const [editedTask, setEditedTask] = useState(task);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(editedTask);
  };

  const handleChange = (field, value) => {
    setEditedTask(prev => ({ ...prev, [field]: value }));
  };

  const handleAssigneeChange = (agentName) => {
    const agent = agents.find(a => a.name === agentName);
    setEditedTask(prev => ({
      ...prev,
      assignee: agentName || null,
      assigneeInitial: agent ? agent.initial : null
    }));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <div className="modal-header">
            <h2 className="modal-title">Edit Task</h2>
            <button type="button" className="modal-close" onClick={onClose}>✕</button>
          </div>

          <div className="modal-content">
            <div className="modal-section">
              <label className="modal-label">Title</label>
              <input
                type="text"
                className="modal-input"
                value={editedTask.title}
                onChange={(e) => handleChange('title', e.target.value)}
                required
              />
            </div>

            <div className="modal-section">
              <label className="modal-label">Description</label>
              <textarea
                className="modal-textarea"
                value={editedTask.description}
                onChange={(e) => handleChange('description', e.target.value)}
                required
              />
            </div>

            <div className="modal-row">
              <div className="modal-section">
                <label className="modal-label">Status</label>
                <select
                  className="modal-select"
                  value={editedTask.column}
                  onChange={(e) => handleChange('column', e.target.value)}
                >
                  <option value="inbox">Inbox</option>
                  <option value="assigned">Assigned</option>
                  <option value="progress">In Progress</option>
                  <option value="review">Review</option>
                </select>
              </div>

              <div className="modal-section">
                <label className="modal-label">Assignee</label>
                <select
                  className="modal-select"
                  value={editedTask.assignee || ''}
                  onChange={(e) => handleAssigneeChange(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {agents.map(agent => (
                    <option key={agent.name} value={agent.name}>
                      {agent.name} - {agent.role}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="modal-section">
              <label className="modal-label">Due Date</label>
              <input
                type="text"
                className="modal-input"
                value={editedTask.time}
                onChange={(e) => handleChange('time', e.target.value)}
                placeholder="e.g., Feb 14"
              />
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="modal-button modal-button-danger"
              onClick={() => {
                if (window.confirm('Are you sure you want to delete this task?')) {
                  onDelete(task.id);
                }
              }}
            >
              Delete
            </button>
            <button
              type="button"
              className="modal-button modal-button-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="modal-button modal-button-primary"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Header Component
const Header = ({ time, date, isDarkMode, onToggleDarkMode }) => (
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
        <div className="stat-number">4</div>
        <div className="stat-label">Agents Awake</div>
      </div>
      <div className="stat-item">
        <div className="stat-number">15</div>
        <div className="stat-label">Tasks in Queue</div>
      </div>
    </div>
    
    <div className="header-right">
      <DarkModeToggle isDark={isDarkMode} onToggle={onToggleDarkMode} />
      <div className="time-display">
        <div className="time-value">{time}</div>
        <div className="time-date">{date}</div>
      </div>
      <div className="status-badge">
        <span className="status-dot"></span>
        ONLINE
      </div>
    </div>
  </div>
);

// Agent Item Component
const AgentItem = ({ agent }) => (
  <div className="agent-item">
    <div className="agent-avatar" style={{ background: agentColors[agent.name] }}>
      {agent.initial}
    </div>
    <div className="agent-info">
      <div className="agent-name">{agent.name}</div>
      <div className="agent-role">{agent.role}</div>
    </div>
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
const AgentsSidebar = ({ agents, files, onFileView, isOpen, onClose }) => (
  <div className={`agents-sidebar ${isOpen ? 'open' : ''}`} id="agentsSidebar">
    <button className="mobile-close-btn" onClick={onClose}>✕</button>
    <div className="sidebar-header">
      <span className="sidebar-title">Agents</span>
      <span className="agent-count">{agents.length}</span>
    </div>
    <div className="agents-list">
      {agents.map((agent, index) => (
        <AgentItem key={index} agent={agent} />
      ))}
    </div>
    <FilesSection files={files} onFileView={onFileView} />
  </div>
);

// Task Card Component with Drag & Drop
const TaskCard = ({ task, onDragStart, onDragEnd, onClick }) => {
  return (
    <div
      className={`task-card ${task.column}`}
      draggable
      onDragStart={(e) => onDragStart(e, task)}
      onDragEnd={onDragEnd}
      onClick={onClick}
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
          <div className="task-assignee" style={{ background: agentColors[task.assignee] }}>
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
const KanbanColumn = ({ title, indicator, tasks, count, columnId, onDrop, onDragOver, onDragLeave, onTaskClick }) => {
  return (
    <div
      className="kanban-column"
      onDrop={(e) => onDrop(e, columnId)}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
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
            onDragStart={(e) => e.dataTransfer.setData('taskId', task.id)}
            onDragEnd={(e) => e.currentTarget.classList.remove('dragging')}
            onClick={() => onTaskClick(task)}
          />
        ))}
      </div>
    </div>
  );
};

// Feed Item Component
const FeedItem = ({ item }) => (
  <div className="feed-item">
    <div className="feed-avatar" style={{ background: agentColors[item.agent] }}>
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
const LiveFeed = ({ items }) => {
  const [activeTab, setActiveTab] = useState('tasks');

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
          <div className={`feed-tab ${activeTab === 'comments' ? 'active' : ''}`} onClick={() => setActiveTab('comments')}>
            Comments
          </div>
          <div className={`feed-tab ${activeTab === 'docs' ? 'active' : ''}`} onClick={() => setActiveTab('docs')}>
            Docs
          </div>
        </div>
      </div>
      <div className="feed-content">
        {items.map((item, index) => (
          <FeedItem key={index} item={item} />
        ))}
      </div>
    </div>
  );
};

// Main Mission Control Component
const MissionControl = () => {
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [overlayActive, setOverlayActive] = useState(false);
  const [tasks, setTasks] = useState(initialTasks);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [draggedTask, setDraggedTask] = useState(null);

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
  }, [isDarkMode]);

  const handleFileView = (file) => {
    alert(`📄 ${file.name}\n\n${file.description}\n\nType: ${file.type}\nLast modified: ${file.lastModified}\n\nClick to open and edit this file in your local editor.`);
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
    setOverlayActive(!overlayActive);
  };

  const handleDrop = (e, newColumn) => {
    e.preventDefault();
    const taskId = parseInt(e.dataTransfer.getData('taskId'));
    
    setTasks(prevTasks =>
      prevTasks.map(task =>
        task.id === taskId ? { ...task, column: newColumn } : task
      )
    );

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
    setSelectedTask(task);
  };

  const handleSaveTask = (updatedTask) => {
    setTasks(prevTasks =>
      prevTasks.map(task =>
        task.id === updatedTask.id ? updatedTask : task
      )
    );
    setSelectedTask(null);
  };

  const handleDeleteTask = (taskId) => {
    setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
    setSelectedTask(null);
  };

  const handleToggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  // Group tasks by column
  const inboxTasks = tasks.filter(t => t.column === 'inbox');
  const assignedTasks = tasks.filter(t => t.column === 'assigned');
  const progressTasks = tasks.filter(t => t.column === 'progress');
  const reviewTasks = tasks.filter(t => t.column === 'review');

  return (
    <div className="mission-control">
      <Header 
        time={time} 
        date={date} 
        isDarkMode={isDarkMode}
        onToggleDarkMode={handleToggleDarkMode}
      />
      
      <div className={`overlay ${overlayActive ? 'active' : ''}`} onClick={toggleSidebar}></div>
      
      <div className="main-container">
        <AgentsSidebar 
          agents={initialAgents} 
          files={initialFiles} 
          onFileView={handleFileView}
          isOpen={sidebarOpen}
          onClose={toggleSidebar}
        />
        
        <div className="mission-board">
          <div className="board-header">
            <div className="board-title">MISSION QUEUE</div>
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
            />
          </div>
        </div>
        
        <LiveFeed items={initialFeedItems} />
      </div>

      {selectedTask && (
        <TaskModal
          task={selectedTask}
          agents={initialAgents}
          onClose={() => setSelectedTask(null)}
          onSave={handleSaveTask}
          onDelete={handleDeleteTask}
        />
      )}
    </div>
  );
};

export default MissionControl;
