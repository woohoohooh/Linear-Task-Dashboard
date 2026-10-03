/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useCallback } from 'react';
import { 
  Plus, 
  GripVertical, 
  CheckCircle2, 
  Circle, 
  Tag, 
  User as UserIcon, 
  MoreHorizontal,
  ChevronRight,
  X,
  Search,
  LayoutList,
  LayoutGrid,
  Calendar,
  Settings
} from 'lucide-react';
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { ProjectState, Group, Task, User, Priority } from './types';

// --- Initial Data ---
const INITIAL_STATE: ProjectState = {
  id: 'p1',
  title: 'Productivity Hub',
  nextGlobalId: 5,
  users: [
    { id: 'u1', name: 'Alex Rivera' },
    { id: 'u2', name: 'Sarah Chen' },
  ],
  groups: [
    { id: 'g1', title: 'To Do', taskIds: ['t1', 't2'] },
    { id: 'g2', title: 'In Progress', taskIds: ['t3', 't4'] },
  ],
  tasks: {
    't1': { id: 't1', globalId: 1, title: 'Design System Audit', completed: false, priority: 'High', tags: ['Design'], groupId: 'g1', assigneeId: 'u1' },
    't2': { id: 't2', globalId: 2, title: 'API Documentation', completed: true, priority: 'Medium', tags: ['Backend'], groupId: 'g1', assigneeId: 'u2' },
    't3': { id: 't3', globalId: 3, title: 'User Interview Analysis', completed: false, priority: 'Critical', tags: ['Research'], groupId: 'g2', assigneeId: 'u1' },
    't4': { id: 't4', globalId: 4, title: 'Marketing Landing Page', completed: false, priority: 'High', tags: ['Frontend'], groupId: 'g2' },
  }
};

// --- Components ---

interface SortableItemProps {
  id: string;
  children?: React.ReactNode;
  className?: string;
}

const SortableItem = ({ id, children, className }: SortableItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={className}>
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-all">
        <GripVertical className="w-3.5 h-3.5 text-slate-400" />
      </div>
      {children}
    </div>
  );
};

export default function App() {
  const [state, setState] = useState<ProjectState>(INITIAL_STATE);
  const [view, setView] = useState<'list' | 'board'>('list');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isModalCollapsed, setIsModalCollapsed] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // --- Handlers ---

  const toggleTaskCompletion = useCallback((taskId: string) => {
    setState(prev => ({
      ...prev,
      tasks: {
        ...prev.tasks,
        [taskId]: {
          ...prev.tasks[taskId],
          completed: !prev.tasks[taskId].completed
        }
      }
    }));
  }, []);

  const addTask = (groupId: string) => {
    const newId = `t${Math.random().toString(36).substr(2, 9)}`;
    const globalId = state.nextGlobalId;
    const newTask: Task = {
      id: newId,
      globalId,
      title: 'New Task',
      completed: false,
      priority: 'Medium',
      tags: [],
      groupId
    };

    setState(prev => ({
      ...prev,
      nextGlobalId: prev.nextGlobalId + 1,
      tasks: { ...prev.tasks, [newId]: newTask },
      groups: prev.groups.map(g => g.id === groupId ? { ...g, taskIds: [...g.taskIds, newId] } : g)
    }));
    
    setSelectedTaskId(newId);
    setIsModalCollapsed(false);
  };

  const copyTaskLink = (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    const url = `${window.location.origin}${window.location.pathname}?task=${taskId}`;
    navigator.clipboard.writeText(url).then(() => {
      alert('Link copied!');
    });
  };

  const addGroup = () => {
    const newId = `g${Math.random().toString(36).substr(2, 9)}`;
    const newGroup: Group = {
      id: newId,
      title: 'New Group',
      taskIds: []
    };
    setState(prev => ({
      ...prev,
      groups: [...prev.groups, newGroup]
    }));
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;
    const activeTask = state.tasks[activeId];
    if (!activeTask) return;
    const activeContainer = activeTask.groupId;
    let overContainer = state.groups.find(g => g.id === overId)?.id;
    if (!overContainer) {
      const overTask = state.tasks[overId];
      if (overTask) overContainer = overTask.groupId;
    }
    if (!overContainer || activeContainer === overContainer) return;
    setState(prev => {
      const activeGroup = prev.groups.find(g => g.id === activeContainer);
      const overGroup = prev.groups.find(g => g.id === overContainer);
      if (!activeGroup || !overGroup) return prev;
      const activeTaskIds = [...activeGroup.taskIds];
      const overTaskIds = [...overGroup.taskIds];
      const activeIndex = activeTaskIds.indexOf(activeId);
      activeTaskIds.splice(activeIndex, 1);
      const overIndex = overTaskIds.indexOf(overId);
      const newIndex = overIndex >= 0 ? overIndex : overTaskIds.length;
      overTaskIds.splice(newIndex, 0, activeId);
      return {
        ...prev,
        tasks: {
          ...prev.tasks,
          [activeId]: { ...prev.tasks[activeId], groupId: overContainer! }
        },
        groups: prev.groups.map(g => {
          if (g.id === activeContainer) return { ...g, taskIds: activeTaskIds };
          if (g.id === overContainer) return { ...g, taskIds: overTaskIds };
          return g;
        })
      };
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;
    if (active.id !== over.id) {
      const activeId = active.id as string;
      const overId = over.id as string;
      const activeGroupIndex = state.groups.findIndex(g => g.id === activeId);
      const overGroupIndex = state.groups.findIndex(g => g.id === overId);
      if (activeGroupIndex !== -1 && overGroupIndex !== -1) {
        setState(prev => ({
          ...prev,
          groups: arrayMove(prev.groups, activeGroupIndex, overGroupIndex)
        }));
      } else {
        const activeTask = state.tasks[activeId];
        const overTask = state.tasks[overId];
        if (activeTask && overTask && activeTask.groupId === overTask.groupId) {
          const group = state.groups.find(g => g.id === activeTask.groupId);
          if (group) {
            const oldIndex = group.taskIds.indexOf(activeId);
            const newIndex = group.taskIds.indexOf(overId);
            setState(prev => ({
              ...prev,
              groups: prev.groups.map(g => 
                g.id === group.id 
                  ? { ...g, taskIds: arrayMove(g.taskIds, oldIndex, newIndex) } 
                  : g
              )
            }));
          }
        }
      }
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const updateAssignee = (taskId: string, userId: string | 'new') => {
    if (userId === 'new') {
      const name = prompt('Enter new member name:');
      if (name) {
        const newUserId = `u${Math.random().toString(36).substr(2, 9)}`;
        const newUser: User = { id: newUserId, name };
        setState(prev => ({
          ...prev,
          users: [...prev.users, newUser],
          tasks: {
            ...prev.tasks,
            [taskId]: { ...prev.tasks[taskId], assigneeId: newUserId }
          }
        }));
      }
      return;
    }
    setState(prev => ({
      ...prev,
      tasks: {
        ...prev.tasks,
        [taskId]: { ...prev.tasks[taskId], assigneeId: userId }
      }
    }));
  };

  const handleModalMouseLeave = (e: React.MouseEvent) => {
    if (e.clientX < window.innerWidth / 2) {
      setIsModalCollapsed(true);
    }
  };

  const selectedTask = selectedTaskId ? state.tasks[selectedTaskId] : null;

  return (
    <div className="flex h-screen overflow-hidden bg-app-bg text-slate-900 transition-colors duration-300 dark:bg-app-bg-dark dark:text-slate-100">
      {/* Sidebar */}
      <aside className="w-64 border-r border-app-border dark:border-app-border-dark flex flex-col bg-white dark:bg-app-card-dark">
        <div className="p-6 flex items-center gap-2.5">
          <div className="w-8 h-8 bg-app-accent rounded flex items-center justify-center shadow-sm">
            <LayoutGrid className="w-5 h-5 text-white" />
          </div>
          <span className="font-semibold text-lg tracking-tight">Linear</span>
        </div>

        <nav className="flex-1 px-3 py-2 space-y-1">
          {[
            { icon: LayoutList, label: 'Dashboard', active: true },
            { icon: Calendar, label: 'Schedule' },
            { icon: UserIcon, label: 'Team' },
            { icon: Settings, label: 'Settings' },
          ].map((item) => (
            <button
              key={item.label}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                item.active 
                  ? "bg-slate-100 dark:bg-slate-800 text-app-accent" 
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900"
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-app-border dark:border-app-border-dark">
          <button className="w-full stripe-button-secondary text-xs">
            <Plus className="w-3.5 h-3.5" />
            New Project
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b border-app-border dark:border-app-border-dark bg-white dark:bg-app-card-dark flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-sm font-semibold">{state.title}</h1>
            <div className="h-4 w-px bg-app-border dark:bg-app-border-dark" />
            <p className="text-xs text-slate-500">{(Object.values(state.tasks) as Task[]).filter(t => !t.completed).length} tasks</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search..." 
                className="bg-slate-100 dark:bg-slate-900 border-none rounded-md pl-9 pr-3 py-1.5 text-xs w-48 outline-none focus:ring-1 ring-app-accent/30"
              />
            </div>
            
            <div className="flex bg-slate-100 dark:bg-slate-900 p-0.5 rounded-md">
              <button 
                onClick={() => setView('list')}
                className={cn(
                  "p-1.5 rounded transition-all",
                  view === 'list' ? "bg-white dark:bg-app-card-dark shadow-sm text-app-accent" : "text-slate-400 hover:text-slate-600"
                )}
              >
                <LayoutList className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => setView('board')}
                className={cn(
                  "p-1.5 rounded transition-all",
                  view === 'board' ? "bg-white dark:bg-app-card-dark shadow-sm text-app-accent" : "text-slate-400 hover:text-slate-600"
                )}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>

            <button 
              onClick={addGroup}
              className="stripe-button-primary !p-1.5"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden p-8">
          <DndContext 
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            {view === 'list' ? (
              <div className="h-full overflow-y-auto pr-2 custom-scrollbar space-y-10 pb-12">
                <SortableContext items={state.groups.map(g => g.id)} strategy={verticalListSortingStrategy}>
                  {state.groups.map((group) => (
                    <section key={group.id} className="space-y-3">
                      <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{group.title}</h2>
                          <span className="text-[10px] font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{group.taskIds.length}</span>
                        </div>
                        <button 
                          onClick={() => addTask(group.id)}
                          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-all"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="space-y-px border border-app-border dark:border-app-border-dark rounded-md overflow-hidden bg-white dark:bg-app-card-dark shadow-sm">
                        <SortableContext items={group.taskIds} strategy={verticalListSortingStrategy}>
                          {group.taskIds.map((taskId) => {
                            const task = state.tasks[taskId];
                            if (!task) return null;
                            const assignee = state.users.find(u => u.id === task.assigneeId);

                            return (
                              <motion.div
                                layoutId={task.id}
                                key={task.id}
                                onClick={() => {
                                  setSelectedTaskId(task.id);
                                  setIsModalCollapsed(false);
                                }}
                                className={cn(
                                  "group flex items-center gap-4 p-3 hover:bg-slate-50 dark:hover:bg-slate-900/50 cursor-pointer transition-colors border-b last:border-0 border-app-border dark:border-app-border-dark",
                                  selectedTaskId === task.id && "bg-slate-50 dark:bg-slate-900/50",
                                  task.completed && "opacity-60"
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  <SortableItem id={task.id} className="flex items-center" />
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleTaskCompletion(task.id);
                                    }}
                                    className={cn(
                                      "w-4 h-4 rounded border transition-colors flex items-center justify-center",
                                      task.completed ? "bg-app-accent border-app-accent text-white" : "border-slate-300 dark:border-slate-700 hover:border-app-accent"
                                    )}
                                  >
                                    {task.completed && <CheckCircle2 className="w-3 h-3" />}
                                  </button>
                                </div>

                                <div className="flex-1 min-w-0">
                                  <h3 className={cn(
                                    "text-sm font-medium truncate",
                                    task.completed ? "text-slate-400 line-through" : "text-slate-700 dark:text-slate-300"
                                  )}>
                                    {task.title}
                                  </h3>
                                </div>

                                <div className="flex items-center gap-4 shrink-0">
                                  <div className="flex items-center gap-1.5">
                                    {task.tags.map(tag => (
                                      <span key={tag} className="text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                  
                                  <span className={cn(
                                    "text-[10px] font-medium px-2 py-0.5 rounded",
                                    task.priority === 'Critical' && "bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400",
                                    task.priority === 'High' && "bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400",
                                    task.priority === 'Medium' && "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
                                    task.priority === 'Low' && "bg-slate-50 text-slate-600 dark:bg-slate-900/20 dark:text-slate-400",
                                  )}>
                                    {task.priority}
                                  </span>

                                  {assignee && (
                                    <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-semibold" title={assignee.name}>
                                      {assignee.name.charAt(0)}
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            );
                          })}
                        </SortableContext>
                        <button 
                          onClick={() => addTask(group.id)}
                          className="w-full p-3 text-left text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors flex items-center gap-2"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add Task
                        </button>
                      </div>
                    </section>
                  ))}
                </SortableContext>
              </div>
            ) : (
              <div className="h-full overflow-x-auto pb-6 flex gap-6 items-start custom-scrollbar">
                <SortableContext items={state.groups.map(g => g.id)} strategy={verticalListSortingStrategy}>
                  {state.groups.map((group) => (
                    <div key={group.id} className="w-72 shrink-0 flex flex-col max-h-full gap-3">
                      <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{group.title}</h2>
                          <span className="text-[10px] font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{group.taskIds.length}</span>
                        </div>
                        <button 
                          onClick={() => addTask(group.id)}
                          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-all"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                        <SortableContext items={group.taskIds} strategy={verticalListSortingStrategy}>
                          {group.taskIds.map((taskId) => {
                            const task = state.tasks[taskId];
                            if (!task) return null;
                            const assignee = state.users.find(u => u.id === task.assigneeId);

                            return (
                              <motion.div 
                                layoutId={task.id}
                                key={task.id}
                                onClick={() => {
                                  setSelectedTaskId(task.id);
                                  setIsModalCollapsed(false);
                                }}
                                className={cn(
                                  "stripe-card p-4 cursor-pointer transition-all hover:border-app-accent/50",
                                  selectedTaskId === task.id && "border-app-accent ring-1 ring-app-accent/10",
                                  task.completed && "opacity-60"
                                )}
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <span className="text-[10px] font-medium text-slate-400">#{task.globalId}</span>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleTaskCompletion(task.id);
                                    }}
                                    className={cn(
                                      "w-4 h-4 rounded border transition-colors flex items-center justify-center",
                                      task.completed ? "bg-app-accent border-app-accent text-white" : "border-slate-300 dark:border-slate-700"
                                    )}
                                  >
                                    {task.completed && <CheckCircle2 className="w-3 h-3" />}
                                  </button>
                                </div>
                                <h3 className={cn(
                                  "text-sm font-medium mb-3 leading-snug",
                                  task.completed ? "text-slate-400 line-through" : "text-slate-700 dark:text-slate-300"
                                )}>
                                  {task.title}
                                </h3>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <span className={cn(
                                      "text-[9px] font-medium px-1.5 py-0.5 rounded",
                                      task.priority === 'Critical' && "bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400",
                                      task.priority === 'High' && "bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400",
                                      task.priority === 'Medium' && "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
                                      task.priority === 'Low' && "bg-slate-50 text-slate-600 dark:bg-slate-900/20 dark:text-slate-400",
                                    )}>
                                      {task.priority}
                                    </span>
                                  </div>
                                  {assignee && (
                                    <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[9px] font-semibold">
                                      {assignee.name.charAt(0)}
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            );
                          })}
                        </SortableContext>
                        <button 
                          onClick={() => addTask(group.id)}
                          className="w-full py-3 rounded-md border border-dashed border-slate-300 dark:border-slate-700 text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all flex items-center justify-center gap-2 text-xs font-medium"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add Task
                        </button>
                      </div>
                    </div>
                  ))}
                </SortableContext>
                <button 
                  onClick={addGroup}
                  className="w-72 shrink-0 h-10 rounded-md border border-dashed border-slate-300 dark:border-slate-700 text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all flex items-center justify-center gap-2 text-xs font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Column
                </button>
              </div>
            )}
          </DndContext>
        </div>

        {/* Task Detail Panel */}
        <AnimatePresence>
          {selectedTaskId && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedTaskId(null)}
                className="absolute inset-0 bg-slate-900/10 backdrop-blur-none z-40"
              />
              <motion.div 
                initial={{ x: '100%' }}
                animate={{ x: isModalCollapsed ? '98%' : 0 }}
                exit={{ x: '100%' }}
                onMouseLeave={handleModalMouseLeave}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className={cn(
                  "absolute top-0 right-0 bottom-0 w-[90%] md:w-[480px] bg-white dark:bg-app-card-dark border-l border-app-border dark:border-app-border-dark z-50 flex flex-col shadow-2xl",
                  isModalCollapsed && "opacity-50 hover:opacity-100"
                )}
              >
                <div className="p-6 flex flex-col h-full">
                  <div className="flex items-center justify-between mb-8">
                    <button 
                      onClick={() => toggleTaskCompletion(selectedTaskId)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded border text-xs font-medium transition-all",
                        selectedTask?.completed 
                          ? "bg-emerald-50 border-emerald-200 text-emerald-600" 
                          : "bg-white border-slate-200 text-slate-600 hover:border-app-accent"
                      )}
                    >
                      {selectedTask?.completed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                      {selectedTask?.completed ? 'Completed' : 'Mark Complete'}
                    </button>
                    
                    <div className="flex items-center gap-2">
                      <button className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-all">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setSelectedTaskId(null)}
                        className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-8">
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Title</p>
                      <input 
                        type="text" 
                        value={selectedTask?.title || ''}
                        onChange={(e) => {
                          const newTitle = e.target.value;
                          setState(prev => ({
                            ...prev,
                            tasks: {
                              ...prev.tasks,
                              [selectedTaskId]: { ...prev.tasks[selectedTaskId], title: newTitle }
                            }
                          }));
                        }}
                        className="text-xl font-semibold text-slate-900 dark:text-slate-100 bg-transparent border-none focus:ring-0 w-full p-0 placeholder:text-slate-300 outline-none"
                        placeholder="Task title"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Assignee</p>
                        <select 
                          value={selectedTask?.assigneeId || ''}
                          onChange={(e) => updateAssignee(selectedTaskId, e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-app-border dark:border-app-border-dark rounded px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-1 ring-app-accent/30"
                        >
                          <option value="">Unassigned</option>
                          {state.users.map(u => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                          ))}
                          <option value="new">+ Add New</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Priority</p>
                        <select 
                          value={selectedTask?.priority || 'Medium'}
                          onChange={(e) => {
                            const priority = e.target.value as Priority;
                            setState(prev => ({
                              ...prev,
                              tasks: {
                                ...prev.tasks,
                                [selectedTaskId]: { ...prev.tasks[selectedTaskId], priority }
                              }
                            }));
                          }}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-app-border dark:border-app-border-dark rounded px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-1 ring-app-accent/30"
                        >
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                          <option value="Critical">Critical</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Tags</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedTask?.tags.map(tag => (
                          <span key={tag} className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-[10px] font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                            {tag}
                            <button 
                              onClick={() => {
                                setState(prev => ({
                                  ...prev,
                                  tasks: {
                                    ...prev.tasks,
                                    [selectedTaskId]: {
                                      ...prev.tasks[selectedTaskId],
                                      tags: prev.tasks[selectedTaskId].tags.filter(t => t !== tag)
                                    }
                                  }
                                }));
                              }}
                              className="hover:text-rose-500"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        ))}
                        <button 
                          onClick={() => {
                            const tag = prompt('Enter new tag:');
                            if (tag) {
                              setState(prev => ({
                                ...prev,
                                tasks: {
                                  ...prev.tasks,
                                  [selectedTaskId]: {
                                    ...prev.tasks[selectedTaskId],
                                    tags: [...prev.tasks[selectedTaskId].tags, tag]
                                  }
                                }
                              }));
                            }
                          }}
                          className="text-[10px] font-medium text-app-accent hover:underline"
                        >
                          + Add Tag
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Description</p>
                      <textarea 
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-app-border dark:border-app-border-dark rounded-md p-4 text-xs text-slate-600 dark:text-slate-400 min-h-[120px] outline-none focus:ring-1 ring-app-accent/30 resize-none"
                        placeholder="Add details..."
                      />
                    </div>
                  </div>

                  <div className="pt-6 border-t border-app-border dark:border-app-border-dark flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-400">
                      <Calendar className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-medium uppercase tracking-wider">Created 2 hours ago</span>
                    </div>
                    <button 
                      onClick={(e) => copyTaskLink(e, selectedTaskId)}
                      className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500 hover:text-app-accent transition-colors"
                    >
                      <Tag className="w-3 h-3 rotate-90" />
                      Copy Link
                    </button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
