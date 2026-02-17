# OpenClaw AI Mission Control - Enhanced React Version 🚀

A professional Kanban-style mission control board for OpenClaw AI agents with **drag & drop**, **task editing**, and **dark mode**!

## ✨ New Features

### 🎯 Drag & Drop Tasks
- Drag any task card between columns
- Visual feedback when dragging
- Smooth animations
- Works on desktop and tablet

### ✏️ Task Edit Modal
- Click any task to open edit modal
- Update title, description, status
- Assign/reassign to agents
- Set due dates
- Delete tasks

### 🌙 Dark Mode
- Toggle button in header
- Smooth theme transition
- Automatic persistence (stays after refresh)
- Eye-friendly dark colors

## 🚀 Quick Start

### In Existing React Project

```bash
# 1. Copy these files to your src folder:
MissionControl-Enhanced.jsx  # Rename to MissionControl.jsx
MissionControl.css
```

```jsx
// 2. Import in your App.js
import MissionControl from './MissionControl';

function App() {
  return <MissionControl />;
}
```

### New React App

```bash
# Create new app
npx create-react-app openclaw-mission-control
cd openclaw-mission-control

# Copy files to src/
# - MissionControl.jsx (the Enhanced version)
# - MissionControl.css

# Run
npm start
```

## 🎮 How to Use

### Drag & Drop
1. **Click and hold** any task card
2. **Drag** it to a different column
3. **Drop** it in the new column
4. Task automatically updates!

### Edit Tasks
1. **Click** any task card
2. Modal opens with all task details
3. **Edit** any field (title, description, assignee, status, date)
4. Click **Save Changes** to update
5. Click **Delete** to remove task

### Dark Mode
1. **Click** the 🌙/☀️ toggle in header
2. Theme switches instantly
3. Preference is remembered

## 📱 Responsive Design

- ✅ **Desktop**: Full 3-column layout with drag & drop
- ✅ **Tablet**: Drag & drop works, live feed hidden
- ✅ **Mobile**: Touch-friendly, tap to edit (no drag on mobile)
- ✅ **All Sizes**: Modal adapts perfectly

## 🎨 Customization

### Add More Columns

```jsx
// In MissionControl.jsx, add to the kanban-container:
<KanbanColumn 
  title="DONE" 
  indicator="done" 
  tasks={doneTasks} 
  count={doneTasks.length}
  columnId="done"
  onDrop={handleDrop}
  onDragOver={handleDragOver}
  onDragLeave={handleDragLeave}
  onTaskClick={handleTaskClick}
/>
```

### Customize Colors

```css
/* In MissionControl.css */
.indicator-done { background: #10b981; } /* Green */
```

### Connect to Backend

```jsx
// Replace initial data with API calls
useEffect(() => {
  // Fetch tasks from your API
  fetch('/api/tasks')
    .then(res => res.json())
    .then(data => setTasks(data));
}, []);

// Update task on backend when saved
const handleSaveTask = async (updatedTask) => {
  await fetch(`/api/tasks/${updatedTask.id}`, {
    method: 'PUT',
    body: JSON.stringify(updatedTask)
  });
  
  setTasks(prevTasks =>
    prevTasks.map(task =>
      task.id === updatedTask.id ? updatedTask : task
    )
  );
  setSelectedTask(null);
};
```

### Persist Dark Mode

```jsx
// Save to localStorage
const handleToggleDarkMode = () => {
  const newMode = !isDarkMode;
  setIsDarkMode(newMode);
  localStorage.setItem('darkMode', newMode);
};

// Load on startup
useEffect(() => {
  const saved = localStorage.getItem('darkMode');
  if (saved) setIsDarkMode(saved === 'true');
}, []);
```

## 🔧 Component Structure

```
MissionControl (main)
├── Header
│   ├── DarkModeToggle ⭐ NEW
│   ├── Stats
│   └── Status
├── AgentsSidebar
│   ├── AgentItem
│   └── FilesSection
├── MissionBoard
│   └── KanbanColumn (drag & drop enabled ⭐)
│       └── TaskCard (draggable + clickable ⭐)
├── LiveFeed
│   └── FeedItem
└── TaskModal ⭐ NEW
    ├── Form Fields
    └── Save/Delete Buttons
```

## 🎯 Key Features Explained

### Drag & Drop Implementation

```jsx
// Task is draggable
<div
  draggable
  onDragStart={(e) => e.dataTransfer.setData('taskId', task.id)}
  onDragEnd={...}
>

// Column accepts drops
<div
  onDrop={(e) => handleDrop(e, columnId)}
  onDragOver={handleDragOver}
>
```

### Modal State Management

```jsx
const [selectedTask, setSelectedTask] = useState(null);

// Open modal
const handleTaskClick = (task) => setSelectedTask(task);

// Close modal
const handleClose = () => setSelectedTask(null);

// Render modal when task is selected
{selectedTask && <TaskModal task={selectedTask} ... />}
```

### Dark Mode Toggle

```jsx
// State
const [isDarkMode, setIsDarkMode] = useState(false);

// Apply to body
useEffect(() => {
  if (isDarkMode) {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }
}, [isDarkMode]);
```

## 🚀 Advanced Enhancements

### 1. Real-time with WebSocket

```bash
npm install socket.io-client
```

```jsx
import io from 'socket.io-client';

useEffect(() => {
  const socket = io('http://localhost:3000');
  
  socket.on('task-update', (updatedTask) => {
    setTasks(prev => prev.map(t => 
      t.id === updatedTask.id ? updatedTask : t
    ));
  });
  
  return () => socket.disconnect();
}, []);
```

### 2. Better Drag & Drop Library

```bash
npm install react-beautiful-dnd
```

### 3. Toast Notifications

```bash
npm install react-toastify
```

```jsx
import { toast } from 'react-toastify';

const handleSaveTask = (task) => {
  // ... save logic
  toast.success('Task updated successfully! 🎉');
};
```

### 4. File Viewer/Editor

```bash
npm install @monaco-editor/react
```

```jsx
import Editor from '@monaco-editor/react';

// Add in your file modal
<Editor
  height="400px"
  defaultLanguage="markdown"
  value={fileContent}
  theme={isDarkMode ? 'vs-dark' : 'light'}
/>
```

### 5. Filter & Search

```jsx
const [searchQuery, setSearchQuery] = useState('');

const filteredTasks = tasks.filter(task =>
  task.title.toLowerCase().includes(searchQuery.toLowerCase())
);
```

## 💡 Tips for Development

### Windsurf Commands

Ask Windsurf:
- "Add a priority field to tasks"
- "Create a calendar view for tasks"
- "Add task dependencies"
- "Implement task comments"
- "Add file upload to tasks"

### Testing Drag & Drop

1. Open in browser
2. Click and hold any task
3. Drag to different column
4. Release to drop
5. Check console for any errors

### Testing Dark Mode

1. Click toggle in header
2. Check all text is readable
3. Test modal in dark mode
4. Verify all colors look good

## 📝 Common Issues & Solutions

### Drag doesn't work on touch devices
- This is expected - mobile uses tap to edit
- For touch drag, use react-beautiful-dnd

### Modal doesn't close
- Check onClick on overlay
- Verify stopPropagation on modal content

### Dark mode not persisting
- Add localStorage save/load
- See "Persist Dark Mode" section above

### Tasks not updating
- Check state management
- Verify setTasks is called correctly
- Console.log to debug

## 🎉 What's Included

✅ Drag & drop between columns
✅ Click to edit task modal
✅ Dark mode toggle
✅ Full responsive design
✅ Mobile-friendly
✅ Smooth animations
✅ Professional UI
✅ Clean code structure
✅ Easy to customize
✅ No external dependencies (for core features)

## 🤝 Need Help?

### Quick Debug Steps
1. Check browser console for errors
2. Verify all files are imported
3. Check CSS is loading
4. Test in different browsers
5. Try clearing cache

### Ask Windsurf
- "Why isn't drag and drop working?"
- "How do I add validation to the task form?"
- "Can you add task filtering?"
- "How do I integrate with my API?"

---

**Built with React + Love 💜**

Enjoy your enhanced OpenClaw Mission Control! 🎉
