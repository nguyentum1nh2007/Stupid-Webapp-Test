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
let countOrder = 0;
let recycleBin = [];
let recycleTask = null;
let recycleBinGroups = [];

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

    const storedRecycle = localStorage.getItem('recycle_bin');
    if (storedRecycle) {
        recycleBin = JSON.parse(storedRecycle);
    } else {
        recycleBin = [];
    }

    // Load deleted groups
    const storedRecycleGroups = localStorage.getItem('recycle_bin_groups');
    if (storedRecycleGroups) {
        recycleBinGroups = JSON.parse(storedRecycleGroups);
    } else {
        recycleBinGroups = [];
    }
}

function saveDataToStorage() {
    localStorage.setItem("todo_groups", JSON.stringify(groups));
    localStorage.setItem('todo_tasks', JSON.stringify(tasks));
    localStorage.setItem('recycle_bin', JSON.stringify(recycleBin));
    // NEW: Save deleted groups
    localStorage.setItem('recycle_bin_groups', JSON.stringify(recycleBinGroups));
}

function deleteAllBinData() {
    localStorage.removeItem('recycle_bin');
    localStorage.removeItem('recycle_bin_groups');
    recycleBin.length = 0;
    recycleBinGroups.length = 0;
    renderRecycleBin();
}

function resetAllData() {
    localStorage.removeItem("todo_groups");
    localStorage.removeItem('todo_tasks');
    localStorage.removeItem('recycle_bin');
    localStorage.removeItem('recycle_bin_groups');
    location.reload();
}

function renderGroups() {
    groupListEl.innerHTML = '';

    const groupSearch = document.getElementById('groupSearchInput').value.toLowerCase();
    const filteredGroups = groups.filter(g => g.toLowerCase().includes(groupSearch));

    filteredGroups.forEach(group => {
        const li = document.createElement('li');
        li.className = `group-item ${currentGroup === group ? 'active' : ''}`;

        const deleteBtnHTML = group !== "All"
            ? `<span class="deleteGroupBtn" onclick="deleteGroup(event, '${group}')">X</span>`
            : ``;

        li.innerHTML = `<span>${group}</span> ${deleteBtnHTML}`;

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
    if (countOrder % 2 != 0) {
        filteredTasks.reverse();
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

function reverseOrder() {
    countOrder += 1;
    renderTasks();
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
            document.getElementById('inputTaskGroup').value = "";
        }
        document.getElementById('inputTaskStatus').value = "None";
        document.getElementById('inputTaskPriority').value = "None";
        document.getElementById('inputTaskDate').value = new Date().toLocaleDateString('en-GB');
        document.getElementById('inputTaskUpdate').value = new Date().toLocaleDateString('en-GB');
        document.getElementById('inputTaskDateCont').style.display = 'block';
        document.getElementById('inputTaskUpdateCont').style.display = 'none';
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
    if (!group) { alert("Group is required!"); return; }
    if (!status) { alert("Status is required!"); return; }
    if (!priority) { alert("Priority is required!"); return; }

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
        saveToRecycleBin(isEditingId);
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

function restoreTask(id) {
    const restoredTask = recycleBin.splice(id, 1)[0];
    tasks.push(restoredTask);

    saveDataToStorage();
    renderTasks();
    renderRecycleBin();
}


function deleteGroup(event, groupName) {
    event.stopPropagation();
    // Find the tasks associated with this group
    const groupTasks = tasks.filter(t => t.group === groupName);
    // Save the group name and its tasks to the new recycleBinGroups array
    recycleBinGroups.push({
        name: groupName,
        tasks: groupTasks
    });
    // Remove the group and its tasks from the active lists
    groups = groups.filter(g => g !== groupName);
    tasks = tasks.filter(t => t.group !== groupName);

    if (currentGroup === groupName) {
        currentGroup = "All";
    }
    saveDataToStorage();
    renderGroups();
    renderTasks();
    populateGroupSelect();
}

function restoreGroup(index) {
    const restoredGroupData = recycleBinGroups.splice(index, 1)[0];
    // Put the group back if it doesn't exist
    if (!groups.includes(restoredGroupData.name)) {
        groups.push(restoredGroupData.name);
    }
    // Put all associated tasks back
    restoredGroupData.tasks.forEach(task => {
        tasks.push(task);
    });
    saveDataToStorage();
    renderGroups();
    renderTasks();
    populateGroupSelect();
    renderRecycleBin();
}
initApp();