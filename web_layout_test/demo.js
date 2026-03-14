const defaultGroups = ["All", "BA", "LKV", "PMR", "PO", "Scrum", "Test"];
let defaultTasks = null;

let groups = [];
let tasks = [];
let currentGroup = "All";
let searchText = "";
let filterStatus = "All";
let filterPriority = "All";
let filterTime = "All";
let isEditingId = null;
let optionSort = "None";

const taskListContainer = document.getElementById('taskListContainer');
const groupListEl = document.getElementById('groupList');
const taskPanel = document.getElementById('taskPanel');
const groupModal = document.getElementById('groupModal');

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

async function initApp() {
    defaultTasks = await fetchData();
    loadDataFromStorage();

    renderGroups();
    renderTasks();
    populateGroupSelect();
}

function loadDataFromStorage() {
    const storedGroups = localStorage.getItem('todo_groups');
    const storedTasks = localStorage.getItem('todo_tasks');
    if (storedGroups) {
        groups = JSON.parse(storedGroups);
    } else {
        groups = [...defaultGroups];
        localStorage.setItem("todo_groups", JSON.stringify(groups));
    }
    let fetchedTasks = [];
    if (defaultTasks) {
        fetchedTasks = Array.isArray(defaultTasks) ? defaultTasks : (defaultTasks.tasks || []);
    }

    if (storedTasks) {
        tasks = JSON.parse(storedTasks);

        if (tasks.length === 0 && fetchedTasks.length > 0) {
            tasks = [...fetchedTasks];
            localStorage.setItem('todo_tasks', JSON.stringify(tasks));
        }
    } else {
        tasks = [...fetchedTasks];
        localStorage.setItem('todo_tasks', JSON.stringify(tasks));
    }
}

function saveDataToStorage() {
    localStorage.setItem("todo_groups", JSON.stringify(groups));
    localStorage.setItem('todo_tasks', JSON.stringify(tasks));
}

function resetAllData() {
    localStorage.removeItem("todo_groups");
    localStorage.removeItem('todo_tasks');
    location.reload();
}

function renderGroups() {
    groupListEl.innerHTML = '';

    const groupSearch = document.getElementById('groupSearchInput').value.toLowerCase();
    const filteredGroups = groups.filter(g => g.toLowerCase().includes(groupSearch));

    filteredGroups.forEach(group => {
        const li = document.createElement('li');
        li.className = `group-item ${currentGroup === group ? 'active' : ''}`;
        li.innerHTML = `<span>${group}</span> <span>...</span>`;
        li.onclick = () => {
            currentGroup = group;
            renderGroups();
            renderTasks();
        };
        groupListEl.appendChild(li);
    });
}

function renderTasks() {
    taskListContainer.innerHTML = '';

    const filteredTasks = tasks.filter(task => {
        const matchesGroup = currentGroup === "All" || task.group === currentGroup;
        let matchesStr = task.title.normalize('NFD')
        matchesStr = matchesStr.replace(/[\u0300-\u036f]/g, '');
        matchesStr = matchesStr.replace(/đ/g, 'd');
        matchesStr = matchesStr.replace(/Đ/g, 'D');

        let normalizedSearch = searchText.normalize('NFD')
        normalizedSearch = normalizedSearch.replace(/[\u0300-\u036f]/g, '');
        normalizedSearch = normalizedSearch.replace(/đ/g, 'd');
        normalizedSearch = normalizedSearch.replace(/Đ/g, 'D');

        const matchesSearch = matchesStr.toLowerCase().includes(normalizedSearch.toLowerCase());
        const matchesStatus = filterStatus === "All" || task.status === filterStatus;
        const matchesPriority = filterPriority === "All" || task.priority === filterPriority;

        return matchesGroup && matchesSearch && matchesStatus && matchesPriority;
    });

    if (filteredTasks.length === 0) {
        taskListContainer.innerHTML = '<div style="text-align:center; padding:40px; color:#999;">No tasks found.</div>';
        return;
    } else {
        if (optionSort === "Name") {
            filteredTasks.sort((a, b) => a.title.localeCompare(b.title));
        }
        if (optionSort === "Status") {
            filteredTasks.sort((a, b) => a.status.localeCompare(b.status));
        }
    }

    filteredTasks.forEach(task => {
        const div = document.createElement('div');
        div.className = 'task-item';
        div.onclick = () => openTaskPanel(task);

        let priorityClass = 'p-low';
        if (task.priority === 'High') priorityClass = 'p-high';
        if (task.priority === 'Medium') priorityClass = 'p-medium';

        const checkClass = task.status === 'Done' ? 'checked' : '';

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
            <div class="task-date">${task.date} ></div>
        `;
        taskListContainer.appendChild(div);
    });
}

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

function toggleTaskStatus(id) {
    const task = tasks.find(t => t.id === id);
    if (task) {
        task.status = task.status === "Pending" ? "Done" : "Pending";
        saveDataToStorage();
        renderTasks();
    }
}

// Event Listeners
document.getElementById('taskSearchInput').addEventListener('input', (e) => {
    searchText = e.target.value;
    renderTasks();
});

document.getElementById('groupSearchInput').addEventListener('input', (e) => {
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

function openTaskPanel(task = null) {
    taskPanel.classList.add('open');
    const deleteBtn = document.getElementById('deleteBtn');

    if (task) {
        isEditingId = task.id;
        document.getElementById('inputTaskTitle').value = task.title;
        document.getElementById('inputTaskDesc').value = task.description || "";
        document.getElementById('inputTaskGroup').value = task.group;
        document.getElementById('inputTaskStatus').value = task.status;
        document.getElementById('inputTaskPriority').value = task.priority;
        document.getElementById('inputTaskDateCont').style.display = 'none';
        document.getElementById('inputTaskUpdateCont').style.display = 'block';
        document.getElementById('inputTaskUpdate').value = new Date().toLocaleDateString('en-GB');
        deleteBtn.style.display = 'block';
    } else {
        isEditingId = null;
        document.getElementById('inputTaskTitle').value = "";
        document.getElementById('inputTaskDesc').value = "";
        if (currentGroup !== "All") {
            document.getElementById('inputTaskGroup').value = currentGroup;
        } else if (groups.length > 1) {
            document.getElementById('inputTaskGroup').value = groups[1];
        }
        document.getElementById('inputTaskStatus').value = "None";
        document.getElementById('inputTaskPriority').value = "None";
        document.getElementById('inputTaskDate').value = new Date().toLocaleDateString('en-GB');
        document.getElementById('inputTaskUpdate').value = new Date().toLocaleDateString('en-GB');
        document.getElementById('inputTaskDateCont').style.display = 'none';
        document.getElementById('inputTaskUpdateCont').style.display = 'block';
        deleteBtn.style.display = 'none';
    }
}

function closeTaskPanel() {
    taskPanel.classList.remove('open');
}

function saveTask() {
    const title = document.getElementById('inputTaskTitle').value;
    const desc = document.getElementById('inputTaskDesc').value;
    const group = document.getElementById('inputTaskGroup').value;
    const status = document.getElementById('inputTaskStatus').value;
    const priority = document.getElementById('inputTaskPriority').value;

    if (!title) { alert("Title is required"); return; }

    if (isEditingId) {
        const task = tasks.find(t => t.id === isEditingId);
        task.title = title;
        task.description = desc;
        task.group = group;
        task.status = status;
        task.priority = priority;
        task.lastUpdated = new Date().toLocaleString();
    } else {
        const newTask = {
            id: Date.now(),
            title: title,
            description: desc,
            group: group,
            status: status,
            priority: priority,
            date: new Date().toLocaleDateString('en-GB'),
            update: new Date().toLocaleDateString('en-GB')
        };
        tasks.push(newTask);
    }
    saveDataToStorage();
    renderTasks();
    closeTaskPanel();
}

function deleteCurrentTask() {
    if (isEditingId) {
        tasks = tasks.filter(t => t.id !== isEditingId);
        saveDataToStorage();
        renderTasks();
        closeTaskPanel();
    }
}

function openGroupModal() {
    groupModal.classList.add('show');
    document.getElementById('newGroupName').value = '';
    document.getElementById('newGroupName').focus();
}

function closeGroupModal() {
    groupModal.classList.remove('show');
}

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



initApp();