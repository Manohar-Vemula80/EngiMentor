import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";

const API_BASE_URL = "http://localhost:5000/api";
const getAuthToken = () => localStorage.getItem("authToken");

const ProgressTracker = () => {
    const navigate = useNavigate();
    const { projectId } = useParams();

    const [tasks, setTasks] = useState([]);
    const [projectTitle, setProjectTitle] = useState("Loading Project Details...");
    const [feedback, setFeedback] = useState("Loading status...");
    const [newTaskText, setNewTaskText] = useState("");
    const [loading, setLoading] = useState(true);

    const token = getAuthToken();

    const goToShowcase = () => {
        // Navigate to your learning/showcase route
        navigate('/learning'); 
    };

    // --- Helper function to update feedback locally (Safely checks for array) ---
    const updateFeedback = (currentTasks) => {
        if (!Array.isArray(currentTasks)) {
            setFeedback("Tasks data is unavailable or incorrectly formatted.");
            return;
        }
        
        const incomplete = currentTasks.filter((t) => !t.done);
        let newFeedback = "";
        if (incomplete.length === 0) {
            newFeedback = "🎉 All tasks completed! Ready to showcase your project.";
        } else if (incomplete.length <= 2) {
            newFeedback = "Almost done! Consider completing remaining tasks soon.";
        } else {
            newFeedback = "Keep going! Focus on finishing your roadmap step by step.";
        }
        setFeedback(newFeedback);
    };

    // --- Fetch Project Title and Tasks ---
    useEffect(() => {
        const fetchProjectData = async () => {
            if (!projectId || !token) {
                setProjectTitle("Authentication/ID Missing");
                setFeedback("Please login and ensure a valid project ID is used.");
                setLoading(false);
                return;
            }

            console.log("Fetching data for Project ID:", projectId);

            try {
                const headers = { Authorization: `Bearer ${token}` };
                
                // 1. Fetch Project Details (Title/Description)
                const projectResponse = await axios.get(`${API_BASE_URL}/projects/${projectId}`, { headers });
                
                // 🛑 Fix for Project Title: Assuming /projects/:id returns { _id, title, ... }
                setProjectTitle(projectResponse.data.title || projectResponse.data.project?.title || "Project Title Not Set");

                // 2. Fetch the associated tasks
                const taskResponse = await axios.get(`${API_BASE_URL}/progress/${projectId}`, { headers });
                
                // ✅ CRITICAL FIX: Extract the tasks array from the returned object (as seen in console log)
                // The backend returns { tasks: [...], projectTitle: '...', ... }
                const taskData = taskResponse.data.tasks || taskResponse.data || []; 
                
                // We can also extract the Project Title and Feedback from this response if necessary
                // setProjectTitle(taskResponse.data.projectTitle || projectResponse.data.title); 
                // setFeedback(taskResponse.data.feedback || "Status loaded.");


                if (Array.isArray(taskData)) {
                    setTasks(taskData);
                    updateFeedback(taskData);
                } else {
                    console.error("Backend did not return a valid array for tasks (expected nested 'tasks' array). Received:", taskResponse.data);
                    setTasks([]); 
                    updateFeedback([]);
                }

            } catch (error) {
                console.error("Error fetching project data:", error.response?.data?.message || error.message);
                
                let errorMessage = "Failed to load project details. Check console for ID format issue.";
                if (error.response?.status === 404) {
                    errorMessage = "Project not found or invalid ID format.";
                } else if (error.response?.data?.message) {
                    errorMessage = error.response.data.message;
                }
                
                setProjectTitle("Error Loading Project");
                setFeedback(`Error: ${errorMessage}`);
                setTasks([]); 
            } finally {
                setLoading(false);
            }
        };

        fetchProjectData();
    }, [projectId, token]); 

    // --- Add New Task Handler (Using axios) ---
    const handleAddTask = async (e) => {
        e.preventDefault();
        if (!newTaskText.trim() || !projectId) return;

        try {
            const response = await axios.post(`${API_BASE_URL}/progress`, 
                { projectId, text: newTaskText },
                { headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } }
            );

            // backend may return the created task in different shapes
            const created = response.data.task || response.data.createdTask || response.data || null;
            if (created) {
                const taskToAdd = created._id ? created : (created.task || created);
                const updatedTasks = [...tasks, taskToAdd];
                setTasks(updatedTasks);
                updateFeedback(updatedTasks);
                setNewTaskText("");
            } else {
                // fallback: refetch tasks
                const taskResponse = await axios.get(`${API_BASE_URL}/progress/${projectId}`, { headers: { Authorization: `Bearer ${token}` } });
                const taskData = taskResponse.data.tasks || taskResponse.data || [];
                setTasks(Array.isArray(taskData) ? taskData : []);
                updateFeedback(Array.isArray(taskData) ? taskData : []);
                setNewTaskText("");
            }

        } catch (error) {
            console.error("Error adding task:", error);
            alert("Failed to add task: " + (error.response?.data?.message || "Unknown error."));
        }
    };

    // --- Toggle Task Completion Handler (Using axios) ---
    const handleToggle = async (taskId, currentDoneStatus) => {
        const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

        // If the task is currently done and user clicked "Undo" -> delete from DB
        if (currentDoneStatus === true) {
            const confirmDelete = window.confirm("Are you sure you want to remove this task from the project? This will delete it from the database.");
            if (!confirmDelete) return;

            // optimistic UI: remove immediately
            const remaining = tasks.filter(t => t._id !== taskId);
            setTasks(remaining);
            updateFeedback(remaining);

            try {
                await axios.delete(`${API_BASE_URL}/progress/${taskId}`, { headers: { Authorization: `Bearer ${token}` } });
            } catch (error) {
                console.error("Error deleting task:", error);
                alert("Failed to delete task: " + (error.response?.data?.message || "Unknown error."));
                // revert on failure
                // refetch tasks to restore accurate state
                try {
                    const taskResponse = await axios.get(`${API_BASE_URL}/progress/${projectId}`, { headers });
                    const taskData = taskResponse.data.tasks || taskResponse.data || [];
                    setTasks(Array.isArray(taskData) ? taskData : []);
                    updateFeedback(Array.isArray(taskData) ? taskData : []);
                } catch (e) {
                    // final fallback: do nothing
                }
            }
            return;
        }

        // Otherwise mark as done (currentDoneStatus === false)
        const newDoneStatus = !currentDoneStatus;
        const newTasks = tasks.map(task =>
            task._id === taskId ? { ...task, done: newDoneStatus } : task
        );
        setTasks(newTasks);
        updateFeedback(newTasks); 

        try {
            await axios.put(`${API_BASE_URL}/progress/${taskId}`, 
                { done: newDoneStatus },
                { headers }
            );
        } catch (error) {
            console.error("Error updating task:", error);
            alert("Failed to update task: " + (error.response?.data?.message || "Unknown error."));
            
            // Revert state if server update fails
            const originalTasks = tasks.map(task =>
                task._id === taskId ? { ...task, done: currentDoneStatus } : task
            );
            setTasks(originalTasks); 
            updateFeedback(originalTasks);
        }
    };

    // --- JSX ---

    if (loading) {
        return <div className="text-center p-10 font-medium text-lg text-indigo-600">Loading project tracker...</div>;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 p-6">
            <div className="max-w-4xl mx-auto bg-white shadow-2xl rounded-2xl p-10 border border-gray-200">
                <h1 className="text-3xl font-extrabold text-gray-800 mb-2 text-center">
                    📊 Progress Tracker
                </h1>
                
                <h2 className="text-2xl font-bold text-indigo-600 mb-6 text-center">
                    Project: {projectTitle} 
                </h2>
                
                <form onSubmit={handleAddTask} className="flex gap-2 mb-8">
                    <input
                        type="text"
                        name="taskText"
                        placeholder="Add a new future task (e.g., 'Deploy to Vercel')"
                        value={newTaskText}
                        onChange={(e) => setNewTaskText(e.target.value)}
                        className="flex-grow p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        required
                        disabled={!projectId}
                    />
                    <button
                        type="submit"
                        className="bg-indigo-600 text-white font-semibold px-6 py-3 rounded-lg shadow-md hover:bg-indigo-700 transition disabled:opacity-50"
                        disabled={!projectId || !newTaskText.trim()}
                    >
                        Add Task
                    </button>
                </form>

                <ul className="space-y-4 mb-8">
                    {tasks.length > 0 ? (
                        tasks.map((task) => (
                            <li
                                key={task._id} 
                                className={`flex items-center justify-between p-4 border rounded-lg shadow-sm ${
                                    task.done ? "bg-green-100 line-through text-gray-500" : "bg-gray-50"
                                }`}
                            >
                                <span>{task.text}</span>
                                <button
                                    onClick={() => handleToggle(task._id, task.done)} 
                                    className={`px-4 py-2 rounded-lg font-semibold ${
                                        task.done
                                            ? "bg-red-500 text-white hover:bg-red-600"
                                            : "bg-green-600 text-white hover:bg-green-700"
                                    } transition`}
                                >
                                    {task.done ? "Undo" : "Done"}
                                </button>
                            </li>
                        ))
                    ) : (
                        <p className="text-center text-gray-500 p-4 border rounded-lg bg-gray-50">
                            No tasks found. Use the input above to create your project roadmap!
                        </p>
                    )}
                </ul>

                <div className="bg-gradient-to-r from-blue-100 to-purple-100 p-5 rounded-lg shadow-md text-gray-800 mb-6">
                    <h2 className="text-xl font-semibold mb-2">🤖 AI Status Check</h2>
                    <p className="text-lg">{feedback}</p>
                </div>

                <button
                    onClick={goToShowcase}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold py-3 rounded-lg shadow-md hover:opacity-90 transition"
                >
                    Continue to Learning 🚀
                </button>
            </div>
        </div>
    );
};

export default ProgressTracker;