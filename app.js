// To-Do 앱 핵심 로직
import { supabase, TABLES, getCurrentUserId, signInAnonymously, onAuthStateChange } from './supabase-client.js';

// 전역 상태
let currentUser = null;
let currentFilter = 'all';
let currentTagFilter = null;
let currentPriorityFilter = null;
let currentDateFilter = null;
let selectedPriority = null;
let tasks = [];
let tags = [];

// DOM 요소
const taskInput = document.getElementById('task-input');
const taskTagSelect = document.getElementById('task-tag');
const addTaskForm = document.getElementById('add-task-form');
const taskList = document.getElementById('task-list');
const emptyState = document.getElementById('empty-state');
const taskStats = document.getElementById('task-stats');
const filterTabs = document.querySelectorAll('.filter-tab');
const tagFilters = document.getElementById('tag-filters');
const priorityBtns = document.querySelectorAll('.priority-btn');
const priorityFilterBtns = document.querySelectorAll('.priority-filter-btn');
const dateFilterBtns = document.querySelectorAll('.date-filter-btn');
const loadingOverlay = document.getElementById('loading-overlay');

// 상세 모달 요소
const taskDetailModal = document.getElementById('task-detail-modal');
const closeTaskDetailModal = document.getElementById('close-task-detail-modal');
const cancelTaskDetailBtn = document.getElementById('cancel-task-detail-btn');
const taskDetailForm = document.getElementById('task-detail-form');
const detailTaskId = document.getElementById('detail-task-id');
const detailTaskContent = document.getElementById('detail-task-content');
const detailTaskStatus = document.getElementById('detail-task-status');
const detailTaskPriority = document.getElementById('detail-task-priority');
const detailTaskTag = document.getElementById('detail-task-tag');
const detailDescription = document.getElementById('detail-description');
const detailDeadline = document.getElementById('detail-deadline');
const detailEstimatedTime = document.getElementById('detail-estimated-time');
const detailNotes = document.getElementById('detail-notes');
const detailRequiresReview = document.getElementById('detail-requires-review');
const detailIsRecurring = document.getElementById('detail-is-recurring');
const editTaskContentBtn = document.getElementById('edit-task-content-btn');

// 인증 모달 요소
const authModal = document.getElementById('auth-modal');
const authBtn = document.getElementById('auth-btn');
const closeAuthModal = document.getElementById('close-auth-modal');
const showSignupBtn = document.getElementById('show-signup');
const showLoginBtn = document.getElementById('show-login');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const loginFormElement = document.getElementById('login-form-element');
const signupFormElement = document.getElementById('signup-form-element');
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');
const signupEmail = document.getElementById('signup-email');
const signupPassword = document.getElementById('signup-password');
const signupPasswordConfirm = document.getElementById('signup-password-confirm');

// 삭제 확인 모달 요소
const deleteModal = document.getElementById('delete-modal');
const deleteModalContent = document.getElementById('delete-modal-content');
const deleteTaskPreview = document.getElementById('delete-task-preview');
const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');

// 태그 관리 모달 요소
const tagModal = document.getElementById('tag-modal');
const manageTagsBtn = document.getElementById('manage-tags-btn');
const closeTagModal = document.getElementById('close-tag-modal');
const closeTagModalBtn = document.getElementById('close-tag-modal-btn');
const newTagInput = document.getElementById('new-tag-input');
const addTagBtn = document.getElementById('add-tag-btn');
const tagsList = document.getElementById('tags-list');
const tagFilterSelect = document.getElementById('tag-filter-select');

// 앱 초기화
async function initApp() {
    showLoading(true);
    
    try {
        // Supabase 인증 시도
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (user && !authError) {
            // 인증된 사용자가 있는 경우
            currentUser = {
                id: user.id,
                email: user.email,
                isTempUser: false
            };
            console.log('Supabase 사용자로 앱 초기화:', currentUser);
            updateAuthButton('로그아웃');
        } else {
            // 익명 로그인 시도
            try {
                const { data: { user: anonUser }, error: anonError } = await supabase.auth.signInAnonymously();
                if (anonUser && !anonError) {
                    currentUser = {
                        id: anonUser.id,
                        email: null,
                        isTempUser: false
                    };
                    console.log('익명 사용자로 앱 초기화:', currentUser);
                    updateAuthButton('로그아웃');
                } else {
                    throw anonError;
                }
            } catch (anonError) {
                console.log('익명 로그인 실패, 임시 사용자로 대체:', anonError.message);
                
                // 임시 사용자 ID 생성 또는 기존 ID 사용
                let tempUserId = localStorage.getItem('temp_user_id');
                if (!tempUserId) {
                    tempUserId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    localStorage.setItem('temp_user_id', tempUserId);
                }
                
                // 임시 사용자 객체 생성
                currentUser = {
                    id: tempUserId,
                    email: null,
                    isTempUser: true
                };
                updateAuthButton('로그인');
            }
        }
        
        // 실시간 구독 설정
        await setupRealtimeSubscription();
        
        // 초기 데이터 로드
        await Promise.all([
            loadTasks(),
            loadTags()
        ]);
        
        // 이벤트 리스너 설정
        setupEventListeners();
        
    } catch (error) {
        console.error('앱 초기화 오류:', error);
        showError('앱 초기화에 실패했습니다. 페이지를 새로고침해주세요.');
    } finally {
        showLoading(false);
    }
}

// 실시간 구독 설정
async function setupRealtimeSubscription() {
    // 임시 사용자인 경우 실시간 구독 건너뛰기
    if (currentUser.isTempUser) {
        console.log('임시 사용자: 실시간 구독 건너뛰기');
        return;
    }
    
    try {
        const channel = supabase
            .channel('tasks')
            .on('postgres_changes', 
                { 
                    event: '*', 
                    schema: 'public', 
                    table: TABLES.TASKS,
                    filter: `user_id=eq.${currentUser.id}`
                }, 
                (payload) => {
                    console.log('실시간 변경 감지:', payload);
                    handleRealtimeChange(payload);
                }
            )
            .subscribe();
        
        console.log('실시간 구독 설정 완료');
        return channel;
    } catch (error) {
        console.error('실시간 구독 설정 오류:', error);
    }
}

// 실시간 변경 처리
function handleRealtimeChange(payload) {
    switch (payload.eventType) {
        case 'INSERT':
            const newTask = payload.new;
            tasks.unshift(newTask);
            break;
        case 'UPDATE':
            const updatedTask = payload.new;
            const updateIndex = tasks.findIndex(t => t.id === updatedTask.id);
            if (updateIndex !== -1) {
                tasks[updateIndex] = updatedTask;
            }
            break;
        case 'DELETE':
            const deletedTaskId = payload.old.id;
            tasks = tasks.filter(t => t.id !== deletedTaskId);
            break;
    }
    
    renderTasks();
    updateStats();
}

// 할 일 목록 로드
async function loadTasks() {
    try {
        // Supabase 사용자인 경우 DB에서 로드
        if (!currentUser.isTempUser) {
            const { data, error } = await supabase
                .from(TABLES.TASKS)
                .select(`
                    *,
                    tags (
                        id,
                        name,
                        color
                    )
                `)
                .eq('user_id', currentUser.id)
                .order('created_at', { ascending: false });
            
            if (error) {
                throw error;
            }
            
            tasks = data || [];
            renderTasks();
            updateStats();
            console.log('Supabase 할 일 로드 완료:', tasks.length);
            return;
        }
        
        // 임시 사용자인 경우 로컬 스토리지에서 로드
        const localTasks = localStorage.getItem(`tasks_${currentUser.id}`);
        tasks = localTasks ? JSON.parse(localTasks) : [];
        renderTasks();
        updateStats();
        console.log('로컬 할 일 로드 완료:', tasks.length);
        
    } catch (error) {
        console.error('할 일 로드 오류:', error);
        showError('할 일 목록을 불러오는데 실패했습니다.');
        
        // Supabase 오류 시 로컬 폴백
        if (!currentUser.isTempUser) {
            console.log('Supabase 오류로 로컬 폴백 시도');
            const localTasks = localStorage.getItem(`tasks_${currentUser.id}`);
            tasks = localTasks ? JSON.parse(localTasks) : [];
            renderTasks();
            updateStats();
        }
    }
}

// 할 일 추가
async function addTask(content) {
    if (!content.trim()) return;
    
    try {
        const selectedTagId = taskTagSelect.value;
        
        // Supabase 사용자인 경우 DB에 저장
        if (!currentUser.isTempUser) {
            const { data, error } = await supabase
                .from(TABLES.TASKS)
                .insert([
                    {
                        content: content.trim(),
                        user_id: currentUser.id,
                        is_complete: false,
                        tag_id: selectedTagId || null,
                        priority: selectedPriority || 'low'
                    }
                ])
                .select()
                .single();
            
            if (error) {
                throw error;
            }
            
            // 새 할 일을 tasks 배열에 추가하여 즉시 UI 업데이트
            const newTask = {
                ...data,
                tags: selectedTagId ? tags.find(t => t.id === selectedTagId) : null
            };
            tasks.unshift(newTask);
            
            // UI 즉시 업데이트
            renderTasks();
            updateStats();
            
            // 입력 필드 초기화
            taskInput.value = '';
            taskTagSelect.value = '';
            clearPrioritySelection();
            
            console.log('Supabase 할 일 추가 성공:', data);
            return;
        }
        
        // 임시 사용자인 경우 로컬 스토리지에 저장
        const newTask = {
            id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            content: content.trim(),
            user_id: currentUser.id,
            is_complete: false,
            tag_id: selectedTagId || null,
            priority: selectedPriority || 'low',
            created_at: new Date().toISOString(),
            tags: selectedTagId ? tags.find(t => t.id === selectedTagId) : null
        };
        
        tasks.unshift(newTask);
        localStorage.setItem(`tasks_${currentUser.id}`, JSON.stringify(tasks));
        
        // 입력 필드 초기화
        taskInput.value = '';
        taskTagSelect.value = '';
        clearPrioritySelection();
        
        renderTasks();
        updateStats();
        
        console.log('로컬 할 일 추가 성공:', newTask);
        
    } catch (error) {
        console.error('할 일 추가 오류:', error);
        showError('할 일 추가에 실패했습니다.');
        
        // Supabase 오류 시 로컬 폴백
        if (!currentUser.isTempUser) {
            console.log('Supabase 오류로 로컬 폴백 시도');
            const newTask = {
                id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                content: content.trim(),
                user_id: currentUser.id,
                is_complete: false,
                tag_id: selectedTagId || null,
                priority: selectedPriority || 'low',
                created_at: new Date().toISOString(),
                tags: selectedTagId ? tags.find(t => t.id === selectedTagId) : null
            };
            
            tasks.unshift(newTask);
            localStorage.setItem(`tasks_${currentUser.id}`, JSON.stringify(tasks));
            
            // 입력 필드 초기화
            taskInput.value = '';
            taskTagSelect.value = '';
            clearPrioritySelection();
            
            renderTasks();
            updateStats();
            
            console.log('로컬 폴백 할 일 추가 성공:', newTask);
        }
    }
}

// 할 일 완료 상태 토글
async function toggleTaskComplete(taskId) {
    try {
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;
        
        const newCompleteStatus = !task.is_complete;
        const updateData = { 
            is_complete: newCompleteStatus 
        };
        
        // 완료 시 완료일 추가, 미완료 시 완료일 제거
        if (newCompleteStatus) {
            updateData.completed_at = new Date().toISOString();
        } else {
            updateData.completed_at = null;
        }
        
        // 임시 사용자인 경우 로컬에서 처리
        if (currentUser.isTempUser) {
            const taskIndex = tasks.findIndex(t => t.id === taskId);
            if (taskIndex !== -1) {
                tasks[taskIndex].is_complete = newCompleteStatus;
                tasks[taskIndex].completed_at = updateData.completed_at;
                
                // 로컬 스토리지에 저장
                localStorage.setItem(`tasks_${currentUser.id}`, JSON.stringify(tasks));
                
                // UI 업데이트
                renderTasks();
                updateStats();
                
                console.log('로컬 할 일 상태 변경 성공');
                return;
            }
        }
        
        const { error } = await supabase
            .from(TABLES.TASKS)
            .update(updateData)
            .eq('id', taskId)
            .eq('user_id', currentUser.id);
        
        if (error) {
            throw error;
        }
        
        console.log('할 일 상태 변경 성공');
        
    } catch (error) {
        console.error('할 일 상태 변경 오류:', error);
        showError('할 일 상태 변경에 실패했습니다.');
    }
}

// 우선순위 변경
async function updateTaskPriority(taskId, newPriority) {
    try {
        const { error } = await supabase
            .from(TABLES.TASKS)
            .update({ priority: newPriority })
            .eq('id', taskId)
            .eq('user_id', currentUser.id);
        
        if (error) {
            throw error;
        }
        
        console.log('우선순위 변경 성공');
        
    } catch (error) {
        console.error('우선순위 변경 오류:', error);
        showError('우선순위 변경에 실패했습니다.');
    }
}

// 할 일 삭제 (실제 삭제 실행)
async function deleteTask(taskId) {
    try {
        // Supabase 사용자인 경우 DB에서 삭제
        if (!currentUser.isTempUser) {
            const { error } = await supabase
                .from(TABLES.TASKS)
                .delete()
                .eq('id', taskId)
                .eq('user_id', currentUser.id);
            
            if (error) {
                throw error;
            }
        } else {
            // 임시 사용자인 경우 로컬에서 삭제
            const taskIndex = tasks.findIndex(t => t.id === taskId);
            if (taskIndex !== -1) {
                tasks.splice(taskIndex, 1);
                localStorage.setItem(`tasks_${currentUser.id}`, JSON.stringify(tasks));
            }
        }
        
        // UI에서 할 일 제거 (애니메이션과 함께)
        const taskElement = document.querySelector(`[data-task-id="${taskId}"]`).closest('.task-item');
        if (taskElement) {
            taskElement.style.animation = 'slideOut 0.3s ease-in forwards';
            setTimeout(() => {
                taskElement.remove();
                // 할 일 목록이 비어있는지 확인
                if (document.querySelectorAll('.task-item').length === 0) {
                    emptyState.classList.remove('hidden');
                }
                updateStats();
            }, 300);
        }
        
        console.log('할 일 삭제 성공');
        showSuccess('할 일이 삭제되었습니다.');
        
    } catch (error) {
        console.error('할 일 삭제 오류:', error);
        showError('할 일 삭제에 실패했습니다.');
    }
}

// 할 일 목록 렌더링
function renderTasks() {
    const filteredTasks = getFilteredTasks();
    
    if (filteredTasks.length === 0) {
        taskList.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    
    taskList.innerHTML = filteredTasks.map(task => `
        <li class="task-item ${task.is_complete ? 'completed' : ''} px-6 py-4 flex items-center space-x-3 group">
            <input 
                type="checkbox" 
                class="task-checkbox"
                ${task.is_complete ? 'checked' : ''}
                data-task-id="${task.id}"
                aria-label="할 일 완료 체크"
            >
            <div class="flex-1 space-y-2">
                <div class="flex items-center space-x-2">
                    <span class="priority-indicator priority-${task.priority || 'low'}"></span>
                    <span class="task-content text-gray-700 text-sm leading-relaxed block">
                        ${escapeHtml(task.content)}
                    </span>
                </div>
                <div class="flex items-center space-x-3 text-xs text-gray-500">
                    <span class="flex items-center space-x-1">
                        <i class='bx bx-calendar-plus'></i>
                        <span>등록: ${formatDate(task.created_at)}</span>
                    </span>
                    ${task.is_complete && task.completed_at ? `
                        <span class="flex items-center space-x-1 text-green-600">
                            <i class='bx bx-check-circle'></i>
                            <span>완료: ${formatDate(task.completed_at)}</span>
                        </span>
                    ` : ''}
                </div>
                ${task.tags ? `<span class="tag text-xs" style="background-color: ${task.tags.color}20; color: ${task.tags.color}; border-color: ${task.tags.color}40;">
                    ${escapeHtml(task.tags.name)}
                </span>` : ''}
            </div>
            <div class="flex items-center space-x-2">
                <button 
                    type="button"
                    class="detail-btn w-6 h-6 text-gray-400 hover:text-green-500 rounded flex items-center justify-center hover:bg-green-50 transition-colors duration-200"
                    data-task-id="${task.id}"
                    title="상세 보기/편집"
                >
                    <i class='bx bx-detail text-sm'></i>
                </button>
                <button 
                    type="button"
                    class="edit-priority-btn w-6 h-6 text-gray-400 hover:text-blue-500 rounded flex items-center justify-center hover:bg-blue-50 transition-colors duration-200"
                    data-task-id="${task.id}"
                    data-current-priority="${task.priority || 'low'}"
                    title="우선순위 변경"
                >
                    <i class='bx bx-cog text-sm'></i>
                </button>
                <button 
                    class="delete-btn w-8 h-8 text-gray-400 hover:text-red-500 rounded-lg flex items-center justify-center transition-colors duration-200"
                    data-task-id="${task.id}"
                    aria-label="할 일 삭제"
                >
                    <i class='bx bx-trash text-lg'></i>
                </button>
            </div>
        </li>
    `).join('');
}

// 필터링된 할 일 목록 가져오기
function getFilteredTasks() {
    let filteredTasks = tasks;
    
    // 상태별 필터링
    switch (currentFilter) {
        case 'active':
            filteredTasks = filteredTasks.filter(task => !task.is_complete);
            break;
        case 'completed':
            filteredTasks = filteredTasks.filter(task => task.is_complete);
            break;
        default:
            // 전체는 필터링하지 않음
            break;
    }
    
    // 태그별 필터링
    if (currentTagFilter) {
        filteredTasks = filteredTasks.filter(task => task.tag_id === currentTagFilter);
    }
    
    // 우선순위별 필터링
    if (currentPriorityFilter) {
        filteredTasks = filteredTasks.filter(task => task.priority === currentPriorityFilter);
    }
    
    // 날짜별 필터링
    if (currentDateFilter) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        switch (currentDateFilter) {
            case 'today':
                filteredTasks = filteredTasks.filter(task => {
                    const taskDate = new Date(task.created_at);
                    return taskDate >= today;
                });
                break;
            case 'week':
                const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                filteredTasks = filteredTasks.filter(task => {
                    const taskDate = new Date(task.created_at);
                    return taskDate >= weekAgo;
                });
                break;
            case 'month':
                const monthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
                filteredTasks = filteredTasks.filter(task => {
                    const taskDate = new Date(task.created_at);
                    return taskDate >= monthAgo;
                });
                break;
        }
    }
    
    return filteredTasks;
}

// 태그 로드
async function loadTags() {
    try {
        // Supabase 사용자인 경우 DB에서 로드
        if (!currentUser.isTempUser) {
            const { data, error } = await supabase
                .from(TABLES.TAGS)
                .select('*')
                .eq('user_id', currentUser.id)
                .order('name');
            
            if (error) {
                throw error;
            }
            
            tags = data || [];
            renderTagSelect();
            renderTagFilters();
            console.log('Supabase 태그 로드 완료:', tags.length);
            return;
        }
        
        // 임시 사용자인 경우 로컬 스토리지에서 로드
        const localTags = localStorage.getItem(`tags_${currentUser.id}`);
        tags = localTags ? JSON.parse(localTags) : [];
        renderTagSelect();
        renderTagFilters();
        console.log('로컬 태그 로드 완료:', tags.length);
        
    } catch (error) {
        console.error('태그 로드 오류:', error);
        showError('태그 목록을 불러오는데 실패했습니다.');
        
        // Supabase 오류 시 로컬 폴백
        if (!currentUser.isTempUser) {
            console.log('Supabase 오류로 로컬 폴백 시도');
            const localTags = localStorage.getItem(`tags_${currentUser.id}`);
            tags = localTags ? JSON.parse(localTags) : [];
            renderTagSelect();
            renderTagFilters();
        }
    }
}

// 태그 추가
async function addTag(name) {
    if (!name.trim()) return;
    
    try {
        // Supabase 사용자인 경우 DB에 저장
        if (!currentUser.isTempUser) {
            const { data, error } = await supabase
                .from(TABLES.TAGS)
                .insert([
                    {
                        name: name.trim(),
                        user_id: currentUser.id,
                        color: generateTagColor()
                    }
                ])
                .select()
                .single();
            
            if (error) {
                throw error;
            }
            
            // 입력 필드 초기화
            newTagInput.value = '';
            
            // 태그 목록 새로고침
            await loadTags();
            
            console.log('Supabase 태그 추가 성공:', data);
            return;
        }
        
        // 임시 사용자인 경우 로컬 스토리지에 저장
        const newTag = {
            id: `local_tag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: name.trim(),
            user_id: currentUser.id,
            color: generateTagColor(),
            created_at: new Date().toISOString()
        };
        
        tags.push(newTag);
        localStorage.setItem(`tags_${currentUser.id}`, JSON.stringify(tags));
        
        // 입력 필드 초기화
        newTagInput.value = '';
        
        // 태그 목록 새로고침
        renderTagSelect();
        renderTagFilters();
        
        console.log('로컬 태그 추가 성공:', newTag);
        
    } catch (error) {
        console.error('태그 추가 오류:', error);
        showError('태그 추가에 실패했습니다.');
        
        // Supabase 오류 시 로컬 폴백
        if (!currentUser.isTempUser) {
            console.log('Supabase 오류로 로컬 폴백 시도');
            const newTag = {
                id: `local_tag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                name: name.trim(),
                user_id: currentUser.id,
                color: generateTagColor(),
                created_at: new Date().toISOString()
            };
            
            tags.push(newTag);
            localStorage.setItem(`tags_${currentUser.id}`, JSON.stringify(tags));
            
            // 입력 필드 초기화
            newTagInput.value = '';
            
            // 태그 목록 새로고침
            renderTagSelect();
            renderTagFilters();
            
            console.log('로컬 폴백 태그 추가 성공:', newTag);
        }
    }
}

// 태그 수정
async function updateTag(tagId, newName) {
    if (!newName.trim()) return;
    
    try {
        const { error } = await supabase
            .from(TABLES.TAGS)
            .update({ name: newName.trim() })
            .eq('id', tagId)
            .eq('user_id', currentUser.id);
        
        if (error) {
            throw error;
        }
        
        // 태그 목록 새로고침
        await loadTags();
        
        console.log('태그 수정 성공');
        
    } catch (error) {
        console.error('태그 수정 오류:', error);
        showError('태그 수정에 실패했습니다.');
    }
}

// 태그 삭제
async function deleteTag(tagId) {
    try {
        const { error } = await supabase
            .from(TABLES.TAGS)
            .delete()
            .eq('id', tagId)
            .eq('user_id', currentUser.id);
        
        if (error) {
            throw error;
        }
        
        // 태그 목록 새로고침
        await loadTags();
        
        console.log('태그 삭제 성공');
        
    } catch (error) {
        console.error('태그 삭제 오류:', error);
        showError('태그 삭제에 실패했습니다.');
    }
}

// 태그 색상 생성
function generateTagColor() {
    const colors = [
        '#3182F6', '#DC2626', '#059669', '#D97706', 
        '#7C3AED', '#DB2777', '#0891B2', '#65A30D'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

// 태그 선택 드롭다운 렌더링
function renderTagSelect() {
    taskTagSelect.innerHTML = '<option value="">태그 없음</option>';
    
    tags.forEach(tag => {
        const option = document.createElement('option');
        option.value = tag.id;
        option.textContent = tag.name;
        
        // 태그 색상 정보를 data 속성에 저장 (향후 스타일링용)
        option.setAttribute('data-color', tag.color);
        
        taskTagSelect.appendChild(option);
    });
}

// 태그 필터 드롭다운 렌더링
function renderTagFilters() {
    // 기존 옵션들 제거 (첫 번째 "모든 태그" 옵션 제외)
    const existingOptions = tagFilterSelect.querySelectorAll('option:not(:first-child)');
    existingOptions.forEach(option => option.remove());
    
    // 태그 옵션들 추가
    tags.forEach(tag => {
        const option = document.createElement('option');
        option.value = tag.id;
        option.textContent = tag.name;
        option.selected = currentTagFilter === tag.id;
        tagFilterSelect.appendChild(option);
    });
}

// 우선순위 선택
function selectPriority(priority) {
    selectedPriority = priority;
    
    // 모든 우선순위 버튼에서 선택 상태 제거
    priorityBtns.forEach(btn => {
        btn.classList.remove('selected');
    });
    
    // 선택된 우선순위 버튼에 선택 상태 추가
    const selectedBtn = document.querySelector(`[data-priority="${priority}"]`);
    if (selectedBtn) {
        selectedBtn.classList.add('selected');
    }
}

// 우선순위 선택 해제
function clearPrioritySelection() {
    selectedPriority = null;
    priorityBtns.forEach(btn => {
        btn.classList.remove('selected');
    });
}

// 우선순위 필터 변경
function changePriorityFilter(priority) {
    if (currentPriorityFilter === priority) {
        currentPriorityFilter = null; // 필터 해제
    } else {
        currentPriorityFilter = priority;
    }
    
    renderPriorityFilters();
    renderTasks();
}

// 우선순위 필터 렌더링
function renderPriorityFilters() {
    priorityFilterBtns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.priorityFilter === currentPriorityFilter) {
            btn.classList.add('active');
        }
    });
}

// 날짜 필터 변경
function changeDateFilter(dateFilter) {
    if (currentDateFilter === dateFilter) {
        currentDateFilter = null; // 필터 해제
    } else {
        currentDateFilter = dateFilter;
    }
    
    renderDateFilters();
    renderTasks();
}

// 날짜 필터 렌더링
function renderDateFilters() {
    dateFilterBtns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.dateFilter === currentDateFilter) {
            btn.classList.add('active');
        }
    });
}

// 태그 필터 변경
function changeTagFilter(tagId) {
    currentTagFilter = tagId || null; // 빈 문자열이면 null로 설정
    
    renderTasks();
}

// 태그 관리 모달 렌더링
function renderTagModal() {
    tagsList.innerHTML = '';
    
    if (tags.length === 0) {
        tagsList.innerHTML = '<p class="text-gray-500 text-sm text-center py-4">등록된 태그가 없습니다</p>';
        return;
    }
    
    tags.forEach(tag => {
        const tagDiv = document.createElement('div');
        tagDiv.className = 'flex items-center justify-between p-3 bg-gray-50 rounded-lg';
        tagDiv.innerHTML = `
            <div class="flex items-center space-x-2">
                <span class="tag" style="background-color: ${tag.color}20; color: ${tag.color}; border-color: ${tag.color}40;">
                    ${escapeHtml(tag.name)}
                </span>
            </div>
            <div class="flex items-center space-x-1">
                <button 
                    class="edit-tag-btn w-6 h-6 text-gray-400 hover:text-blue-500 rounded flex items-center justify-center hover:bg-blue-50 transition-colors duration-200"
                    data-tag-id="${tag.id}"
                    data-tag-name="${escapeHtml(tag.name)}"
                    title="태그 수정"
                >
                    <i class='bx bx-edit-alt text-sm'></i>
                </button>
                <button 
                    class="delete-tag-btn w-6 h-6 text-gray-400 hover:text-red-500 rounded flex items-center justify-center hover:bg-red-50 transition-colors duration-200"
                    data-tag-id="${tag.id}"
                    title="태그 삭제"
                >
                    <i class='bx bx-trash text-sm'></i>
                </button>
            </div>
        `;
        tagsList.appendChild(tagDiv);
    });
}

// 우선순위 변경 모달 표시
function showPriorityChangeModal(taskId, currentPriority) {
    const priorities = [
        { value: 'high', label: '높음', color: '#DC2626' },
        { value: 'medium', label: '보통', color: '#D97706' },
        { value: 'low', label: '낮음', color: '#6B7280' }
    ];
    
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-white rounded-2xl p-6 w-full max-w-sm mx-4">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">우선순위 변경</h3>
            <div class="space-y-3">
                ${priorities.map(priority => `
                    <button 
                        class="priority-option-btn w-full p-3 text-left rounded-lg border-2 transition-all duration-200 ${
                            priority.value === currentPriority 
                                ? 'border-blue-500 bg-blue-50' 
                                : 'border-gray-200 hover:border-gray-300'
                        }"
                        data-priority="${priority.value}"
                    >
                        <div class="flex items-center space-x-3">
                            <span class="priority-indicator priority-${priority.value}"></span>
                            <span class="font-medium">${priority.label}</span>
                        </div>
                    </button>
                `).join('')}
            </div>
            <div class="mt-6 pt-4 border-t border-gray-200">
                <button 
                    id="cancel-priority-btn"
                    class="w-full px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
                >
                    취소
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 우선순위 선택 이벤트
    modal.querySelectorAll('.priority-option-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const newPriority = btn.dataset.priority;
            if (newPriority !== currentPriority) {
                updateTaskPriority(taskId, newPriority);
            }
            modal.remove();
        });
    });
    
    // 취소 버튼 이벤트
    modal.querySelector('#cancel-priority-btn').addEventListener('click', () => {
        modal.remove();
    });
    
    // 모달 외부 클릭 시 닫기
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    // Escape 키로 닫기
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            modal.remove();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
}

// 상세 모달 표시
function showTaskDetailModal(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    // 기본 정보 설정
    detailTaskId.value = task.id;
    detailTaskContent.textContent = task.content;
    detailTaskStatus.textContent = task.is_complete ? '완료' : '진행중';
    detailTaskStatus.className = task.is_complete ? 'text-sm text-green-600' : 'text-sm text-blue-600';
    
    // 등록일 표시
    const detailTaskCreated = document.getElementById('detail-task-created');
    if (detailTaskCreated) {
        detailTaskCreated.textContent = formatDate(task.created_at);
    }
    
    // 완료일 표시
    const detailTaskCompleted = document.getElementById('detail-task-completed');
    if (detailTaskCompleted) {
        if (task.is_complete && task.completed_at) {
            detailTaskCompleted.textContent = formatDate(task.completed_at);
            detailTaskCompleted.className = 'text-sm text-green-600';
        } else {
            detailTaskCompleted.textContent = '미완료';
            detailTaskCompleted.className = 'text-sm text-gray-400';
        }
    }
    
    // 우선순위 표시
    const priorityLabels = { high: '높음', medium: '보통', low: '낮음' };
    const priorityColors = { high: '#DC2626', medium: '#D97706', low: '#6B7280' };
    detailTaskPriority.innerHTML = `
        <span class="priority-indicator priority-${task.priority || 'low'}"></span>
        <span class="text-sm font-medium">${priorityLabels[task.priority || 'low']}</span>
    `;
    
    // 태그 표시
    if (task.tags) {
        detailTaskTag.innerHTML = `
            <span class="tag text-xs" style="background-color: ${task.tags.color}20; color: ${task.tags.color}; border-color: ${task.tags.color}40;">
                ${escapeHtml(task.tags.name)}
            </span>
        `;
    } else {
        detailTaskTag.textContent = '태그 없음';
    }
    
    // 기존 상세 정보 로드
    loadTaskDetails(taskId);
    
    // 모달 표시
    taskDetailModal.classList.remove('hidden');
}

// 상세 정보 로드
async function loadTaskDetails(taskId) {
    try {
        const { data, error } = await supabase
            .from('task_details')
            .select('*')
            .eq('task_id', taskId)
            .single();
        
        if (error && error.code !== 'PGRST116') { // PGRST116는 데이터가 없는 경우
            console.error('상세 정보 로드 오류:', error);
            return;
        }
        
        if (data) {
            detailDescription.value = data.description || '';
            detailDeadline.value = data.deadline || '';
            detailEstimatedTime.value = data.estimated_time || '';
            detailNotes.value = data.notes || '';
            detailRequiresReview.checked = data.requires_review || false;
            detailIsRecurring.checked = data.is_recurring || false;
        } else {
            // 새로 생성할 경우 폼 초기화
            detailDescription.value = '';
            detailDeadline.value = '';
            detailEstimatedTime.value = '';
            detailNotes.value = '';
            detailRequiresReview.checked = false;
            detailIsRecurring.checked = false;
        }
        
    } catch (error) {
        console.error('상세 정보 로드 오류:', error);
    }
}

// 할 일 내용 수정
function editTaskContent() {
    const contentElement = document.getElementById('detail-task-content');
    const currentContent = contentElement.textContent;
    
    // 수정 모드로 변경
    contentElement.innerHTML = `
        <input 
            type="text" 
            id="edit-content-input" 
            value="${escapeHtml(currentContent)}" 
            class="w-full px-3 py-2 text-gray-900 font-medium bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-toss-blue focus:border-transparent"
            maxlength="100"
        >
    `;
    
    const input = contentElement.querySelector('#edit-content-input');
    input.focus();
    input.select();
    
    // 수정 완료 처리
    const finishEdit = () => {
        const newContent = input.value.trim();
        if (newContent && newContent !== currentContent) {
            updateTaskContent(newContent);
        } else {
            // 원래대로 복원
            contentElement.textContent = currentContent;
        }
    };
    
    input.addEventListener('blur', finishEdit);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            finishEdit();
        }
    });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            contentElement.textContent = currentContent;
        }
    });
}

// 인증 버튼 업데이트
function updateAuthButton(text) {
    if (authBtn) {
        authBtn.textContent = text;
    }
}

// 로그인 함수
async function signIn(email, password) {
    try {
        console.log('로그인 시도:', { email, passwordLength: password.length });
        
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) {
            throw error;
        }
        
        // 로그인 성공
        currentUser = {
            id: data.user.id,
            email: data.user.email,
            isTempUser: false
        };
        
        updateAuthButton('로그아웃');
        authModal.classList.add('hidden');
        
        // 데이터 새로 로드
        await loadTasks();
        await loadTags();
        
        showSuccess('로그인되었습니다.');
        console.log('로그인 성공:', data.user);
        
    } catch (error) {
        console.error('로그인 오류:', error);
        
        // 더 구체적인 오류 메시지 제공
        let errorMessage = '로그인에 실패했습니다.';
        
        if (error.message.includes('Email not confirmed')) {
            errorMessage = '이메일 확인이 필요합니다. 이메일을 확인해주세요.';
        } else if (error.message.includes('Invalid login credentials')) {
            errorMessage = '이메일 또는 비밀번호가 올바르지 않습니다.';
        } else if (error.message.includes('Too many requests')) {
            errorMessage = '너무 많은 로그인 시도가 있었습니다. 잠시 후 다시 시도해주세요.';
        }
        
        showError(errorMessage);
    }
}

// 회원가입 함수
async function signUp(email, password) {
    try {
        // 이메일 확인 없이 회원가입 시도
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    email_confirmed: true
                }
            }
        });
        
        if (error) {
            throw error;
        }
        
        // 회원가입 성공 시 즉시 로그인 시도
        if (data.user) {
            try {
                // 잠시 대기 후 로그인 시도 (데이터베이스 동기화 대기)
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // 즉시 로그인 시도
                const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
                    email: email,
                    password: password
                });
                
                if (loginError) {
                    throw loginError;
                }
                
                // 자동 로그인 성공
                currentUser = {
                    id: loginData.user.id,
                    email: loginData.user.email,
                    isTempUser: false
                };
                
                updateAuthButton('로그아웃');
                authModal.classList.add('hidden');
                
                // 데이터 새로 로드
                await loadTasks();
                await loadTags();
                
                showSuccess('회원가입 및 로그인이 완료되었습니다!');
                console.log('회원가입 및 자동 로그인 성공:', loginData);
                
            } catch (loginError) {
                console.log('자동 로그인 실패, 수동 로그인 안내:', loginError.message);
                showSuccess('회원가입이 완료되었습니다. 로그인해주세요.');
                showLoginForm();
            }
        }
        
    } catch (error) {
        console.error('회원가입 오류:', error);
        
        // 더 구체적인 오류 메시지 제공
        let errorMessage = '회원가입에 실패했습니다.';
        
        if (error.message.includes('Database error')) {
            errorMessage = '데이터베이스 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
        } else if (error.message.includes('already registered')) {
            errorMessage = '이미 등록된 이메일입니다.';
        } else if (error.message.includes('Invalid email')) {
            errorMessage = '유효하지 않은 이메일 형식입니다.';
        } else if (error.message.includes('Password')) {
            errorMessage = '비밀번호는 최소 6자 이상이어야 합니다.';
        }
        
        showError(errorMessage);
    }
}

// 로그아웃 함수
async function signOut() {
    try {
        const { error } = await supabase.auth.signOut();
        
        if (error) {
            throw error;
        }
        
        // 로그아웃 성공
        currentUser = null;
        tasks = [];
        tags = [];
        
        // UI 초기화
        renderTasks();
        updateStats();
        renderTagSelect();
        renderTagFilters();
        
        updateAuthButton('로그인');
        showSuccess('로그아웃되었습니다.');
        console.log('로그아웃 성공');
        
    } catch (error) {
        console.error('로그아웃 오류:', error);
        showError('로그아웃에 실패했습니다.');
    }
}

// 로그인 폼 표시
function showLoginForm() {
    loginForm.classList.remove('hidden');
    signupForm.classList.add('hidden');
}

// 삭제 확인 모달 표시
function showDeleteModal(taskId, taskContent) {
    // 할 일 내용 미리보기 설정
    deleteTaskPreview.textContent = taskContent;
    
    // 모달 표시
    deleteModal.classList.remove('hidden');
    deleteModal.classList.add('show');
    
    // 삭제 확인 버튼에 taskId 설정
    confirmDeleteBtn.setAttribute('data-task-id', taskId);
    
    // 모달 내용 애니메이션
    setTimeout(() => {
        deleteModalContent.style.transform = 'scale(1)';
        deleteModalContent.style.opacity = '1';
    }, 10);
}

// 삭제 확인 모달 숨기기
function hideDeleteModal() {
    deleteModal.classList.add('hide');
    
    // 애니메이션 완료 후 모달 숨기기
    setTimeout(() => {
        deleteModal.classList.remove('show', 'hide');
        deleteModal.classList.add('hidden');
        deleteModalContent.style.transform = 'scale(0.95)';
        deleteModalContent.style.opacity = '0';
    }, 200);
}

// 회원가입 폼 표시
function showSignupForm() {
    signupForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
}

// 할 일 내용 업데이트
async function updateTaskContent(newContent) {
    const taskId = detailTaskId.value;
    
    try {
        // 임시 사용자인 경우 로컬에서 처리
        if (currentUser.isTempUser) {
            const taskIndex = tasks.findIndex(t => t.id === taskId);
            if (taskIndex !== -1) {
                tasks[taskIndex].content = newContent;
                
                // 로컬 스토리지에 저장
                localStorage.setItem(`tasks_${currentUser.id}`, JSON.stringify(tasks));
                
                // UI 업데이트
                renderTasks();
                updateStats();
                
                // 상세 모달 내용 업데이트
                document.getElementById('detail-task-content').textContent = newContent;
                
                console.log('로컬 할 일 내용 수정 성공');
                showSuccess('할 일 내용이 수정되었습니다.');
                return;
            }
        }
        
        const { error } = await supabase
            .from(TABLES.TASKS)
            .update({ content: newContent })
            .eq('id', taskId)
            .eq('user_id', currentUser.id);
        
        if (error) {
            throw error;
        }
        
        // UI 업데이트
        renderTasks();
        updateStats();
        
        // 상세 모달 내용 업데이트
        document.getElementById('detail-task-content').textContent = newContent;
        
        console.log('할 일 내용 수정 성공');
        showSuccess('할 일 내용이 수정되었습니다.');
        
    } catch (error) {
        console.error('할 일 내용 수정 오류:', error);
        showError('할 일 내용 수정에 실패했습니다.');
    }
}

// 상세 정보 저장
async function saveTaskDetails(formData) {
    const taskId = detailTaskId.value;
    
    try {
        const { data, error } = await supabase
            .from('task_details')
            .upsert({
                task_id: taskId,
                description: formData.description,
                deadline: formData.deadline || null,
                estimated_time: formData.estimated_time || null,
                notes: formData.notes || null,
                requires_review: formData.requires_review,
                is_recurring: formData.is_recurring,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'task_id'
            })
            .select()
            .single();
        
        if (error) {
            throw error;
        }
        
        console.log('상세 정보 저장 성공:', data);
        showSuccess('상세 정보가 저장되었습니다.');
        
        // 모달 닫기
        taskDetailModal.classList.add('hidden');
        
    } catch (error) {
        console.error('상세 정보 저장 오류:', error);
        showError('상세 정보 저장에 실패했습니다.');
    }
}

// 태그 인라인 수정
function editTagInPlace(tagId, currentName) {
    const tagElement = document.querySelector(`[data-tag-id="${tagId}"]`).closest('.flex.items-center.justify-between');
    const tagSpan = tagElement.querySelector('.tag');
    
    // 수정 모드로 변경
    tagSpan.innerHTML = `
        <input 
            type="text" 
            class="tag-edit-input" 
            value="${escapeHtml(currentName)}" 
            maxlength="20"
            style="min-width: 80px;"
        >
    `;
    
    const input = tagSpan.querySelector('.tag-edit-input');
    input.focus();
    input.select();
    
    // 수정 완료 처리
    const finishEdit = () => {
        const newName = input.value.trim();
        if (newName && newName !== currentName) {
            updateTag(tagId, newName);
        } else {
            // 원래대로 복원
            tagSpan.innerHTML = escapeHtml(currentName);
        }
    };
    
    input.addEventListener('blur', finishEdit);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            finishEdit();
        }
    });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            tagSpan.innerHTML = escapeHtml(currentName);
        }
    });
}

// 통계 업데이트
function updateStats() {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(task => task.is_complete).length;
    const todayTasks = tasks.filter(task => {
        const today = new Date().toDateString();
        const taskDate = new Date(task.created_at).toDateString();
        return taskDate === today;
    }).length;
    const todayCompleted = tasks.filter(task => {
        if (!task.is_complete || !task.completed_at) return false;
        const today = new Date().toDateString();
        const completedDate = new Date(task.completed_at).toDateString();
        return completedDate === today;
    }).length;
    
    taskStats.innerHTML = `
        <div class="text-center space-y-1">
            <div class="text-sm text-gray-500">
                총 ${totalTasks}개 • 완료 ${completedTasks}개
            </div>
            <div class="text-xs text-gray-400">
                오늘 등록: ${todayTasks}개 • 오늘 완료: ${todayCompleted}개
            </div>
        </div>
    `;
}

// 필터 변경
function changeFilter(filter) {
    currentFilter = filter;
    
    // 필터 탭 활성화 상태 업데이트
    filterTabs.forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.filter === filter) {
            tab.classList.add('active');
        }
    });
    
    renderTasks();
}

// 이벤트 리스너 설정
function setupEventListeners() {
    // 할 일 추가 폼
    addTaskForm.addEventListener('submit', (e) => {
        e.preventDefault();
        addTask(taskInput.value);
    });
    
    // 필터 탭
    filterTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            changeFilter(tab.dataset.filter);
        });
    });
    
    // 우선순위 버튼 이벤트
    priorityBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const priority = btn.dataset.priority;
            selectPriority(priority);
        });
    });
    
    // 우선순위 필터 버튼 이벤트
    priorityFilterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const priority = btn.dataset.priorityFilter;
            changePriorityFilter(priority);
        });
    });
    
    // 날짜 필터 버튼 이벤트
    dateFilterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const dateFilter = btn.dataset.dateFilter;
            changeDateFilter(dateFilter);
        });
    });
    
    // 이벤트 위임을 사용한 할 일 목록 이벤트 처리
    taskList.addEventListener('click', (e) => {
        const target = e.target;
        const taskId = target.closest('[data-task-id]')?.dataset.taskId;
        
        if (!taskId) return;
        
        // 체크박스 클릭
        if (target.classList.contains('task-checkbox')) {
            toggleTaskComplete(taskId);
        }
        
        // 상세 보기 버튼 클릭
        if (target.closest('.detail-btn')) {
            showTaskDetailModal(taskId);
        }
        
        // 우선순위 변경 버튼 클릭
        if (target.closest('.edit-priority-btn')) {
            const currentPriority = target.closest('.edit-priority-btn').dataset.currentPriority;
            showPriorityChangeModal(taskId, currentPriority);
        }
        
        // 삭제 버튼 클릭 (모달 표시)
        if (target.closest('.delete-btn')) {
            const deleteBtn = target.closest('.delete-btn');
            const taskId = deleteBtn.getAttribute('data-task-id');
            const taskContent = deleteBtn.closest('.task-item').querySelector('.task-content').textContent;
            
            // 삭제 확인 모달 표시
            showDeleteModal(taskId, taskContent);
        }
    });
    
    // 상세 모달 이벤트
    closeTaskDetailModal.addEventListener('click', () => {
        taskDetailModal.classList.add('hidden');
    });
    
    cancelTaskDetailBtn.addEventListener('click', () => {
        taskDetailModal.classList.add('hidden');
    });
    
    // 인증 관련 이벤트
    authBtn.addEventListener('click', () => {
        if (currentUser && !currentUser.isTempUser) {
            // 로그아웃
            signOut();
        } else {
            // 로그인 모달 표시
            authModal.classList.remove('hidden');
            showLoginForm();
        }
    });
    
    closeAuthModal.addEventListener('click', () => {
        authModal.classList.add('hidden');
    });
    
    showSignupBtn.addEventListener('click', () => {
        showSignupForm();
    });
    
    showLoginBtn.addEventListener('click', () => {
        showLoginForm();
    });
    
    // 로그인 폼 제출
    loginFormElement.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = loginEmail.value.trim();
        const password = loginPassword.value;
        
        if (!email || !password) {
            showError('이메일과 비밀번호를 입력해주세요.');
            return;
        }
        
        signIn(email, password);
    });
    
    // 삭제 모달 관련 이벤트
    cancelDeleteBtn.addEventListener('click', () => {
        hideDeleteModal();
    });
    
    confirmDeleteBtn.addEventListener('click', () => {
        const taskId = confirmDeleteBtn.getAttribute('data-task-id');
        if (taskId) {
            deleteTask(taskId);
            hideDeleteModal();
        }
    });
    
    // 태그 필터 드롭다운 변경 이벤트
    tagFilterSelect.addEventListener('change', (e) => {
        changeTagFilter(e.target.value);
    });
    
    // 모달 외부 클릭 시 닫기
    deleteModal.addEventListener('click', (e) => {
        if (e.target === deleteModal) {
            hideDeleteModal();
        }
    });
    
    // 회원가입 폼 제출
    signupFormElement.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = signupEmail.value.trim();
        const password = signupPassword.value;
        const passwordConfirm = signupPasswordConfirm.value;
        
        if (!email || !password || !passwordConfirm) {
            showError('모든 필드를 입력해주세요.');
            return;
        }
        
        if (password !== passwordConfirm) {
            showError('비밀번호가 일치하지 않습니다.');
            return;
        }
        
        if (password.length < 6) {
            showError('비밀번호는 최소 6자 이상이어야 합니다.');
            return;
        }
        
        signUp(email, password);
    });
    
    // 할 일 내용 수정 버튼 이벤트
    editTaskContentBtn.addEventListener('click', () => {
        editTaskContent();
    });
    
    // 상세 정보 폼 제출
    taskDetailForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const formData = {
            description: detailDescription.value.trim(),
            deadline: detailDeadline.value,
            estimated_time: detailEstimatedTime.value,
            notes: detailNotes.value.trim(),
            requires_review: detailRequiresReview.checked,
            is_recurring: detailIsRecurring.checked
        };
        
        if (!formData.description) {
            showError('상세 설명은 필수입니다.');
            return;
        }
        
        saveTaskDetails(formData);
    });
    
    // 태그 관리 모달 이벤트
    manageTagsBtn.addEventListener('click', () => {
        tagModal.classList.remove('hidden');
        renderTagModal();
    });
    
    closeTagModal.addEventListener('click', () => {
        tagModal.classList.add('hidden');
    });
    
    closeTagModalBtn.addEventListener('click', () => {
        tagModal.classList.add('hidden');
    });
    
    // 태그 추가
    addTagBtn.addEventListener('click', () => {
        addTag(newTagInput.value);
    });
    
    newTagInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addTag(newTagInput.value);
        }
    });
    
    // 태그 관리 모달 내 이벤트 위임
    tagsList.addEventListener('click', (e) => {
        const target = e.target;
        
        // 태그 수정
        if (target.closest('.edit-tag-btn')) {
            const tagId = target.closest('.edit-tag-btn').dataset.tagId;
            const tagName = target.closest('.edit-tag-btn').dataset.tagName;
            editTagInPlace(tagId, tagName);
        }
        
        // 태그 삭제
        if (target.closest('.delete-tag-btn')) {
            const tagId = target.closest('.delete-tag-btn').dataset.tagId;
            if (confirm('정말로 이 태그를 삭제하시겠습니까? 관련된 할 일의 태그도 제거됩니다.')) {
                deleteTag(tagId);
            }
        }
    });
    
    // 키보드 단축키
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + Enter로 할 일 추가
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && document.activeElement === taskInput) {
            e.preventDefault();
            addTask(taskInput.value);
        }
        
        // Escape로 입력 필드 초기화
        if (e.key === 'Escape' && document.activeElement === taskInput) {
            taskInput.value = '';
            taskInput.blur();
        }
        
        // Escape로 모달 닫기
        if (e.key === 'Escape' && !tagModal.classList.contains('hidden')) {
            tagModal.classList.add('hidden');
        }
        
        if (e.key === 'Escape' && !taskDetailModal.classList.contains('hidden')) {
            taskDetailModal.classList.add('hidden');
        }
    });
}

// 날짜 포맷팅 함수
function formatDate(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // 오늘
    if (diffDays === 1 && date.toDateString() === now.toDateString()) {
        return '오늘';
    }
    
    // 어제
    if (diffDays === 2 && date.toDateString() === new Date(now.getTime() - 24 * 60 * 60 * 1000).toDateString()) {
        return '어제';
    }
    
    // 7일 이내
    if (diffDays <= 7) {
        return `${diffDays - 1}일 전`;
    }
    
    // 그 외
    return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// 유틸리티 함수
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showLoading(show) {
    if (show) {
        loadingOverlay.classList.remove('hidden');
    } else {
        loadingOverlay.classList.add('hidden');
    }
}

function showSuccess(message) {
    // 성공 메시지 표시 (토스트 메시지 스타일)
    const successDiv = document.createElement('div');
    successDiv.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
    successDiv.textContent = message;
    
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
        successDiv.remove();
    }, 3000);
}

function showError(message) {
    // 간단한 에러 표시 (토스트 메시지 스타일)
    const errorDiv = document.createElement('div');
    errorDiv.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
    errorDiv.textContent = message;
    
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        errorDiv.remove();
    }, 3000);
}

// 앱 시작
document.addEventListener('DOMContentLoaded', initApp); 