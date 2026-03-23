// --- Global Variables & Initial State ---
// Default categories if none exist in local storage
const defaultGroups = ["All", "BA", "LKV", "PMR", "PO", "Scrum", "Test"];
let defaultTasks = null; // Will hold tasks fetched from demo.json

// State arrays to hold our current working data
let groups = [];
let tasks = [];
let currentGroup = "All"; // Currently selected group filter

// Filter and sorting states
let searchText = "";
let searchTextGroup = "";
let filterStatus = "All";
let filterPriority = "All";
let filterTime = "All";
let isEditingId = null; // Tracks if we are editing an existing task (holds ID) or creating a new one (null)
let optionSort = "None";
let countOrder = 0; // Used to toggle ascending/descending sorts

// Recycle bin states
let recycleBin = [];
let recycleTask = null;
let recycleBinGroups = [];
let confirmation = false;

// --- DOM Elements ---
// Caching DOM elements for performance so we don't query the DOM repeatedly
const taskListContainer = document.getElementById('taskListContainer');
const groupListEl = document.getElementById('groupList');
const taskPanel = document.getElementById('taskPanel');
const groupModal = document.getElementById('groupModal');

// --- Initialization Functions ---

/**
 * Fetches initial task data from a local JSON file.
 * Returns the parsed JSON or null if an error occurs.
 */
async function fetchData() {
    try {
        const response = await fetch('./demo.json');
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("An error occurred fetching data:", error);
        return null;
    }
}

/**
 * Main entry point for the application.
 * Fetches data, loads local storage, and renders the initial UI.
 */
async function initApp() {
    defaultTasks = await fetchData();
    loadDataFromStorage();

    // Render UI components based on loaded data
    renderGroups();
    renderTasks();
    populateGroupSelect();
}

/**
 * Loads groups, tasks, and recycle bin data from the browser's localStorage.
 * If data is missing, it falls back to the default variables.
 */
function loadDataFromStorage() {
    const storedGroups = localStorage.getItem('todo_groups');
    const storedTasks = localStorage.getItem('todo_tasks');

    // Load or initialize groups
    if (storedGroups) {
        groups = JSON.parse(storedGroups);
    } else {
        groups = [...defaultGroups];
        localStorage.setItem("todo_groups", JSON.stringify(groups));
    }

    // Process fetched tasks array
    let fetchedTasks = [];
    if (defaultTasks) {
        fetchedTasks = Array.isArray(defaultTasks) ? defaultTasks : (defaultTasks.tasks || []);
    }

    // Load or initialize tasks
    if (storedTasks) {
        tasks = JSON.parse(storedTasks);
        // If local storage is empty but we fetched default tasks, use the default tasks
        if (tasks.length === 0 && fetchedTasks.length > 0) {
            tasks = [...fetchedTasks];
            localStorage.setItem('todo_tasks', JSON.stringify(tasks));
        }
    } else {
        tasks = [...fetchedTasks];
        localStorage.setItem('todo_tasks', JSON.stringify(tasks));
    }

    // Load recycle bin for individual tasks
    const storedRecycle = localStorage.getItem('recycle_bin');
    if (storedRecycle) {
        recycleBin = JSON.parse(storedRecycle);
    } else {
        recycleBin = [];
    }

    // Load recycle bin for deleted groups
    const storedRecycleGroups = localStorage.getItem('recycle_bin_groups');
    if (storedRecycleGroups) {
        recycleBinGroups = JSON.parse(storedRecycleGroups);
    } else {
        recycleBinGroups = [];
    }
}

/**
 * Utility function to persist all current state data back to localStorage.
 */
function saveDataToStorage() {
    localStorage.setItem("todo_groups", JSON.stringify(groups));
    localStorage.setItem('todo_tasks', JSON.stringify(tasks));
    localStorage.setItem('recycle_bin', JSON.stringify(recycleBin));
    localStorage.setItem('recycle_bin_groups', JSON.stringify(recycleBinGroups));
}

// --- Data Destruction / Reset Functions ---

/**
 * Empties the recycle bin entirely after user confirmation.
 */
async function deleteAllBinData() {
    const confirmDelete = await showConfirmModal("Are you sure you want to empty the recycle bin?");
    if (!confirmDelete) return;

    localStorage.removeItem('recycle_bin');
    localStorage.removeItem('recycle_bin_groups');
    recycleBin.length = 0;
    recycleBinGroups.length = 0;
    renderRecycleBin();
}

/**
 * Hard reset of the entire application. Clears all localStorage keys and reloads the page.
 */
function resetAllData() {
    localStorage.removeItem("todo_groups");
    localStorage.removeItem('todo_tasks');
    localStorage.removeItem('recycle_bin');
    localStorage.removeItem('recycle_bin_groups');
    location.reload();
}

// --- Rendering Functions ---

/**
 * Renders the sidebar list of task groups.
 * Includes text normalization to allow searching without matching exact accents/diacritics.
 */
function renderGroups() {
    groupListEl.innerHTML = '';

    const filteredGroups = groups.filter(g => {
        // Normalize strings to remove accents (e.g., Vietnamese characters) for better searching
        let matchesStr = g.normalize('NFD')
        matchesStr = matchesStr.replace(/[\u0300-\u036f]/g, '');
        matchesStr = matchesStr.replace(/đ/g, 'd');
        matchesStr = matchesStr.replace(/Đ/g, 'D');

        let normalizedSearch = searchTextGroup.normalize('NFD')
        normalizedSearch = normalizedSearch.replace(/[\u0300-\u036f]/g, '');
        normalizedSearch = normalizedSearch.replace(/đ/g, 'd');
        normalizedSearch = normalizedSearch.replace(/Đ/g, 'D');

        return matchesStr.toLowerCase().includes(normalizedSearch.toLowerCase());
    });

    // Build the DOM elements for each group
    filteredGroups.forEach(group => {
        const li = document.createElement('li');
        li.className = `group-item ${currentGroup === group ? 'active' : ''}`; // Highlight active group

        // Don't allow deletion of the default "All" group
        const deleteBtnHTML = group !== "All"
            ? `<span class="deleteGroupBtn" onclick="deleteGroup(event, '${group}')">X</span>`
            : ``;

        li.innerHTML = `<span>${group}</span> ${deleteBtnHTML}`;

        // Clicking a group sets it as active and re-renders tasks
        li.onclick = () => {
            currentGroup = group;
            renderGroups();
            renderTasks();
        };
        groupListEl.appendChild(li);
    });
}

/**
 * Renders the main list of tasks based on all active filters (group, text, status, priority, time).
 */
function renderTasks() {
    taskListContainer.innerHTML = '';

    // Standardize today's date at midnight for accurate time-based filtering
    const todayObj = new Date();
    todayObj.setHours(0, 0, 0, 0);

    const filteredTasks = tasks.filter(task => {
        // 1. Filter by Group
        const matchesGroup = currentGroup === "All" || task.group === currentGroup;

        // 2. Filter by Search Text (normalized for diacritics)
        let matchesStr = task.title.normalize('NFD')
        matchesStr = matchesStr.replace(/[\u0300-\u036f]/g, '');
        matchesStr = matchesStr.replace(/đ/g, 'd');
        matchesStr = matchesStr.replace(/Đ/g, 'D');

        let normalizedSearch = searchText.normalize('NFD')
        normalizedSearch = normalizedSearch.replace(/[\u0300-\u036f]/g, '');
        normalizedSearch = normalizedSearch.replace(/đ/g, 'd');
        normalizedSearch = normalizedSearch.replace(/Đ/g, 'D');

        const matchesSearch = matchesStr.toLowerCase().includes(normalizedSearch.toLowerCase());

        // 3. Filter by Status & Priority
        const matchesStatus = filterStatus === "All" || task.status === filterStatus;
        const matchesPriority = filterPriority === "All" || task.priority === filterPriority;

        // 4. Filter by Time (based on update date)
        let matchesTime = false;
        if (filterTime === "All") {
            matchesTime = true;
        } else {
            const taskUpdateObj = parseDateString(task.update || task.date);
            taskUpdateObj.setHours(0, 0, 0, 0);

            // Calculate difference in days
            const diffTime = todayObj.getTime() - taskUpdateObj.getTime();
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

            if (filterTime === "Today") {
                matchesTime = (diffDays === 0);
            } else if (filterTime === "Last7Days") {
                matchesTime = (diffDays >= 0 && diffDays <= 7);
            } else if (filterTime === "Last30Days") {
                matchesTime = (diffDays >= 0 && diffDays <= 30);
            } else if (filterTime === "LongAgo") {
                matchesTime = (diffDays > 30);
            }
        }

        return matchesGroup && matchesSearch && matchesStatus && matchesPriority && matchesTime;
    });

    // Handle empty state
    if (filteredTasks.length === 0) {
        taskListContainer.innerHTML = '<div style="text-align:center; padding:40px; color:#999;">No tasks found.</div>';
        return;
    } else {
        // Apply Sorting logic
        if (optionSort === "Name") {
            filteredTasks.sort((a, b) => a.title.localeCompare(b.title));
        }
        if (optionSort === "Status") {
            filteredTasks.sort((a, b) => a.status.localeCompare(b.status));
        }
    }

    // Apply ascending/descending reversal based on user clicks
    if (countOrder % 2 != 0) {
        filteredTasks.reverse();
    }

    // Build DOM elements for each task
    filteredTasks.forEach(task => {
        const div = document.createElement('div');
        div.className = 'task-item';
        div.onclick = () => openTaskPanel(task); // Clicking opens the detail panel

        // Determine badge styling based on priority
        let priorityClass = 'p-low';
        if (task.priority === 'High') priorityClass = 'p-high';
        if (task.priority === 'Medium') priorityClass = 'p-medium';

        const checkClass = task.status === 'Done' ? 'checked' : '';

        // Construct task HTML
        div.innerHTML = `
            <div class="checkbox ${checkClass}" onclick="event.stopPropagation(); toggleTaskStatus(${task.id})"></div>
            <div class="task-content">
                <div class="task-title" style="${task.status === 'Done' ? 'text-decoration: line-through; color:#aaa;' : ''}">
                    ${task.title}
                </div>
                <div class="task-meta">
                    <span>Group: ${task.group}</span>
                    <span>•</span>
                    <span>Status: ${task.status}</span>
                    <span>•</span>
                    <span class="badge ${priorityClass}">${task.priority}</span>
                </div>
            </div>
            <div class="task-date" style="display: flex; flex-direction: column; align-items: flex-end; font-size: 0.8rem; color: #888;">
                <span style="font-weight: 600; color: #333;">${task.date}</span>
                <span>Updated: ${task.update || task.date}</span>
            </div>
        `;
        taskListContainer.appendChild(div);
    });
}

/**
 * Toggles sort direction and triggers a re-render.
 */
function reverseOrder() {
    countOrder += 1;
    renderTasks();
}

/**
 * Populates the 'Group' dropdown in the New/Edit Task panel with current active groups.
 */
function populateGroupSelect() {
    const select = document.getElementById('inputTaskGroup');
    select.innerHTML = '';
    groups.filter(g => g !== 'All').forEach(g => {
        const opt = document.createElement('option');
        opt.value = g;
        opt.innerText = g;
        select.appendChild(opt);
    });
}

/**
 * Quick toggle for marking a task Done/Pending directly from the list view checkbox.
 */
function toggleTaskStatus(id) {
    const task = tasks.find(t => t.id === id);
    if (task) {
        task.status = task.status === "Pending" ? "Done" : "Pending";
        saveDataToStorage();
        renderTasks();
    }
}

// --- Event Listeners for Filters ---
document.getElementById('taskSearchInput').addEventListener('input', (e) => {
    searchText = e.target.value;
    renderTasks();
});

document.getElementById('groupSearchInput').addEventListener('input', (e) => {
    searchTextGroup = e.target.value;
    renderGroups();
});

document.getElementById('statusFilter').addEventListener('change', (e) => {
    filterStatus = e.target.value;
    renderTasks();
});

document.getElementById('priorityFilter').addEventListener('change', (e) => {
    filterPriority = e.target.value;
    renderTasks();
});

document.getElementById('timeFilter').addEventListener('change', (e) => {
    filterTime = e.target.value;
    renderTasks();
});

document.getElementById('sortOption').addEventListener('change', (e) => {
    optionSort = e.target.value;
    renderTasks();
});


// --- Task Panel (Create/Edit) Functions ---

/**
 * Opens the sliding side panel. Populates fields if editing, or clears them if creating new.
 */
function openTaskPanel(task = null) {
    taskPanel.classList.add('open');
    const deleteBtn = document.getElementById('deleteBtn');

    if (task) {
        // Edit Mode
        isEditingId = task.id;
        document.getElementById('inputTaskTitle').value = task.title;
        document.getElementById('inputTaskDesc').value = task.description || "";
        document.getElementById('inputTaskGroup').value = task.group;
        document.getElementById('inputTaskStatus').value = task.status;
        document.getElementById('inputTaskPriority').value = task.priority;

        // Show updated date fields when editing, hide creation date field
        document.getElementById('inputTaskDateCont').style.display = 'none';
        document.getElementById('inputTaskUpdateCont').style.display = 'block';

        document.getElementById('inputTaskDate').value = task.date || "";
        document.getElementById('inputTaskUpdate').value = new Date().toLocaleDateString('en-GB');

        deleteBtn.style.display = 'block'; // Allow deleting existing tasks
    } else {
        // Create Mode
        isEditingId = null;
        document.getElementById('inputTaskTitle').value = "";
        document.getElementById('inputTaskDesc').value = "";

        // Auto-select the current active group if applicable
        if (currentGroup !== "All") {
            document.getElementById('inputTaskGroup').value = currentGroup;
        } else if (groups.length > 1) {
            document.getElementById('inputTaskGroup').value = "";
        }

        document.getElementById('inputTaskStatus').value = "Pending";
        document.getElementById('inputTaskPriority').value = "Medium";

        // Set both to today's date for new tasks
        document.getElementById('inputTaskDate').value = new Date().toLocaleDateString('en-GB');
        document.getElementById('inputTaskUpdate').value = new Date().toLocaleDateString('en-GB');

        document.getElementById('inputTaskDateCont').style.display = 'block';
        document.getElementById('inputTaskUpdateCont').style.display = 'none';
        deleteBtn.style.display = 'none'; // Cannot delete an unsaved task
    }
}

/**
 * Validates inputs and either saves a new task or updates an existing one.
 */
function saveTask() {
    const title = document.getElementById('inputTaskTitle').value;
    const desc = document.getElementById('inputTaskDesc').value;
    const group = document.getElementById('inputTaskGroup').value;
    const status = document.getElementById('inputTaskStatus').value;
    const priority = document.getElementById('inputTaskPriority').value;

    const taskDate = document.getElementById('inputTaskDate').value;
    const taskUpdate = document.getElementById('inputTaskUpdate').value;

    // Basic Validation
    if (!title) { alert("Title is required"); return; }
    if (!group) { alert("Group is required!"); return; }
    if (!status) { alert("Status is required!"); return; }
    if (!priority) { alert("Priority is required!"); return; }

    if (isEditingId) {
        // Update existing task
        const task = tasks.find(t => t.id === isEditingId);
        task.title = title;
        task.description = desc;
        task.group = group;
        task.status = status;
        task.priority = priority;
        task.date = taskDate;
        task.update = taskUpdate;
    } else {
        // Create new task
        const newTask = {
            id: Date.now(), // Generate a simple unique ID based on timestamp
            title: title,
            description: desc,
            group: group,
            status: status,
            priority: priority,
            date: taskDate || new Date().toLocaleDateString('en-GB'),
            update: taskUpdate || new Date().toLocaleDateString('en-GB')
        };
        tasks.push(newTask);
    }

    saveDataToStorage();
    renderTasks();
    closeTaskPanel();
}

function closeTaskPanel() {
    taskPanel.classList.remove('open');
}

/**
 * Prompts user for confirmation, then moves the currently edited task to the recycle bin.
 */
async function deleteCurrentTask() {
    if (isEditingId) {
        const confirmDelete = await showConfirmModal("Are you sure you want to delete this task?");
        if (!confirmDelete) return;

        saveToRecycleBin(isEditingId);
        tasks = tasks.filter(t => t.id !== isEditingId);
        saveDataToStorage();
        renderTasks();
        closeTaskPanel();
    }
}


// --- Group Modal Functions ---

function openGroupModal() {
    groupModal.classList.add('show');
    document.getElementById('newGroupName').value = '';
    document.getElementById('newGroupName').focus();
}

function closeGroupModal() {
    groupModal.classList.remove('show');
}

/**
 * Adds a new group to the groups array if it doesn't already exist.
 */
function saveGroup() {
    const name = document.getElementById('newGroupName').value.trim();
    if (name && !groups.includes(name)) {
        groups.push(name);
        saveDataToStorage();
        renderGroups();
        populateGroupSelect();
        closeGroupModal();
    } else if (groups.includes(name)) {
        alert("Group already exists!");
    }
}

function syncAndRender() {
    saveDataToStorage();
    renderTasks();
}

// --- Recycle Bin Logic ---

/**
 * Pushes a deleted task into the recycle bin array.
 */
function saveToRecycleBin(id) {
    recycleTask = tasks.find(t => t.id == id);
    recycleBin.push(recycleTask);
}

function openRecycleBin() {
    document.getElementById('recycleBinModal').classList.add('show');
    renderRecycleBin();
}

function closeRecycleBin() {
    document.getElementById('recycleBinModal').classList.remove('show');
}

/**
 * A reusable, promise-based custom confirmation modal. 
 * Replaces the native browser `confirm()` with a stylized UI modal.
 */
function showConfirmModal(message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmationModal');
        const messageEl = document.getElementById('confirmationMessage');
        const confirmBtn = document.getElementById('confirmBtn');
        const cancelBtn = document.getElementById('cancelConfirmBtn');

        // Set the message and show the modal
        messageEl.innerText = message;
        modal.classList.add('show');

        const handleConfirm = () => {
            modal.classList.remove('show');
            cleanup();
            resolve(true); // Resolves the promise with true
        };

        const handleCancel = () => {
            modal.classList.remove('show');
            cleanup();
            resolve(false); // Resolves the promise with false
        };

        // Clean up event listeners so they don't stack up on multiple calls
        const cleanup = () => {
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
        };

        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
    });
}

function confirmTrue() {
    confirmation = true;
}

function cancelFalse() {
    confirmation = false;
}

/**
 * Renders the contents of the recycle bin modal (both deleted groups and deleted tasks).
 */
function renderRecycleBin() {
    const container = document.getElementById('recycleBinList');
    container.innerHTML = '';

    if (recycleBin.length === 0 && recycleBinGroups.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#999;">Recycle bin is empty.</div>';
        return;
    }

    // Render Deleted Groups Section
    if (recycleBinGroups.length > 0) {
        const groupHeader = document.createElement('h4');
        groupHeader.innerText = "Deleted Groups";
        groupHeader.style.marginBottom = "10px";
        groupHeader.style.borderBottom = "1px solid #ccc";
        container.appendChild(groupHeader);

        recycleBinGroups.forEach((groupData, index) => {
            const item = document.createElement('div');
            item.style = "display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #eee; background: #fdfaf6; margin-bottom: 5px; border-radius: 4px;";
            item.innerHTML = `
                <div>
                    <div style="font-weight:600;">Group: ${groupData.name}</div>
                    <div style="font-size:0.75rem; color:#888;">Tasks included: ${groupData.tasks.length}</div>
                </div>
                <button class="btn btn-yellow" style="padding: 4px 10px; font-size: 0.8rem;" onclick="restoreGroup(${index})">Restore Group</button>
            `;
            container.appendChild(item);
        });
    }

    // Render Deleted Individual Tasks Section
    if (recycleBin.length > 0) {
        const taskHeader = document.createElement('h4');
        taskHeader.innerText = "Deleted Tasks";
        taskHeader.style.marginTop = "15px";
        taskHeader.style.marginBottom = "10px";
        taskHeader.style.borderBottom = "1px solid #ccc";
        container.appendChild(taskHeader);

        recycleBin.forEach((task, index) => {
            const item = document.createElement('div');
            item.style = "display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #eee;";
            item.innerHTML = `
                <div>
                    <div style="font-weight:600;">${task.title}</div>
                    <div style="font-size:0.75rem; color:#888;">Group: ${task.group}</div>
                </div>
                <button class="btn btn-yellow" style="padding: 4px 10px; font-size: 0.8rem;" onclick="restoreTask(${index})">Restore Task</button>
            `;
            container.appendChild(item);
        });
    }
}

/**
 * Removes a task from the recycle bin and puts it back into the active tasks array.
 */
function restoreTask(id) {
    const restoredTask = recycleBin.splice(id, 1)[0];
    tasks.push(restoredTask);

    saveDataToStorage();
    renderTasks();
    renderRecycleBin();
}

/**
 * Deletes a group and moves the group along with ALL its associated tasks to the recycle bin.
 */
async function deleteGroup(event, groupName) {
    event.stopPropagation(); // Prevent triggering the group selection when clicking the 'X'

    const confirmDelete = await showConfirmModal(`Are you sure you want to delete the group "${groupName}" and all of its tasks?`);
    if (!confirmDelete) return;

    // Find the tasks associated with this group
    const groupTasks = tasks.filter(t => t.group === groupName);

    // Save the group name and its tasks to the recycleBinGroups array
    if (typeof recycleBinGroups !== 'undefined') {
        recycleBinGroups.push({
            name: groupName,
            tasks: groupTasks
        });
    }

    // Remove the group and its tasks from the active lists
    groups = groups.filter(g => g !== groupName);
    tasks = tasks.filter(t => t.group !== groupName);

    // Reset current filter to "All" if the active group is deleted
    if (currentGroup === groupName) {
        currentGroup = "All";
    }

    saveDataToStorage();
    renderGroups();
    renderTasks();
    populateGroupSelect();
}

/**
 * Restores a deleted group and repopulates all tasks that belonged to it.
 */
function restoreGroup(index) {
    const restoredGroupData = recycleBinGroups.splice(index, 1)[0];

    // Put the group back if it doesn't currently exist
    if (!groups.includes(restoredGroupData.name)) {
        groups.push(restoredGroupData.name);
    }
    // Put all associated tasks back into the main active task list
    restoredGroupData.tasks.forEach(task => {
        tasks.push(task);
    });

    saveDataToStorage();
    renderGroups();
    renderTasks();
    populateGroupSelect();
    renderRecycleBin();
}

// --- Utility Functions ---

/**
 * Helper to parse a DD/MM/YYYY string into a standard JavaScript Date object.
 * Necessary for accurate time-based calculations (like the 'Time' filter).
 */
function parseDateString(dateStr) {
    if (!dateStr) return new Date();
    const parts = dateStr.split('/');
    if (parts.length === 3) {
        // Month in JS Date object is 0-indexed (0-11)
        return new Date(parts[2], parts[1] - 1, parts[0]);
    }
    return new Date();
}

// Bootstrap the application on script load
initApp();