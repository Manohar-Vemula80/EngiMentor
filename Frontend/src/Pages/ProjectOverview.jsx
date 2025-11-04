import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github.css";

const API_BASE = "http://localhost:5000/api";

// Simple excerpt helper
const excerpt = (text = "", n = 200) =>
  text.length > n ? text.slice(0, n).trim() + "…" : text;

const ProjectOverview = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem("authToken");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [project, setProject] = useState(null);
  const [ownerName, setOwnerName] = useState("Unknown"); // <-- added
  const [analyses, setAnalyses] = useState([]);
  const [chatPreview, setChatPreview] = useState({ roomId: null, messages: [] });

  // Tasks (progress) for this project
  const [tasks, setTasks] = useState([]);
  const [newTaskText, setNewTaskText] = useState("");
  const [tasksLoading, setTasksLoading] = useState(false);
  const PROGRESS_API = `${API_BASE}/progress`;

  const fetchTasks = async () => {
    if (!projectId) return;
    setTasksLoading(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(`${PROGRESS_API}/${projectId}`, { headers }).catch(() => null);
      const list = res?.data?.tasks || res?.data || [];
      setTasks(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error("fetchTasks error:", e);
    } finally {
      setTasksLoading(false);
    }
  };

  const handleAddTask = async (e) => {
    e?.preventDefault?.();
    if (!newTaskText.trim() || !projectId) return;
    try {
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
      const res = await axios.post(PROGRESS_API, { projectId, text: newTaskText }, { headers }).catch(() => null);
      const created = res?.data?.task || res?.data || null;
      // Refresh tasks (safer)
      setNewTaskText("");
      await fetchTasks();
    } catch (err) {
      console.error("add task error:", err);
      alert("Failed to add task");
    }
  };

  const handleToggleTask = async (taskId, done) => {
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    if (done) {
      // Undo: delete task from DB (try multiple endpoint shapes)
      if (!confirm("Remove this completed task from the project?")) return;

      // optimistic UI
      const prev = tasks;
      setTasks(prev.filter((t) => t._id !== taskId));

      const tryDeletes = [
        { method: "delete", url: `${PROGRESS_API}/${taskId}` },             // /api/progress/:id
        { method: "delete", url: `${PROGRESS_API}/task/${taskId}` },        // /api/progress/task/:id
        { method: "delete", url: `${PROGRESS_API}?taskId=${taskId}` },     // /api/progress?taskId=...
        { method: "put",    url: `${PROGRESS_API}/${taskId}`, body: { deleted: true } }, // mark deleted
        { method: "put",    url: `${PROGRESS_API}/${taskId}`, body: { done: false } },   // fallback undo
      ];

      let success = false;
      for (const attempt of tryDeletes) {
        try {
          if (attempt.method === "delete") {
            const res = await axios.delete(attempt.url, { headers }).catch(() => null);
            if (res && (res.status === 200 || res.status === 204)) { success = true; break; }
          } else if (attempt.method === "put") {
            const res = await axios.put(attempt.url, attempt.body, { headers }).catch(() => null);
            if (res && (res.status === 200 || res.status === 204)) { success = true; break; }
          }
        } catch (err) {
          // ignore and try next
          console.warn("delete attempt failed:", attempt.url, err?.message || err);
        }
      }

      if (!success) {
        console.error("delete task error: backend did not accept any delete/undo route");
        alert("Failed to delete task on server. Refreshing tasks to restore state.");
        await fetchTasks(); // restore accurate state
      }

      return;
    }

    // Mark done (PUT)
    const prev = tasks;
    setTasks(prev.map((t) => (t._id === taskId ? { ...t, done: true } : t)));
    try {
      await axios.put(`${PROGRESS_API}/${taskId}`, { done: true }, { headers });
    } catch (e) {
      console.error("update task error:", e);
      await fetchTasks();
    }
  };

  // modal for full analysis view
  const [showModal, setShowModal] = useState(false);
  const [modalContent, setModalContent] = useState("");

  // helper to extract best analysis text from different backend shapes
  const getAnalysisText = (a) => {
    if (!a) return "";
    // common fields
    if (typeof a.analysis === "string" && a.analysis.trim()) return a.analysis;
    if (typeof a.analysisText === "string" && a.analysisText.trim()) return a.analysisText;
    if (typeof a.text === "string" && a.text.trim()) return a.text;
    if (typeof a.result === "string" && a.result.trim()) return a.result;
    if (typeof a.output === "string" && a.output.trim()) return a.output;

    // sometimes rawResponse is an object with nested text
    if (a.rawResponse) {
      if (typeof a.rawResponse === "string" && a.rawResponse.trim()) return a.rawResponse;
      if (a.rawResponse.outputText) return a.rawResponse.outputText;
      if (a.rawResponse.text) return a.rawResponse.text;
      // fallback to JSON
      try {
        return JSON.stringify(a.rawResponse, null, 2);
      } catch (e) {}
    }

    // last resort: stringify whole object
    try {
      return JSON.stringify(a, null, 2);
    } catch (e) {
      return "";
    }
  };

  // resolve owner display name after project loads
  useEffect(() => {
    const resolveOwner = async () => {
      if (!project) {
        setOwnerName("Unknown");
        return;
      }

      // try many common fields in priority order
      const ownerCandidates = [
        project.owner && typeof project.owner === "object" ? project.owner.username : null,
        project.owner && typeof project.owner === "object" ? project.owner.name : null,
        project.ownerName,
        project.ownerUsername,
        project.createdByName,
        project.createdBy && project.createdBy.name,
        project.creator && (project.creator.username || project.creator.name),
      ].filter(Boolean);

      if (ownerCandidates.length > 0) {
        const uname = String(ownerCandidates[0]).startsWith("@")
          ? String(ownerCandidates[0]).slice(1)
          : String(ownerCandidates[0]);
        setOwnerName(uname);
        return;
      }

      // if owner stored as id string or other identifier, show it (useful fallback)
      const idFallback =
        (typeof project.owner === "string" && project.owner) ||
        project.ownerId ||
        project.createdBy ||
        project.creatorId;

      if (idFallback) {
        setOwnerName(String(idFallback));
        return;
      }

      // last resort: show signed-in user's name if it looks like they own it
      try {
        const stored = localStorage.getItem("user");
        if (stored) {
          const cur = JSON.parse(stored);
          if (cur && (cur.username || cur.name || cur.email)) {
            setOwnerName(cur.username || cur.name || cur.email);
            return;
          }
        }
      } catch (e) {}

      setOwnerName("Unknown");
    };
    resolveOwner();
  }, [project, token]);

  useEffect(() => {
    if (!projectId) { setError("No project"); setLoading(false); return; }
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    const fetchAll = async () => {
      setLoading(true);
      try {
        // Project (use /api/projects/:id)
        const pRes = await axios.get(`${API_BASE}/projects/${projectId}`, { headers }).catch(() => null);
        if (pRes?.data) setProject(pRes.data.project || pRes.data);

        // AI analyses -> new endpoint /api/ai/analysis?projectId=...
        const aiRes = await axios.get(`${API_BASE}/ai/analysis?projectId=${projectId}`, { headers }).catch(() => null);
        if (aiRes?.data) setAnalyses(aiRes.data.analyses || []);

        // Chat room
        const roomRes = await axios.get(`${API_BASE}/chat/project/${projectId}`, { headers }).catch(() => null);
        const rid = roomRes?.data?.roomId || null;
        if (rid) {
          setChatPreview((prev) => ({ ...prev, roomId: rid }));
          const chatDoc = await axios.get(`${API_BASE}/chat/${rid}`, { headers }).catch(() => null);
          const msgs = chatDoc?.data?.messages || [];
          setChatPreview((prev) => ({ ...prev, messages: Array.isArray(msgs) ? msgs : [] }));
        }

        // Tasks
        await fetchTasks();
      } catch (err) {
        console.error("fetchAll error:", err);
        setError("Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [projectId, token]);

  const openCollaboration = () => {
    // prefer stored roomId, otherwise create/get one using API then navigate
    if (chatPreview.roomId) {
      navigate(`/collaboration/${chatPreview.roomId}`, { state: { project: project } });
      return;
    }
    // fallback: request room create and then navigate
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    axios
      .get(`${API_BASE}/chat/project/${projectId}`, { headers })
      .then((res) => {
        const rid = res.data?.roomId;
        if (rid) navigate(`/collaboration/${rid}`, { state: { project: project } });
        else alert("Could not create/open collaboration room.");
      })
      .catch((e) => {
        console.error("Open collaboration error:", e);
        alert("Failed to open collaboration. Check console.");
      });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-gray-600">Loading project overview…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white p-6 rounded shadow flex items-start justify-between gap-6">
          <div>
            <h2 className="text-2xl font-bold">{project?.title || project?.name || "Untitled Project"}</h2>
            <p className="text-sm text-gray-600 mt-1">{project?.shortDescription || project?.description || "No description provided."}</p>
            <div className="mt-3 text-xs text-gray-500">
              <span>Created: {project?.createdAt ? new Date(project.createdAt).toLocaleString() : "—"}</span>
              <span className="mx-3">•</span>
              <span>Owner: {ownerName}</span>
            </div>
          </div>

          <div className="flex-shrink-0 flex items-center gap-3">
            <button
              onClick={openCollaboration}
              className="px-4 py-2 bg-indigo-600 text-white rounded shadow hover:bg-indigo-700 transition"
            >
              Open Collaboration
            </button>
          </div>
        </div>

        {/* Grid: Analyses | Chat */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Analyses list */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white p-4 rounded shadow">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">AI Analyses</h3>
                <div className="text-sm text-gray-500">{analyses.length} result(s)</div>
              </div>

              <div className="mt-4 space-y-3">
                {analyses.length === 0 && <div className="text-gray-500">No analyses found for this project.</div>}

                {analyses.map((a, idx) => (
                  <div key={a._id || idx} className="p-3 border rounded hover:shadow-sm transition">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium">{a.title || `Analysis ${idx + 1}`}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {a.createdAt ? new Date(a.createdAt).toLocaleString() : (a.createdOn || "")}
                        </div>
                      </div>
                      <div className="ml-4 text-sm text-gray-400">{a.model || "AI"}</div>
                    </div>

                    <div className="mt-3 text-sm text-gray-700 whitespace-pre-wrap">{excerpt(getAnalysisText(a), 400)}</div>

                    <div className="mt-3 flex items-center gap-2">
                      <button
                        onClick={() => {
                          const text = getAnalysisText(a);
                          // if the text is valid JSON string or an object-like string, format as a fenced json block
                          let content = text || "No content available.";
                          try {
                            // if already an object in getAnalysisText fallback returned JSON string, parse to pretty JSON
                            const parsed = typeof text === "string" ? JSON.parse(text) : null;
                            if (parsed) content = "```json\n" + JSON.stringify(parsed, null, 2) + "\n```";
                          } catch (e) {
                            // not JSON — leave as-is
                          }
                          // If content isn't Markdown, preserve paragraphs — ReactMarkdown will render plain text fine.
                          setModalContent(content);
                          setSelectedAnalysis(a);
                          setShowModal(true);
                        }}
                        className="text-sm text-indigo-600 hover:underline"
                      >
                        View full
                      </button>
                      <button
                        onClick={() => {
                          // navigate to a dedicated analysis page if you have one
                          navigate(`/analysis/${a._id || ""}`, { state: { analysis: a } });
                        }}
                        className="text-sm text-gray-500 hover:underline"
                      >
                        Open
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Selected analysis full view - modal */}
            {showModal && (
              <div className="fixed inset-0 flex items-center justify-center z-50">
                <div className="bg-black bg-opacity-50 absolute inset-0" onClick={() => setShowModal(false)}></div>
                <div className="bg-white rounded shadow-lg max-w-3xl w-full p-6 z-10">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-lg font-semibold">AI Analysis</h4>
                    </div>
                    <div>
                      <button className="text-sm text-gray-500" onClick={() => setShowModal(false)}>
                        Close
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 bg-gray-50 rounded p-3 text-sm overflow-auto" style={{ maxHeight: 420 }}>
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeHighlight]}
                      children={modalContent}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right column: Tasks + Chat preview */}
          <div className="bg-white p-4 rounded shadow flex flex-col">
            {/* Tasks panel */}
            <div className="mb-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Tasks</h3>
                <div className="text-xs text-gray-400">{tasks.length} task(s)</div>
              </div>

              <form onSubmit={handleAddTask} className="mt-3 flex gap-2">
                <input
                  value={newTaskText}
                  onChange={(e) => setNewTaskText(e.target.value)}
                  placeholder="Add task (e.g., Finalize report)"
                  className="flex-1 p-2 border rounded"
                />
                <button type="submit" className="px-3 py-2 bg-indigo-600 text-white rounded">Add</button>
              </form>

              <div className="mt-3 max-h-40 overflow-auto space-y-2">
                {tasksLoading && <div className="text-sm text-gray-500">Loading tasks…</div>}
                {!tasksLoading && tasks.length === 0 && <div className="text-sm text-gray-500">No tasks yet.</div>}
                {tasks.map((t) => (
                  <div key={t._id} className={`p-2 rounded flex items-center justify-between ${t.done ? "bg-green-50 line-through text-gray-500" : "bg-gray-50"}`}>
                    <div className="text-sm">{t.text}</div>
                    <button
                      onClick={() => handleToggleTask(t._id, t.done)}
                      className={`ml-3 px-2 py-1 rounded text-sm ${t.done ? "bg-red-500 text-white" : "bg-green-600 text-white"}`}
                    >
                      {t.done ? "Undo" : "Done"}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <hr className="my-2" />
            {/* Chat preview column */}
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Chat Preview</h3>
              <div className="text-xs text-gray-500">{chatPreview.roomId ? `Room: ${chatPreview.roomId}` : "No room"}</div>
            </div>

            <div className="mt-3 overflow-auto flex-1">
              <div className="space-y-3">
                {chatPreview.messages.length === 0 && <div className="text-gray-500">No chat history yet.</div>}
                {chatPreview.messages.slice(-12).map((m, i) => (
                  <div key={i} className="text-sm">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-500">{m.senderName || m.sender || "Unknown"}</div>
                      <div className="text-xs text-gray-400 ml-2">{m.timestamp ? new Date(m.timestamp).toLocaleTimeString() : ""}</div>
                    </div>
                    <div className="mt-1 p-2 bg-gray-50 rounded text-gray-800">{m.text}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  if (!chatPreview.roomId) {
                    // create/get then open
                    const headers = token ? { Authorization: `Bearer ${token}` } : {};
                    axios.get(`${API_BASE}/chat/project/${projectId}`, { headers }).then((res) => {
                      const rid = res.data?.roomId;
                      if (rid) navigate(`/collaboration/${rid}`, { state: { project } });
                    });
                    return;
                  }
                  navigate(`/collaboration/${chatPreview.roomId}`, { state: { project } });
                }}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
              >
                Open Collaboration
              </button>

              <button
                onClick={() => {
                  // quick link to full chat history page if you have one
                  if (!chatPreview.roomId) return alert("No chat to view.");
                  navigate(`/chat/${chatPreview.roomId}`, { state: { project } });
                }}
                className="px-3 py-2 bg-white border rounded"
              >
                View all
              </button>
            </div>
          </div>
        </div>

        {/* Footer / meta */}
        <div className="text-xs text-gray-500 text-center">
          Data loaded from server. If something looks missing, ensure backend routes exist:
          /api/projects/:id, /api/ai/analysis?projectId=, /api/chat/project/:projectId and /api/chat/:roomId
        </div>

        {/* Full analysis modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-11/12 md:w-3/4 lg:w-2/3 max-h-[85vh] overflow-auto bg-white rounded shadow-lg p-4">
              <div className="flex items-start justify-between">
                <h3 className="text-lg font-semibold">{selectedAnalysis?.title || "AI Analysis"}</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(modalContent).catch(() => {});
                    }}
                    className="text-sm px-3 py-1 bg-gray-100 rounded"
                  >
                    Copy
                  </button>
                  <button
                    onClick={() => setShowModal(false)}
                    className="text-sm px-3 py-1 bg-red-600 text-white rounded"
                  >
                    Close
                  </button>
                </div>
              </div>

              <pre className="mt-3 whitespace-pre-wrap text-sm text-gray-800 bg-gray-50 p-3 rounded" style={{ whiteSpace: "pre-wrap" }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                  {modalContent}
                </ReactMarkdown>
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectOverview;