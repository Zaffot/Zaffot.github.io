const taskInput = document.getElementById('taskInput');
const taskList = document.getElementById('taskList');
const tasks = [];

taskInput.addEventListener("keypress", function(event) {
    if (event.key === "Enter") {
      addTask();
    }
  });


class Task{
    constructor(text){
        this.text = text;
        this.completed = false;
        this.id = Date.now(); // unique ID For each task.
    }
}

function addTask() {
    const taskText = taskInput.value.trim();
    if(taskText === "") {
        alert("Please enter a task.");
        return;
    }
    const newTask = new Task(taskText);
    tasks.push(newTask);

    taskInput.value = ""; 
    showTasks(newTask); 
    saveTasks(); 
    taskInput.focus(); // Set focus back to the input field
    
}

function showTasks(task){
    const li = document.createElement('li');
    const taskText = document.createElement('span');
    taskText.textContent = task.text;
    taskText.classList.add('task-text');
    if (task.completed) {
    taskText.classList.add('completed'); // adds a style to the completed task
    }
    li.appendChild(taskText);


    // add deletebutton
    const deleteButton = document.createElement('button');
    deleteButton.textContent = "D";
    deleteButton.classList.add('delete-btn');
    deleteButton.addEventListener('click', () => deleteTask(task.id));

    // add editbutton
    const editButton = document.createElement('button');
    editButton.textContent = "E";
    editButton.classList.add('edit-btn');
    editButton.addEventListener('click', () => editTask(task.id));

    // add checkbox
    const completeCheckbox = document.createElement('input');
    completeCheckbox.type = 'checkbox';
    completeCheckbox.checked = task.completed;
    completeCheckbox.classList.add('complete-checkbox');
    completeCheckbox.addEventListener('change', () => completeTask(task.id, completeCheckbox.checked));

    // Buttons and chekbox for styling
    const controls = document.createElement('div');
    controls.classList.add('task-controls');
    controls.appendChild(editButton);
    controls.appendChild(deleteButton);
    controls.appendChild(completeCheckbox);

    li.appendChild(taskText);
    li.appendChild(controls);
    taskList.appendChild(li);

    }
function deleteTask(id) {
    const confirmDelete = confirm("Are you sure you want to delete this task?");
    if (!confirmDelete) return; // If the user cancels, do nothing

    const index = tasks.findIndex(task => task.id === id);
    if(index !== -1) {
        tasks.splice(index, 1); // Remove the task from the array

        refreshTaskList(); 
        saveTasks(); 
    }

}


function refreshTaskList() {
    taskList.innerHTML = ""; 
    tasks.forEach(showTasks); 
  }


function editTask(id) {
    const task = tasks.find(task => task.id === id);
    if (task) {
        const newText = prompt("Edit task:", task.text);
        if (newText !== null && newText.trim() !== "") {
            task.text = newText.trim();

            refreshTaskList(); 
            saveTasks(); 
    }
}
}


function completeTask(id, isChecked) {
    const task = tasks.find(task => task.id === id);
    if (task) {
      task.completed = isChecked;
      refreshTaskList(); 
      saveTasks(); 
    }
  }


function saveTasks() {
    localStorage.setItem("tasks", JSON.stringify(tasks));
}


function loadTasksFromLocalStorage() {
    const saved = localStorage.getItem("tasks");
    if(saved) {
        const parsed = JSON.parse(saved);
        tasks.length = 0; // Clear the current tasks array
        parsed.forEach(data => {
            const task = new Task(data.text);
            task.completed = data.completed;
            task.id = data.id;
            tasks.push(task);
            showTasks(task);   
        });
    }
}

loadTasksFromLocalStorage();