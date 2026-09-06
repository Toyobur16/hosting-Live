import React, { useState, useEffect } from 'react';
import { FileCode, Save, Upload, RotateCw, CheckCircle2, AlertCircle, Sliders, FileText, Plus, Trash2, FolderOpen, AlertTriangle } from 'lucide-react';

interface FileDetail {
  name: string;
  size: number;
  modified: string;
  isEntry: boolean;
  isEditable: boolean;
}

interface ScriptEditorProps {
  lang: 'bn' | 'en';
  botId?: string;
  botName?: string;
  onFileSaved?: () => void;
}

export const ScriptEditor: React.FC<ScriptEditorProps> = ({ lang, botId, botName, onFileSaved }) => {
  const [files, setFiles] = useState<string[]>([]);
  const [fileDetails, setFileDetails] = useState<FileDetail[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('bot.py');
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoRestart, setAutoRestart] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [newFileName, setNewFileName] = useState('');
  const [showNewFileInput, setShowNewFileInput] = useState(false);

  // File deletion state modal
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  const [deletingFile, setDeletingFile] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);

  // Quick config fields extracted from bot.py
  const [botToken, setBotToken] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [showConfigHelper, setShowConfigHelper] = useState(true);

  // Syntax check state
  const [syntaxStatus, setSyntaxStatus] = useState<{
    checking: boolean;
    valid?: boolean;
    message?: string;
    error?: string;
    line?: number | null;
  } | null>(null);

  const checkPythonSyntax = async () => {
    if (!content) return;
    setSyntaxStatus({ checking: true });
    try {
      const res = await fetch('/api/code/syntax-check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ code: content })
      });
      const data = await res.json();
      setSyntaxStatus({
        checking: false,
        valid: data.valid,
        message: data.message,
        error: data.error,
        line: data.line
      });
    } catch (e: any) {
      setSyntaxStatus({
        checking: false,
        valid: false,
        error: e.message || 'Failed to check syntax'
      });
    }
  };

  const getAuthHeaders = () => {
    const token = localStorage.getItem('bot_auth_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  };

  const fetchFiles = async () => {
    try {
      const url = botId ? `/api/bots/${botId}/files` : '/api/files';
      const res = await fetch(url, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.files && Array.isArray(data.files)) {
        setFiles(data.files);
        if (data.fileDetails && Array.isArray(data.fileDetails)) {
          setFileDetails(data.fileDetails);
        }
        if (!data.files.includes(selectedFile) && data.files.length > 0) {
          setSelectedFile(data.files[0]);
        }
      }
    } catch {
      // Ignore
    }
  };

  const loadFileContent = async (filename: string) => {
    setLoading(true);
    setErrorMessage('');
    try {
      const url = botId
        ? `/api/bots/${botId}/file?name=${encodeURIComponent(filename)}`
        : `/api/files/read?name=${encodeURIComponent(filename)}`;
      const res = await fetch(url, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.content !== undefined) {
        setContent(data.content);
        if (filename === 'bot.py' || filename.endsWith('.py')) {
          extractVariables(data.content);
        }
      } else {
        setErrorMessage(data.error || 'Failed to load file');
      }
    } catch (e: any) {
      setErrorMessage(e.message);
    } finally {
      setLoading(false);
    }
  };

  const extractVariables = (code: string) => {
    const tokenMatch = code.match(/BOT_TOKEN\s*=\s*(?:os\.getenv\([^,]+,\s*)?["']([^"']+)["']/);
    if (tokenMatch) setBotToken(tokenMatch[1]);
    const apiMatch = code.match(/API_KEY\s*=\s*(?:os\.getenv\([^,]+,\s*)?["']([^"']+)["']/);
    if (apiMatch) setApiKey(apiMatch[1]);
    const urlMatch = code.match(/BASE_URL\s*=\s*(?:os\.getenv\([^,]+,\s*)?["']([^"']+)["']/);
    if (urlMatch) setBaseUrl(urlMatch[1]);
  };

  useEffect(() => {
    fetchFiles();
  }, [botId]);

  useEffect(() => {
    if (selectedFile) {
      loadFileContent(selectedFile);
    }
  }, [selectedFile, botId]);

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    setErrorMessage('');
    try {
      const url = botId ? `/api/bots/${botId}/file` : '/api/files/save';
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          filename: selectedFile,
          content,
          restart: autoRestart
        })
      });
      const data = await res.json();
      if (data.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        if (onFileSaved) onFileSaved();
      } else {
        setErrorMessage(data.error || 'Failed to save');
      }
    } catch (e: any) {
      setErrorMessage(e.message);
    } finally {
      setSaving(false);
    }
  };

  const applyQuickConfig = () => {
    let updated = content;
    if (botToken) {
      updated = updated.replace(
        /(BOT_TOKEN\s*=\s*(?:os\.getenv\([^,]+,\s*)?["'])([^"']+)(["'])/,
        `$1${botToken}$3`
      );
    }
    if (apiKey) {
      updated = updated.replace(
        /(API_KEY\s*=\s*(?:os\.getenv\([^,]+,\s*)?["'])([^"']+)(["'])/,
        `$1${apiKey}$3`
      );
    }
    if (baseUrl) {
      updated = updated.replace(
        /(BASE_URL\s*=\s*(?:os\.getenv\([^,]+,\s*)?["'])([^"']+)(["'])/,
        `$1${baseUrl}$3`
      );
    }
    setContent(updated);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  // Upload files or ZIP directly into this bot
  const handleDirectUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    setSaving(true);
    setErrorMessage(null);

    try {
      if (fileList.length === 1 && fileList[0].name.toLowerCase().endsWith('.zip')) {
        // ZIP file upload
        const zipFile = fileList[0];
        const buffer = await zipFile.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        const chunkSize = 8192;
        for (let j = 0; j < bytes.length; j += chunkSize) {
          const chunk = bytes.subarray(j, j + chunkSize);
          binary += String.fromCharCode.apply(null, Array.from(chunk));
        }
        const zipBase64 = btoa(binary);

        const url = botId ? `/api/bots/${botId}/upload-zip` : '/api/upload-zip';
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          },
          body: JSON.stringify({
            zipBase64,
            restart: autoRestart
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to extract zip');
      } else {
        // Multi-file upload
        const filesPayload: { name: string; content?: string; base64?: string }[] = [];
        for (let i = 0; i < fileList.length; i++) {
          const file = fileList[i];
          const isText = file.name.endsWith('.py') || file.name.endsWith('.json') || file.name.endsWith('.txt') || file.name.endsWith('.env') || file.name.endsWith('.md');
          if (isText) {
            const text = await file.text();
            filesPayload.push({ name: file.name, content: text });
          } else {
            const buffer = await file.arrayBuffer();
            const bytes = new Uint8Array(buffer);
            let binary = '';
            const chunkSize = 8192;
            for (let j = 0; j < bytes.length; j += chunkSize) {
              const chunk = bytes.subarray(j, j + chunkSize);
              binary += String.fromCharCode.apply(null, Array.from(chunk));
            }
            filesPayload.push({ name: file.name, base64: btoa(binary) });
          }
        }

        const url = botId ? `/api/bots/${botId}/upload-files` : '/api/upload-files';
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          },
          body: JSON.stringify({
            files: filesPayload,
            restart: autoRestart
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to upload files');
      }

      await fetchFiles();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setSaving(false);
      // Reset input value so same files can be re-selected if needed
      e.target.value = '';
    }
  };

  // Create empty file
  const handleCreateNewFile = async () => {
    if (!newFileName.trim()) return;
    const safe = newFileName.trim();
    setSaving(true);
    try {
      const url = botId ? `/api/bots/${botId}/file` : '/api/files/save';
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          filename: safe,
          content: `# ${safe}\n`,
          restart: false
        })
      });
      setNewFileName('');
      setShowNewFileInput(false);
      await fetchFiles();
      setSelectedFile(safe);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Confirm and Execute File Deletion
  const confirmDeleteFile = async () => {
    if (!fileToDelete || !botId) return;
    setDeletingFile(true);
    try {
      const res = await fetch(`/api/bots/${botId}/delete-file`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ filename: fileToDelete })
      });
      const data = await res.json();
      if (data.success) {
        setDeleteSuccess(fileToDelete);
        setTimeout(() => setDeleteSuccess(null), 3000);
        await fetchFiles();
        if (selectedFile === fileToDelete) {
          const remaining = files.filter(f => f !== fileToDelete);
          if (remaining.length > 0) {
            setSelectedFile(remaining[0]);
          } else {
            setContent('');
          }
        }
      } else {
        setErrorMessage(data.error || 'Failed to delete file');
      }
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setDeletingFile(false);
      setFileToDelete(null);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      {/* File Deletion Confirmation Modal */}
      {fileToDelete && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mb-3">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-[#1e293b]">
              {lang === 'bn' ? 'ফাইল ডিলিট নিশ্চিত করুন' : 'Confirm File Deletion'}
            </h4>
            <p className="text-xs text-[#64748b] mt-1.5 leading-relaxed">
              {lang === 'bn'
                ? `আপনি কি নিশ্চিত যে '${fileToDelete}' ফাইলটি স্থায়ীভাবে হোস্ট থেকে ডিলিট করতে চান?`
                : `Are you sure you want to permanently delete '${fileToDelete}' from this hosted bot?`}
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setFileToDelete(null)}
                disabled={deletingFile}
                className="px-3.5 py-2 rounded-xl bg-[#f8fafc] hover:bg-[#f1f5f9] text-[#64748b] hover:text-[#1e293b] text-xs font-semibold border border-[#e2e8f0] cursor-pointer"
              >
                {lang === 'bn' ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                onClick={confirmDeleteFile}
                disabled={deletingFile}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm shadow-rose-600/20 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deletingFile ? (lang === 'bn' ? 'ডিলিট হচ্ছে...' : 'Deleting...') : (lang === 'bn' ? 'ডিলিট করুন' : 'Delete File')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Code Editor Card */}
      <div className="bg-white border border-[#e2e8f0] rounded-2xl overflow-hidden shadow-xs">
        {/* Editor Header */}
        <div className="bg-[#fcfdfe] px-5 py-3.5 border-b border-[#f1f5f9] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-7 h-7 rounded-xl bg-[#0088cc]/10 flex items-center justify-center text-[#0088cc]">
              <FileCode className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-[#1e293b]">
                  {botName ? `${botName} • ` : ''}{lang === 'bn' ? 'কোড ও ফাইল এডিটর' : 'Script & File Editor'}
                </span>

                <select
                  value={selectedFile}
                  onChange={(e) => setSelectedFile(e.target.value)}
                  className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl px-2.5 py-1 text-xs font-mono font-semibold text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#0088cc] cursor-pointer"
                >
                  {files.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>

                {/* Upload file button */}
                <label
                  htmlFor="editor-file-upload"
                  className="px-2.5 py-1 rounded-xl bg-[#0088cc]/10 hover:bg-[#0088cc]/20 text-[#0088cc] border border-[#0088cc]/30 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                  title={lang === 'bn' ? 'ফাইল (.py, .json) বা জিপ (.zip) আপলোড করুন' : 'Upload files (.py, .json) or ZIP archive'}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{lang === 'bn' ? 'ফাইল / জিপ আপলোড' : 'Upload Files / ZIP'}</span>
                  <input
                    id="editor-file-upload"
                    type="file"
                    multiple
                    accept=".py,.json,.txt,.zip,.env,.md"
                    onChange={handleDirectUpload}
                    className="hidden"
                  />
                </label>

                {/* Add file button */}
                <button
                  onClick={() => setShowNewFileInput(!showNewFileInput)}
                  className="p-1.5 rounded-xl bg-[#f8fafc] hover:bg-[#f1f5f9] text-[#64748b] hover:text-[#1e293b] border border-[#e2e8f0] cursor-pointer transition-colors"
                  title={lang === 'bn' ? 'নতুন ফাইল তৈরি করুন' : 'Create new file'}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>

                {/* Direct Delete Button for current file (with prominent red badge) */}
                {selectedFile && (
                  <button
                    onClick={() => setFileToDelete(selectedFile)}
                    className="px-2.5 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                    title={lang === 'bn' ? 'এই ফাইলটি ডিলিট করুন' : 'Delete this file'}
                  >
                    <Trash2 className="w-3 h-3 text-rose-600" />
                    <span>{lang === 'bn' ? 'ফাইল ডিলিট' : 'Delete File'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Actions on Top Right */}
          <div className="flex items-center gap-2">
            {selectedFile.endsWith('.py') && (
              <button
                type="button"
                onClick={checkPythonSyntax}
                disabled={syntaxStatus?.checking || loading}
                className="px-3 py-1.5 bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#1e293b] border border-[#cbd5e1] text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                title={lang === 'bn' ? 'কোডে কোনো সিনট্যাক্স এরর আছে কিনা চেক করুন' : 'Check Python code for syntax errors'}
              >
                {syntaxStatus?.checking ? (
                  <RotateCw className="w-3.5 h-3.5 animate-spin text-[#0088cc]" />
                ) : (
                  <span className="text-sm">🔍</span>
                )}
                <span>{lang === 'bn' ? 'কোড এরর চেক' : 'Check Syntax'}</span>
              </button>
            )}

            <label className="flex items-center gap-1.5 text-xs text-[#64748b] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoRestart}
                onChange={(e) => setAutoRestart(e.target.checked)}
                className="rounded text-[#0088cc] border-[#cbd5e1] focus:ring-[#0088cc]"
              />
              <span>{lang === 'bn' ? 'অটো-রিস্টার্ট' : 'Auto-restart'}</span>
            </label>

            <button
              onClick={handleSave}
              disabled={saving || loading}
              className="px-4 py-1.5 bg-[#0088cc] hover:bg-[#0077b5] text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm shadow-[#0088cc]/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>{lang === 'bn' ? 'সেভ করুন' : 'Save'}</span>
            </button>
          </div>
        </div>

        {/* Syntax Check Result Banner */}
        {syntaxStatus && !syntaxStatus.checking && (
          <div
            className={`px-5 py-3 border-b text-xs flex items-start justify-between gap-3 ${
              syntaxStatus.valid
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {syntaxStatus.valid ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-bold">
                  {syntaxStatus.valid
                    ? lang === 'bn'
                      ? '✓ পাইথন কোড সম্পূর্ণ সঠিক! কোনো সিনট্যাক্স এরর পাওয়া যায়নি।'
                      : '✓ Python Syntax OK! No syntax errors detected.'
                    : lang === 'bn'
                    ? `⚠️ কোডে সিনট্যাক্স সমস্যা পাওয়া গেছে${syntaxStatus.line ? ` (লাইন ${syntaxStatus.line})` : ''}:`
                    : `⚠️ Syntax Error Detected${syntaxStatus.line ? ` (Line ${syntaxStatus.line})` : ''}:`}
                </p>
                {syntaxStatus.error && (
                  <pre className="mt-1 font-mono text-[11px] bg-rose-100/70 p-2 rounded-lg text-rose-950 overflow-x-auto whitespace-pre-wrap">
                    {syntaxStatus.error}
                  </pre>
                )}
              </div>
            </div>
            <button
              onClick={() => setSyntaxStatus(null)}
              className="text-slate-400 hover:text-slate-600 p-1 text-xs font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* New file input popup */}
        {showNewFileInput && (
          <div className="bg-[#f8fafc] border-b border-[#e2e8f0] px-5 py-3 flex items-center gap-2">
            <input
              type="text"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder="filename.py or config.json"
              className="px-3 py-1.5 rounded-xl bg-white border border-[#e2e8f0] text-xs font-mono text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#0088cc]"
            />
            <button
              onClick={handleCreateNewFile}
              className="px-3 py-1.5 rounded-xl bg-[#0088cc] hover:bg-[#0077b5] text-white text-xs font-semibold cursor-pointer"
            >
              {lang === 'bn' ? 'তৈরি করুন' : 'Create'}
            </button>
            <button
              onClick={() => setShowNewFileInput(false)}
              className="px-3 py-1.5 rounded-xl bg-white border border-[#e2e8f0] text-[#64748b] text-xs cursor-pointer"
            >
              {lang === 'bn' ? 'বাতিল' : 'Cancel'}
            </button>
          </div>
        )}

        {/* Success or Error Alert */}
        {saveSuccess && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-5 py-2.5 text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{lang === 'bn' ? 'ফাইল সফলভাবে সেভ হয়েছে!' : 'File successfully saved!'}</span>
          </div>
        )}
        {deleteSuccess && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-5 py-2.5 text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{lang === 'bn' ? `'${deleteSuccess}' ফাইলটি সফলভাবে ডিলিট হয়েছে!` : `'${deleteSuccess}' deleted successfully!`}</span>
          </div>
        )}
        {errorMessage && (
          <div className="bg-rose-50 border-b border-rose-200 px-5 py-2.5 text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Quick Config Helper Drawer */}
        {showConfigHelper && (selectedFile === 'bot.py' || selectedFile.endsWith('.py')) && botToken && (
          <div className="bg-[#f8fafc] border-b border-[#e2e8f0] p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#0088cc] flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5" />
                {lang === 'bn' ? 'বট ক্রেডেনশিয়াল ফাস্ট কনফিগ' : 'Fast Bot Credentials Config'}
              </h4>
              <span className="text-[11px] text-[#64748b]">
                {lang === 'bn' ? 'কোডে সরাসরি আপডেট করুন' : 'Directly update credentials in script'}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#64748b] mb-1">
                  Telegram BOT_TOKEN
                </label>
                <input
                  type="text"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="e.g. 8814477083:AAH_G8v9..."
                  className="w-full bg-white border border-[#e2e8f0] rounded-xl px-3 py-1.5 text-xs text-[#1e293b] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#0088cc] font-mono"
                />
              </div>
              {apiKey && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#64748b] mb-1">
                    Mino Panel API_KEY
                  </label>
                  <input
                    type="text"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="e.g. mino_live_..."
                    className="w-full bg-white border border-[#e2e8f0] rounded-xl px-3 py-1.5 text-xs text-[#1e293b] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#0088cc] font-mono"
                  />
                </div>
              )}
            </div>
            <div className="mt-2.5 flex justify-end">
              <button
                onClick={applyQuickConfig}
                className="px-3.5 py-1.5 bg-[#0088cc] hover:bg-[#0077b5] text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
              >
                {lang === 'bn' ? 'কোডে প্রয়োগ করুন' : 'Apply to Code'}
              </button>
            </div>
          </div>
        )}

        {/* Code Textarea */}
        <div className="relative">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            spellCheck={false}
            className="w-full h-[440px] bg-[#0f172a] text-slate-200 p-5 font-mono text-xs leading-relaxed focus:outline-none resize-none selection:bg-[#0088cc]/40"
            placeholder="Loading code..."
          />
        </div>

        <div className="bg-[#fcfdfe] px-5 py-2.5 border-t border-[#f1f5f9] flex items-center justify-between text-[11px] text-[#64748b]">
          <span className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-[#94a3b8]" />
            <span className="font-semibold text-[#1e293b]">{selectedFile}</span>
            <span>•</span>
            <span>{content.split('\n').length} {lang === 'bn' ? 'লাইন' : 'lines'}</span>
          </span>
          <span className="font-mono text-[#94a3b8]">UTF-8 • Python 3.10</span>
        </div>
      </div>

      {/* Dedicated Files & Deletion Manager Table */}
      <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-[#f1f5f9] mb-3">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-[#0088cc]" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#1e293b]">
              {lang === 'bn' ? 'হোস্টে থাকা ফাইলসমূহ ও ডিলিট অপশন' : 'Hosted Files & File Deletion Manager'}
            </h4>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#f1f5f9] text-[#64748b] font-semibold">
              {files.length} {lang === 'bn' ? 'টি ফাইল' : 'files'}
            </span>
          </div>
          <p className="text-[11px] text-[#64748b]">
            {lang === 'bn' ? 'যেকোনো ফাইল ডিলিট বা এডিট করতে পাশের বাটনে ক্লিক করুন' : 'Click delete next to any file you want to remove'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {files.map((fn) => {
            const detail = fileDetails.find(d => d.name === fn);
            const isCurrent = fn === selectedFile;
            return (
              <div
                key={fn}
                className={`p-3 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                  isCurrent ? 'bg-[#0088cc]/5 border-[#0088cc]/30 ring-1 ring-[#0088cc]/20' : 'bg-[#f8fafc] border-[#e2e8f0]'
                }`}
              >
                <div
                  onClick={() => setSelectedFile(fn)}
                  className="min-w-0 flex-1 cursor-pointer"
                >
                  <div className="text-xs font-mono font-bold text-[#1e293b] truncate flex items-center gap-1.5">
                    <FileCode className={`w-3.5 h-3.5 shrink-0 ${isCurrent ? 'text-[#0088cc]' : 'text-[#64748b]'}`} />
                    <span className="truncate">{fn}</span>
                  </div>
                  <div className="text-[10px] text-[#64748b] mt-0.5">
                    {detail ? formatBytes(detail.size) : 'File'}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setSelectedFile(fn)}
                    className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-white border border-[#e2e8f0] text-[#0088cc] hover:bg-[#0088cc]/10 cursor-pointer"
                    title={lang === 'bn' ? 'এডিট করুন' : 'Edit file'}
                  >
                    {lang === 'bn' ? 'এডিট' : 'Edit'}
                  </button>

                  <button
                    onClick={() => setFileToDelete(fn)}
                    className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 cursor-pointer transition-colors"
                    title={lang === 'bn' ? `'${fn}' ফাইলটি ডিলিট করুন` : `Delete '${fn}'`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
