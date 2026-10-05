/* ─────────────────────────────────────────────────────────────
   AI TUTOR PLATFORM — FRONTEND JAVASCRIPT CONTROLLER
───────────────────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
    // State management
    let state = {
        activeTab: 'student-portal',
        tests: [],
        selectedTestId: null,
        studentFile: null,
        labFile: null,
        submissions: []
    };

    // DOM Elements - Navigation
    const roleTabs = document.querySelectorAll('.role-tab');
    const portalViews = document.querySelectorAll('.portal-view');

    // DOM Elements - Student Portal
    const studentTestList = document.getElementById('student-test-list');
    const activeTestCount = document.getElementById('active-test-count');
    const submitModal = document.getElementById('submit-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const modalTestTitle = document.getElementById('modal-test-title');
    const modalTestSubject = document.getElementById('modal-test-subject');
    const modalTestQuestion = document.getElementById('modal-test-question');
    const modalTestMarks = document.getElementById('modal-test-marks');
    const studentSubmitForm = document.getElementById('student-submit-form');
    const stuDropZone = document.getElementById('stu-drop-zone');
    const stuFileInput = document.getElementById('stu-file-input');
    const stuFileChip = document.getElementById('stu-file-chip');
    const stuFileName = document.getElementById('stu-file-name');
    const stuFileSize = document.getElementById('stu-file-size');
    const stuFileRemove = document.getElementById('stu-file-remove');
    const stuSubmitBtn = document.getElementById('stu-submit-btn');
    const stuLoadSampleImg = document.getElementById('stu-load-sample-img');
    const stuLoadSamplePdf = document.getElementById('stu-load-sample-pdf');
    const optionsToggle = document.getElementById('options-toggle');
    const optionsBody = document.getElementById('options-body');
    const evalLoading = document.getElementById('eval-loading');
    const evalResult = document.getElementById('eval-result');

    // Results DOM
    const resScore = document.getElementById('res-score');
    const resMaxScore = document.getElementById('res-max-score');
    const resStatusBadge = document.getElementById('res-status-badge');
    const resPercentage = document.getElementById('res-percentage');
    const resReasoning = document.getElementById('res-reasoning');
    const resCoveredList = document.getElementById('res-covered-list');
    const resMissingList = document.getElementById('res-missing-list');
    const resFeedback = document.getElementById('res-feedback');
    const resExtractedText = document.getElementById('res-extracted-text');
    const resPreprocessedImg = document.getElementById('res-preprocessed-img');
    const resImgContainer = document.getElementById('res-img-container');

    // DOM Elements - Teacher Portal
    const openCreateTestBtn = document.getElementById('open-create-test-btn');
    const createTestModal = document.getElementById('create-test-modal');
    const closeCreateModalBtn = document.getElementById('close-create-modal-btn');
    const createTestForm = document.getElementById('create-test-form');
    const teacherTestList = document.getElementById('teacher-test-list');
    const currentTestName = document.getElementById('current-test-name');
    const currentTestMeta = document.getElementById('current-test-meta');
    const submissionsTableBody = document.getElementById('submissions-table-body');
    const autoExtractQpBtn = document.getElementById('auto-extract-qp-btn');
    const qpFileInput = document.getElementById('qp-file-input');
    const qpDropZone = document.getElementById('qp-drop-zone');
    const newTestQuestions = document.getElementById('new-test-questions');
    const autoExtractModelBtn = document.getElementById('auto-extract-model-btn');
    const modelPdfInput = document.getElementById('model-pdf-input');
    const modelDropZone = document.getElementById('model-drop-zone');
    const newTestModelAns = document.getElementById('new-test-model-ans');
    const btnLoadTestSample = document.getElementById('btn-load-test-sample');

    // Teacher Override Modal
    const overrideModal = document.getElementById('override-modal');
    const closeOverrideBtn = document.getElementById('close-override-btn');
    const overrideForm = document.getElementById('override-form');
    const overrideStuName = document.getElementById('override-stu-name');
    const overrideAiScore = document.getElementById('override-ai-score');
    const overrideNewMarks = document.getElementById('override-new-marks');
    const overrideRemarks = document.getElementById('override-remarks');
    let currentOverrideSubId = null;

    // DOM Elements - OCR Lab
    const labDropZone = document.getElementById('lab-drop-zone');
    const labFileInput = document.getElementById('lab-file-input');
    const labFileChip = document.getElementById('lab-file-chip');
    const labFileName = document.getElementById('lab-file-name');
    const labSampleImg = document.getElementById('lab-sample-img');
    const labSamplePdf = document.getElementById('lab-sample-pdf');
    const labProcessBtn = document.getElementById('lab-process-btn');
    const labStatTime = document.getElementById('lab-stat-time');
    const labStatConf = document.getElementById('lab-stat-conf');
    const labStatSkew = document.getElementById('lab-stat-skew');
    const labOrigImg = document.getElementById('lab-orig-img');
    const labProcImg = document.getElementById('lab-proc-img');
    const labTextOutput = document.getElementById('lab-text-output');
    const labCopyBtn = document.getElementById('lab-copy-btn');

    // ─────────────────────────────────────────────────────────────
    // TOAST NOTIFICATIONS
    // ─────────────────────────────────────────────────────────────
    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast';
        const icon = type === 'success' ? '✅' : (type === 'error' ? '❌' : 'ℹ️');
        toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            setTimeout(() => toast.remove(), 200);
        }, 3500);
    }

    // ─────────────────────────────────────────────────────────────
    // TAB SWITCHING
    // ─────────────────────────────────────────────────────────────
    roleTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;
            state.activeTab = target;

            roleTabs.forEach(t => t.classList.remove('active'));
            portalViews.forEach(v => v.classList.remove('active'));

            tab.classList.add('active');
            const targetView = document.getElementById(`view-${target}`);
            if (targetView) targetView.classList.add('active');

            if (target === 'student-portal' || target === 'teacher-portal') {
                loadTests();
            }
        });
    });

    // ─────────────────────────────────────────────────────────────
    // API HELPERS: LOAD TESTS & SUBMISSIONS
    // ─────────────────────────────────────────────────────────────
    async function loadTests() {
        try {
            const res = await fetch('/api/tests');
            const data = await res.json();
            if (data.success) {
                state.tests = data.tests;
                renderStudentTests();
                renderTeacherTests();
            }
        } catch (e) {
            console.error('Failed to load tests:', e);
        }
    }

    function renderStudentTests() {
        if (!studentTestList) return;
        studentTestList.innerHTML = '';
        activeTestCount.innerText = state.tests.length;

        if (state.tests.length === 0) {
            studentTestList.innerHTML = '<div class="table-empty">No active tests posted yet.</div>';
            return;
        }

        state.tests.forEach(test => {
            const card = document.createElement('div');
            card.className = 'test-card';
            card.innerHTML = `
                <div>
                    <span class="test-card-subject">${escapeHtml(test.subject)}</span>
                    <h3 class="test-card-title">${escapeHtml(test.title)}</h3>
                    <div class="test-card-meta">
                        <span>📅 Due: ${test.due_date}</span>
                        <span>📝 ${test.id}</span>
                    </div>
                </div>
                <div class="test-card-footer">
                    <span class="marks-tag">Max: ${test.max_marks} Marks</span>
                    <button type="button" class="btn-primary open-submit-btn" data-id="${test.id}">
                        <span>Submit Solution</span>
                    </button>
                </div>
            `;
            studentTestList.appendChild(card);
        });

        document.querySelectorAll('.open-submit-btn').forEach(btn => {
            btn.addEventListener('click', () => openSubmitModal(btn.dataset.id));
        });
    }

    function renderTeacherTests() {
        if (!teacherTestList) return;
        teacherTestList.innerHTML = '';

        if (state.tests.length === 0) {
            teacherTestList.innerHTML = '<div class="sidebar-item-meta">No tests created yet.</div>';
            return;
        }

        state.tests.forEach((test, idx) => {
            const item = document.createElement('div');
            item.className = `test-sidebar-item ${test.id === state.selectedTestId ? 'active' : ''}`;
            item.dataset.id = test.id;
            item.innerHTML = `
                <div class="sidebar-item-title">${escapeHtml(test.title)}</div>
                <div class="sidebar-item-meta">
                    <span>${test.submissions_count || 0} Submissions</span>
                    <span>Max: ${test.max_marks} M</span>
                </div>
            `;
            item.addEventListener('click', () => selectTeacherTest(test.id));
            teacherTestList.appendChild(item);

            if (idx === 0 && !state.selectedTestId) {
                selectTeacherTest(test.id);
            }
        });
    }

    async function selectTeacherTest(testId) {
        state.selectedTestId = testId;
        const test = state.tests.find(t => t.id === testId);
        if (!test) return;

        // Highlight active sidebar item
        document.querySelectorAll('.test-sidebar-item').forEach(el => {
            el.classList.toggle('active', el.dataset.id === testId);
        });

        currentTestName.innerText = test.title;
        currentTestMeta.innerText = `Course: ${test.subject} | Max Marks: ${test.max_marks} | Due: ${test.due_date}`;

        try {
            const res = await fetch(`/api/tests/${testId}/submissions`);
            const data = await res.json();
            if (data.success) {
                state.submissions = data.submissions;
                renderSubmissionsTable(data.submissions, test.max_marks);
            }
        } catch (e) {
            console.error('Failed to load submissions:', e);
        }
    }

    function renderSubmissionsTable(subs, maxMarks) {
        if (!submissionsTableBody) return;
        submissionsTableBody.innerHTML = '';

        if (!subs || subs.length === 0) {
            submissionsTableBody.innerHTML = '<tr><td colspan="7" class="table-empty">No student submissions recorded yet for this test.</td></tr>';
            return;
        }

        subs.forEach(sub => {
            const evalData = sub.evaluation || {};
            const aiScore = evalData.marks_obtained !== undefined ? evalData.marks_obtained : '-';
            const finalMarks = sub.teacher_override !== null && sub.teacher_override !== undefined ? sub.teacher_override : aiScore;
            const status = evalData.status || 'Evaluated';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${escapeHtml(sub.student_name)}</strong></td>
                <td><code>${escapeHtml(sub.student_roll)}</code></td>
                <td>${sub.submitted_at ? sub.submitted_at.split(' ')[1] : '-'}</td>
                <td><span class="score-pill">${aiScore} / ${maxMarks}</span></td>
                <td><strong>${finalMarks} / ${maxMarks}</strong> ${sub.teacher_override !== null ? '<span style="font-size:0.75rem; color:#8b5cf6;">(Override)</span>' : ''}</td>
                <td><span class="score-pct-badge">${status}</span></td>
                <td>
                    <div style="display: flex; gap: 0.4rem;">
                        <button type="button" class="btn-pill inspect-sub-btn" data-id="${sub.id}" style="background: #ede9fe; color: #6d28d9; border-color: #ddd6fe;">👁️ Inspect Sheet</button>
                        <button type="button" class="btn-pill override-btn" data-id="${sub.id}">Override</button>
                    </div>
                </td>
            `;
            submissionsTableBody.appendChild(tr);
        });

        document.querySelectorAll('.inspect-sub-btn').forEach(btn => {
            btn.addEventListener('click', () => openInspectModal(btn.dataset.id));
        });

        document.querySelectorAll('.override-btn').forEach(btn => {
            btn.addEventListener('click', () => openOverrideModal(btn.dataset.id));
        });
    }

    // ─────────────────────────────────────────────────────────────
    // TEACHER INSPECTION MODAL (VIEW SHEET & EXTRACTION)
    // ─────────────────────────────────────────────────────────────
    const inspectModal = document.getElementById('inspect-modal');
    const closeInspectModalBtn = document.getElementById('close-inspect-modal-btn');
    const inspectStuName = document.getElementById('inspect-stu-name');
    const inspectStuRoll = document.getElementById('inspect-stu-roll');
    const inspectStuTime = document.getElementById('inspect-stu-time');
    const inspectAiScore = document.getElementById('inspect-ai-score');
    const inspectTestTag = document.getElementById('inspect-test-tag');
    const inspectOrigImg = document.getElementById('inspect-orig-img');
    const inspectProcImg = document.getElementById('inspect-proc-img');
    const inspectDocPlaceholder = document.getElementById('inspect-doc-placeholder');
    const inspectFilename = document.getElementById('inspect-filename');
    const inspectTabOrig = document.getElementById('inspect-tab-orig');
    const inspectTabProc = document.getElementById('inspect-tab-proc');
    const inspectExtractedText = document.getElementById('inspect-extracted-text');
    const inspectCopyTextBtn = document.getElementById('inspect-copy-text-btn');
    const inspectReasoning = document.getElementById('inspect-reasoning');
    const inspectCoveredList = document.getElementById('inspect-covered-list');
    const inspectMissingList = document.getElementById('inspect-missing-list');
    const inspectFeedback = document.getElementById('inspect-feedback');
    const inspectOverrideForm = document.getElementById('inspect-override-form');
    const inspectNewMarks = document.getElementById('inspect-new-marks');
    const inspectRemarks = document.getElementById('inspect-remarks');
    let currentInspectSubId = null;

    function openInspectModal(subId) {
        const sub = state.submissions.find(s => s.id === subId);
        if (!sub) return;

        currentInspectSubId = subId;
        const test = state.tests.find(t => t.id === sub.test_id) || {};
        const evalData = sub.evaluation || {};

        inspectTestTag.innerText = test.title || 'Assignment';
        inspectStuName.innerText = sub.student_name;
        inspectStuRoll.innerText = sub.student_roll;
        inspectStuTime.innerText = sub.submitted_at || '-';
        inspectAiScore.innerText = `${evalData.marks_obtained || 0} / ${evalData.max_marks || test.max_marks || 10} Marks`;

        // Configure sheet images
        const hasOrigImg = !!sub.original_image;
        const hasProcImg = !!sub.preprocessed_image;

        if (hasOrigImg || hasProcImg) {
            inspectDocPlaceholder.style.display = 'none';
            if (hasOrigImg) {
                inspectOrigImg.src = sub.original_image;
                inspectOrigImg.style.display = 'block';
                inspectProcImg.style.display = 'none';
                inspectTabOrig.classList.add('active');
                inspectTabProc.classList.remove('active');
            } else if (hasProcImg) {
                inspectProcImg.src = sub.preprocessed_image;
                inspectProcImg.style.display = 'block';
                inspectOrigImg.style.display = 'none';
                inspectTabProc.classList.add('active');
                inspectTabOrig.classList.remove('active');
            }
        } else {
            inspectOrigImg.style.display = 'none';
            inspectProcImg.style.display = 'none';
            inspectDocPlaceholder.style.display = 'flex';
            inspectFilename.innerText = sub.filename || 'solution.pdf';
        }

        // Extracted Text
        inspectExtractedText.innerText = sub.extracted_text || 'No text extracted from document.';

        // AI Reasoning & breakdown
        inspectReasoning.innerText = evalData.reasoning || 'No evaluation reasoning provided.';
        inspectFeedback.innerText = evalData.constructive_feedback || 'No actionable feedback provided.';

        // Concepts Covered
        inspectCoveredList.innerHTML = '';
        (evalData.concepts_covered || []).forEach(c => {
            const li = document.createElement('li');
            li.innerText = c;
            inspectCoveredList.appendChild(li);
        });

        // Concepts Missing
        inspectMissingList.innerHTML = '';
        (evalData.concepts_missing || []).forEach(m => {
            const li = document.createElement('li');
            li.innerText = m;
            inspectMissingList.appendChild(li);
        });

        // Pre-fill override form
        inspectNewMarks.value = sub.teacher_override !== null ? sub.teacher_override : (evalData.marks_obtained || 0);
        inspectRemarks.value = sub.teacher_remarks || '';

        inspectModal.style.display = 'flex';
    }

    if (closeInspectModalBtn) {
        closeInspectModalBtn.addEventListener('click', () => {
            inspectModal.style.display = 'none';
        });
    }

    if (inspectTabOrig) {
        inspectTabOrig.addEventListener('click', () => {
            const sub = state.submissions.find(s => s.id === currentInspectSubId);
            if (!sub || !sub.original_image) return;
            inspectTabOrig.classList.add('active');
            inspectTabProc.classList.remove('active');
            inspectOrigImg.style.display = 'block';
            inspectProcImg.style.display = 'none';
        });
    }

    if (inspectTabProc) {
        inspectTabProc.addEventListener('click', () => {
            const sub = state.submissions.find(s => s.id === currentInspectSubId);
            if (!sub || !sub.preprocessed_image) return;
            inspectTabProc.classList.add('active');
            inspectTabOrig.classList.remove('active');
            inspectProcImg.style.display = 'block';
            inspectOrigImg.style.display = 'none';
        });
    }

    if (inspectCopyTextBtn) {
        inspectCopyTextBtn.addEventListener('click', () => {
            const text = inspectExtractedText.innerText;
            if (text) {
                navigator.clipboard.writeText(text);
                showToast('Extracted student text copied to clipboard!', 'success');
            }
        });
    }

    if (inspectOverrideForm) {
        inspectOverrideForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentInspectSubId) return;

            const payload = {
                marks: parseFloat(inspectNewMarks.value),
                remarks: inspectRemarks.value
            };

            try {
                const res = await fetch(`/api/submissions/${currentInspectSubId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (data.success) {
                    showToast('Marks & remarks updated successfully!', 'success');
                    if (state.selectedTestId) {
                        selectTeacherTest(state.selectedTestId);
                    }
                    inspectAiScore.innerText = `${payload.marks} Marks (Revised)`;
                }
            } catch (err) {
                showToast('Failed to update marks.', 'error');
            }
        });
    }

    // ─────────────────────────────────────────────────────────────
    // STUDENT SUBMISSION MODAL
    // ─────────────────────────────────────────────────────────────
    function openSubmitModal(testId) {
        const test = state.tests.find(t => t.id === testId);
        if (!test) return;

        state.selectedTestId = testId;
        modalTestTitle.innerText = test.title;
        modalTestSubject.innerText = test.subject;
        modalTestQuestion.innerText = test.question;
        modalTestMarks.innerText = test.max_marks;

        // Reset form & states
        state.studentFile = null;
        stuFileChip.style.display = 'none';
        stuSubmitBtn.disabled = true;
        evalLoading.style.display = 'none';
        evalResult.style.display = 'none';
        studentSubmitForm.style.display = 'block';

        submitModal.style.display = 'flex';
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            submitModal.style.display = 'none';
        });
    }

    // Accordion toggle
    if (optionsToggle) {
        optionsToggle.addEventListener('click', () => {
            const isVisible = optionsBody.style.display === 'block';
            optionsBody.style.display = isVisible ? 'none' : 'block';
            optionsToggle.querySelector('.chevron').innerText = isVisible ? '▼' : '▲';
        });
    }

    // File selection for Student Form
    if (stuDropZone) {
        stuDropZone.addEventListener('click', () => stuFileInput.click());
        stuDropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            stuDropZone.classList.add('dragover');
        });
        stuDropZone.addEventListener('dragleave', () => stuDropZone.classList.remove('dragover'));
        stuDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            stuDropZone.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                setStudentFile(e.dataTransfer.files[0]);
            }
        });
    }

    if (stuFileInput) {
        stuFileInput.addEventListener('change', () => {
            if (stuFileInput.files.length > 0) {
                setStudentFile(stuFileInput.files[0]);
            }
        });
    }

    if (stuFileRemove) {
        stuFileRemove.addEventListener('click', () => {
            state.studentFile = null;
            stuFileInput.value = '';
            stuFileChip.style.display = 'none';
            stuSubmitBtn.disabled = true;
        });
    }

    function setStudentFile(file) {
        state.studentFile = file;
        stuFileName.innerText = file.name;
        stuFileSize.innerText = formatBytes(file.size);
        stuFileChip.style.display = 'inline-flex';
        stuSubmitBtn.disabled = false;
    }

    // Quick samples
    if (stuLoadSampleImg) {
        stuLoadSampleImg.addEventListener('click', () => loadSampleForStudent('image'));
    }
    if (stuLoadSamplePdf) {
        stuLoadSamplePdf.addEventListener('click', () => loadSampleForStudent('pdf'));
    }

    async function loadSampleForStudent(type) {
        try {
            showToast(`Loading sample ${type}...`);
            const res = await fetch(`/api/samples/${type}`);
            const data = await res.json();
            const blob = await (await fetch(data.data_url)).blob();
            const file = new File([blob], data.filename, { type: data.mime_type });
            setStudentFile(file);
            showToast(`Sample ${file.name} loaded!`, 'success');
        } catch (e) {
            showToast('Failed to load sample.', 'error');
        }
    }

    // Submit & Evaluate Student Solution
    if (studentSubmitForm) {
        studentSubmitForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!state.studentFile || !state.selectedTestId) return;

            studentSubmitForm.style.display = 'none';
            evalLoading.style.display = 'block';

            const formData = new FormData();
            formData.append('file', state.studentFile);
            formData.append('student_name', document.getElementById('stu-name').value);
            formData.append('student_roll', document.getElementById('stu-roll').value);
            formData.append('apply_grayscale', document.getElementById('stu-grayscale').checked);
            formData.append('apply_denoise', document.getElementById('stu-denoise').checked);
            formData.append('apply_deskew', document.getElementById('stu-deskew').checked);
            formData.append('apply_threshold', document.getElementById('stu-threshold').checked);

            try {
                const res = await fetch(`/api/tests/${state.selectedTestId}/submit`, {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();
                evalLoading.style.display = 'none';

                if (data.success) {
                    renderEvaluationResult(data);
                    showToast('Evaluation completed successfully!', 'success');
                } else {
                    showToast(data.detail || 'Evaluation failed.', 'error');
                    studentSubmitForm.style.display = 'block';
                }
            } catch (err) {
                evalLoading.style.display = 'none';
                studentSubmitForm.style.display = 'block';
                showToast('Server error during evaluation: ' + err.message, 'error');
            }
        });
    }

    function renderEvaluationResult(data) {
        const ev = data.evaluation || {};
        const test = state.tests.find(t => t.id === state.selectedTestId) || {};

        resScore.innerText = ev.marks_obtained !== undefined ? ev.marks_obtained : '-';
        resMaxScore.innerText = ev.max_marks || test.max_marks || 10;
        resPercentage.innerText = `${ev.percentage || 0}% Overall Accuracy`;
        resStatusBadge.innerText = ev.status || 'Evaluated';
        resReasoning.innerText = ev.reasoning || 'Evaluation completed.';
        resFeedback.innerText = ev.constructive_feedback || 'No specific feedback generated.';

        // Covered concepts
        resCoveredList.innerHTML = '';
        (ev.concepts_covered || []).forEach(c => {
            const li = document.createElement('li');
            li.innerText = c;
            resCoveredList.appendChild(li);
        });

        // Missing concepts
        resMissingList.innerHTML = '';
        (ev.concepts_missing || []).forEach(m => {
            const li = document.createElement('li');
            li.innerText = m;
            resMissingList.appendChild(li);
        });

        // Raw text & preview
        resExtractedText.innerText = data.extracted_text || 'No text extracted.';
        if (data.preprocessed_image) {
            resPreprocessedImg.src = data.preprocessed_image;
            resImgContainer.style.display = 'block';
        } else {
            resImgContainer.style.display = 'none';
        }

        evalResult.style.display = 'block';
    }

    // ─────────────────────────────────────────────────────────────
    // TEACHER PORTAL: CREATE TEST & OVERRIDES
    // ─────────────────────────────────────────────────────────────
    if (openCreateTestBtn) {
        openCreateTestBtn.addEventListener('click', () => {
            createTestModal.style.display = 'flex';
        });
    }
    if (closeCreateModalBtn) {
        closeCreateModalBtn.addEventListener('click', () => {
            createTestModal.style.display = 'none';
        });
    }

    // Helper to auto-extract text from PDF/Image into a target textarea
    async function extractToField(file, targetTextarea, fieldName) {
        if (!file || !targetTextarea) return;
        showToast(`Extracting ${fieldName} from ${file.name}...`);
        targetTextarea.placeholder = `⏳ Extracting text from ${file.name} with AI Vision...`;
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('apply_grayscale', 'true');
        formData.append('apply_denoise', 'true');
        formData.append('apply_deskew', 'true');
        formData.append('apply_threshold', 'false');

        try {
            const res = await fetch('/api/extract', { method: 'POST', body: formData });
            const data = await res.json();
            if (data.success && data.text) {
                targetTextarea.value = data.text;
                showToast(`${fieldName} extracted successfully!`, 'success');
            } else {
                showToast(data.detail || `Failed to extract ${fieldName}.`, 'error');
            }
        } catch (e) {
            showToast(`Error extracting ${fieldName}: ${e.message}`, 'error');
        }
    }

    // 1. Question Paper Auto-Extraction Handlers
    if (autoExtractQpBtn) {
        autoExtractQpBtn.addEventListener('click', () => qpFileInput.click());
    }
    if (qpFileInput) {
        qpFileInput.addEventListener('change', () => {
            if (qpFileInput.files.length > 0) {
                extractToField(qpFileInput.files[0], newTestQuestions, 'Question Paper');
            }
        });
    }
    if (qpDropZone) {
        qpDropZone.addEventListener('click', () => qpFileInput.click());
        qpDropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            qpDropZone.classList.add('dragover');
        });
        qpDropZone.addEventListener('dragleave', () => qpDropZone.classList.remove('dragover'));
        qpDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            qpDropZone.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                extractToField(e.dataTransfer.files[0], newTestQuestions, 'Question Paper');
            }
        });
    }

    // 2. Model Solution Auto-Extraction Handlers
    if (autoExtractModelBtn) {
        autoExtractModelBtn.addEventListener('click', () => modelPdfInput.click());
    }
    if (modelPdfInput) {
        modelPdfInput.addEventListener('change', () => {
            if (modelPdfInput.files.length > 0) {
                extractToField(modelPdfInput.files[0], newTestModelAns, 'Model Answer');
            }
        });
    }
    if (modelDropZone) {
        modelDropZone.addEventListener('click', () => modelPdfInput.click());
        modelDropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            modelDropZone.classList.add('dragover');
        });
        modelDropZone.addEventListener('dragleave', () => modelDropZone.classList.remove('dragover'));
        modelDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            modelDropZone.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                extractToField(e.dataTransfer.files[0], newTestModelAns, 'Model Answer');
            }
        });
    }

    // 3. Quick Template Auto-Fill Button
    if (btnLoadTestSample) {
        btnLoadTestSample.addEventListener('click', () => {
            const randSuffix = Math.floor(100 + Math.random() * 900);
            document.getElementById('new-test-id').value = `test_ml_opt_${randSuffix}`;
            document.getElementById('new-test-subject').value = 'Machine Learning & Optimization';
            document.getElementById('new-test-title').value = 'Gradient Descent & Cost Function Minimization';
            document.getElementById('new-test-marks').value = '10';
            document.getElementById('new-test-due').value = '2026-11-15';
            newTestQuestions.value = '1. Explain the mathematical intuition of Gradient Descent in Supervised Learning.\n2. Differentiate between Batch Gradient Descent and Stochastic Gradient Descent (SGD).\n3. Why is the learning rate hyperparameter crucial for convergence?';
            newTestModelAns.value = '1. Gradient Descent is an iterative optimization algorithm that updates model parameters in the direction of steepest descent (negative gradient of the cost function) to minimize loss.\n2. Batch Gradient Descent uses the entire training dataset to calculate the gradient at each step (stable but computationally heavy). SGD updates parameters per single training sample (fast, adds stochastic noise that can escape local minima).\n3. Learning rate determines step size. Too high causes oscillation or divergence; too low leads to very slow training or getting trapped.';
            document.getElementById('new-test-rubric').value = 'Cost function minimization concept: 3 marks; Batch vs SGD distinction: 4 marks; Learning rate tradeoffs: 3 marks.';
            showToast('Sample Machine Learning assignment loaded into form!', 'success');
        });
    }

    if (createTestForm) {
        createTestForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                id: document.getElementById('new-test-id').value.trim(),
                title: document.getElementById('new-test-title').value.trim(),
                subject: document.getElementById('new-test-subject').value.trim(),
                max_marks: parseFloat(document.getElementById('new-test-marks').value),
                due_date: document.getElementById('new-test-due').value,
                question: newTestQuestions.value.trim(),
                model_answer: newTestModelAns.value.trim(),
                rubric: document.getElementById('new-test-rubric').value.trim()
            };

            try {
                const res = await fetch('/api/tests', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (data.success) {
                    createTestModal.style.display = 'none';
                    createTestForm.reset();
                    showToast(`Test '${payload.id}' published successfully!`, 'success');
                    await loadTests();
                    selectTeacherTest(payload.id);
                } else {
                    showToast(data.detail || 'Failed to create test.', 'error');
                }
            } catch (err) {
                showToast('Error publishing test.', 'error');
            }
        });
    }

    // Teacher Override Modal Handlers
    function openOverrideModal(subId) {
        const sub = state.submissions.find(s => s.id === subId);
        if (!sub) return;

        currentOverrideSubId = subId;
        overrideStuName.innerText = `${sub.student_name} (${sub.student_roll})`;
        overrideAiScore.innerText = `${sub.evaluation?.marks_obtained || 0} Marks`;
        overrideNewMarks.value = sub.teacher_override !== null ? sub.teacher_override : (sub.evaluation?.marks_obtained || 0);
        overrideRemarks.value = sub.teacher_remarks || '';

        overrideModal.style.display = 'flex';
    }

    if (closeOverrideBtn) {
        closeOverrideBtn.addEventListener('click', () => overrideModal.style.display = 'none');
    }

    if (overrideForm) {
        overrideForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentOverrideSubId) return;

            const payload = {
                marks: parseFloat(overrideNewMarks.value),
                remarks: overrideRemarks.value
            };

            try {
                const res = await fetch(`/api/submissions/${currentOverrideSubId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (data.success) {
                    overrideModal.style.display = 'none';
                    showToast('Marks updated successfully!', 'success');
                    if (state.selectedTestId) {
                        selectTeacherTest(state.selectedTestId);
                    }
                }
            } catch (err) {
                showToast('Failed to update marks.', 'error');
            }
        });
    }

    // ─────────────────────────────────────────────────────────────
    // OCR DIAGNOSTIC LAB
    // ─────────────────────────────────────────────────────────────
    // OCR DIAGNOSTIC LAB & SURYA OCR CONTROLS
    // ─────────────────────────────────────────────────────────────
    let currentLabEngine = 'standard';
    const engineOptStandard = document.getElementById('engine-opt-standard');
    const engineOptSurya = document.getElementById('engine-opt-surya');
    const engineTickStandard = document.getElementById('engine-tick-standard');
    const engineTickSurya = document.getElementById('engine-tick-surya');
    const radioEngineStandard = document.getElementById('radio-engine-standard');
    const radioEngineSurya = document.getElementById('radio-engine-surya');
    const engineActiveBadge = document.getElementById('engine-active-badge');
    const labOpencvFiltersSection = document.getElementById('lab-opencv-filters-section');
    const labSuryaInfoBanner = document.getElementById('lab-surya-info-banner');

    function setEngineUI(engine) {
        currentLabEngine = engine;
        const isStandard = engine === 'standard';

        if (radioEngineStandard) radioEngineStandard.checked = isStandard;
        if (radioEngineSurya) radioEngineSurya.checked = !isStandard;

        if (engineOptStandard) {
            engineOptStandard.classList.toggle('active', isStandard);
            engineOptStandard.style.border = isStandard ? '2px solid #4f46e5' : '1.5px solid #e2e8f0';
            engineOptStandard.style.background = isStandard ? '#f5f3ff' : '#ffffff';
        }

        if (engineOptSurya) {
            engineOptSurya.classList.toggle('active', !isStandard);
            engineOptSurya.style.border = !isStandard ? '2px solid #10b981' : '1.5px solid #e2e8f0';
            engineOptSurya.style.background = !isStandard ? '#ecfdf5' : '#ffffff';
        }

        if (engineTickStandard) {
            engineTickStandard.style.background = isStandard ? '#4f46e5' : '#ffffff';
            engineTickStandard.style.borderColor = isStandard ? '#4f46e5' : '#cbd5e1';
            const svg = engineTickStandard.querySelector('.tick-svg');
            if (svg) svg.style.display = isStandard ? 'block' : 'none';
        }

        if (engineTickSurya) {
            engineTickSurya.style.background = !isStandard ? '#10b981' : '#ffffff';
            engineTickSurya.style.borderColor = !isStandard ? '#10b981' : '#cbd5e1';
            const svg = engineTickSurya.querySelector('.tick-svg');
            if (svg) svg.style.display = !isStandard ? 'block' : 'none';
        }

        if (engineActiveBadge) {
            engineActiveBadge.innerText = isStandard ? 'Standard Active' : 'Surya GPU Active';
            engineActiveBadge.style.color = isStandard ? '#4f46e5' : '#059669';
            engineActiveBadge.style.background = isStandard ? 'rgba(99, 102, 241, 0.12)' : 'rgba(16, 185, 129, 0.12)';
            engineActiveBadge.style.borderColor = isStandard ? 'rgba(99, 102, 241, 0.25)' : 'rgba(16, 185, 129, 0.25)';
        }

        if (labOpencvFiltersSection) labOpencvFiltersSection.style.display = isStandard ? 'block' : 'none';
        if (labSuryaInfoBanner) labSuryaInfoBanner.style.display = !isStandard ? 'block' : 'none';
        if (suryaDeviceConfig) suryaDeviceConfig.style.display = !isStandard ? 'block' : 'none';

        if (labProcessBtn) {
            labProcessBtn.innerText = isStandard ? 'Run Extraction Pipeline' : '⚡ Run Surya OCR Extraction';
        }
    }

    // Surya Device Controls
    let currentSuryaDevice = 'auto';
    const suryaDeviceConfig = document.getElementById('surya-device-config');
    const deviceBtnAuto = document.getElementById('device-btn-auto');
    const deviceBtnGpu = document.getElementById('device-btn-gpu');
    const deviceBtnCpu = document.getElementById('device-btn-cpu');
    const deviceDescText = document.getElementById('device-desc-text');
    const suryaDeviceBadge = document.getElementById('surya-device-badge');

    function setSuryaDeviceMode(mode) {
        currentSuryaDevice = mode;
        const btns = [
            { el: deviceBtnAuto, key: 'auto', border: '#10b981', bg: '#dcfce7', text: '#047857' },
            { el: deviceBtnGpu, key: 'gpu', border: '#6366f1', bg: '#e0e7ff', text: '#4338ca' },
            { el: deviceBtnCpu, key: 'cpu', border: '#0284c7', bg: '#e0f2fe', text: '#0369a1' }
        ];
        btns.forEach(b => {
            if (!b.el) return;
            const isActive = b.key === mode;
            b.el.style.border = isActive ? `1.5px solid ${b.border}` : '1px solid #cbd5e1';
            b.el.style.background = isActive ? b.bg : '#ffffff';
            b.el.style.color = isActive ? b.text : '#475569';
            b.el.style.fontWeight = isActive ? '700' : '600';
        });

        if (deviceDescText) {
            if (mode === 'auto') {
                deviceDescText.innerHTML = '<strong>Auto:</strong> Uses GPU if ≥2.4 GB VRAM is free; automatically switches to CPU if memory is low. Never crashes on OOM.';
            } else if (mode === 'gpu') {
                deviceDescText.innerHTML = '<strong>GPU Mode:</strong> Forces NVIDIA RTX 3050 CUDA execution. Automatic CPU fallback protects against OOM.';
            } else {
                deviceDescText.innerHTML = '<strong>CPU Mode:</strong> Runs 100% on CPU (RAM). Guaranteed zero GPU VRAM consumption.';
            }
        }

        if (suryaDeviceBadge) {
            if (mode === 'auto') {
                suryaDeviceBadge.innerText = 'AUTO (SAFE)';
                suryaDeviceBadge.style.background = '#dcfce7';
                suryaDeviceBadge.style.color = '#15803d';
            } else if (mode === 'gpu') {
                suryaDeviceBadge.innerText = 'GPU (RTX 3050)';
                suryaDeviceBadge.style.background = '#e0e7ff';
                suryaDeviceBadge.style.color = '#4338ca';
            } else {
                suryaDeviceBadge.innerText = 'CPU SAFE MODE';
                suryaDeviceBadge.style.background = '#e0f2fe';
                suryaDeviceBadge.style.color = '#0369a1';
            }
        }
    }

    if (deviceBtnAuto) deviceBtnAuto.addEventListener('click', () => setSuryaDeviceMode('auto'));
    if (deviceBtnGpu) deviceBtnGpu.addEventListener('click', () => setSuryaDeviceMode('gpu'));
    if (deviceBtnCpu) deviceBtnCpu.addEventListener('click', () => setSuryaDeviceMode('cpu'));

    if (engineOptStandard) {
        engineOptStandard.addEventListener('click', (e) => {
            e.preventDefault();
            setEngineUI('standard');
            showToast('Selected: Standard Pipeline (Gemma 3 + PaddleOCR)');
        });
    }

    if (engineOptSurya) {
        engineOptSurya.addEventListener('click', (e) => {
            e.preventDefault();
            setEngineUI('surya');
            showToast('Selected: Surya OCR (PyTorch)', 'info');
        });
    }

    if (labDropZone) {
        labDropZone.addEventListener('click', () => labFileInput.click());
        labDropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            labDropZone.classList.add('dragover');
        });
        labDropZone.addEventListener('dragleave', () => labDropZone.classList.remove('dragover'));
        labDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            labDropZone.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                setLabFile(e.dataTransfer.files[0]);
            }
        });
    }

    if (labFileInput) {
        labFileInput.addEventListener('change', () => {
            if (labFileInput.files.length > 0) {
                setLabFile(labFileInput.files[0]);
            }
        });
    }

    function setLabFile(file) {
        state.labFile = file;
        labFileName.innerText = file.name;
        labFileChip.style.display = 'inline-flex';
        labProcessBtn.disabled = false;

        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                labOrigImg.src = e.target.result;
                labOrigImg.style.display = 'block';
                document.querySelector('#lab-orig-viewport .placeholder-text').style.display = 'none';
            };
            reader.readAsDataURL(file);
        } else {
            labOrigImg.style.display = 'none';
            document.querySelector('#lab-orig-viewport .placeholder-text').innerText = '📄 ' + file.name;
            document.querySelector('#lab-orig-viewport .placeholder-text').style.display = 'block';
        }
    }

    if (labSampleImg) {
        labSampleImg.addEventListener('click', () => loadSampleForLab('image'));
    }
    if (labSamplePdf) {
        labSamplePdf.addEventListener('click', () => loadSampleForLab('pdf'));
    }

    async function loadSampleForLab(type) {
        try {
            showToast(`Loading sample ${type}...`);
            const res = await fetch(`/api/samples/${type}`);
            const data = await res.json();
            const blob = await (await fetch(data.data_url)).blob();
            const file = new File([blob], data.filename, { type: data.mime_type });
            setLabFile(file);
            showToast(`Loaded ${file.name}`, 'success');
        } catch (e) {
            showToast('Failed to load sample', 'error');
        }
    }

    if (labProcessBtn) {
        labProcessBtn.addEventListener('click', async () => {
            if (!state.labFile) return;

            labProcessBtn.disabled = true;

            // Handle Surya OCR Engine Route
            if (currentLabEngine === 'surya') {
                labProcessBtn.innerText = '⏳ Processing Document with Surya OCR...';
                labTextOutput.innerText = `⚡ Running Surya OCR (Device: ${currentSuryaDevice.toUpperCase()})...\nProcessing document pages sequentially with VRAM safeguards, please wait...`;
                
                const formData = new FormData();
                formData.append('file', state.labFile);
                formData.append('device_mode', currentSuryaDevice);

                try {
                    const res = await fetch('/api/surya/extract', { method: 'POST', body: formData });
                    const data = await res.json();
                    labProcessBtn.disabled = false;
                    labProcessBtn.innerText = '⚡ Run Surya OCR Extraction';

                    if (data.success) {
                        labStatTime.innerText = `${((data.execution_time_ms || 0) / 1000).toFixed(2)}s`;
                        labStatConf.innerText = `${data.confidence || 92}%`;
                        const devName = data.device_used ? data.device_used.toUpperCase() : 'OK';
                        labStatSkew.innerText = `${data.lines_count || 0} lines • ${devName}`;
                        labTextOutput.innerText = data.text || 'No text detected.';

                        if (data.preview_url) {
                            labProcImg.src = data.preview_url;
                            labProcImg.style.display = 'block';
                            document.querySelector('#lab-proc-viewport .placeholder-text').style.display = 'none';
                        }
                        
                        if (data.fallback_used) {
                            showToast(`Surya OCR finished via CPU fallback to prevent CUDA OOM! (${((data.execution_time_ms || 0) / 1000).toFixed(1)}s)`, 'info');
                        } else {
                            showToast(`Surya OCR finished in ${((data.execution_time_ms || 0) / 1000).toFixed(1)}s!`, 'success');
                        }
                    } else {
                        labTextOutput.innerText = `❌ Surya OCR Error:\n${data.error || 'Extraction failed.'}`;
                        showToast(data.error || 'Surya OCR failed.', 'error');
                    }
                } catch (err) {
                    labProcessBtn.disabled = false;
                    labProcessBtn.innerText = '⚡ Run Surya OCR Extraction';
                    labTextOutput.innerText = 'Server error during Surya OCR: ' + err.message;
                    showToast('Server error during Surya OCR.', 'error');
                }
                return;
            }

            // Standard Pipeline Route
            labProcessBtn.innerText = 'Processing Pipeline...';
            labTextOutput.innerText = 'Running OCR and OpenCV binarization...';

            const formData = new FormData();
            formData.append('file', state.labFile);
            formData.append('apply_grayscale', document.getElementById('lab-gray').checked);
            formData.append('apply_denoise', document.getElementById('lab-denoise').checked);
            formData.append('apply_deskew', document.getElementById('lab-deskew').checked);
            formData.append('apply_threshold', document.getElementById('lab-thresh').checked);

            try {
                const res = await fetch('/api/extract', { method: 'POST', body: formData });
                let data;
                try {
                    data = await res.json();
                } catch (parseErr) {
                    const textErr = await res.text();
                    data = { success: false, detail: textErr || 'Server returned an invalid response.' };
                }
                
                labProcessBtn.disabled = false;
                labProcessBtn.innerText = 'Run Extraction Pipeline';

                if (data.success) {
                    labStatTime.innerText = `${data.metadata?.processing_time_seconds || 0}s`;
                    labStatConf.innerText = `${Math.round((data.metadata?.confidence_average || 1) * 100)}%`;
                    labStatSkew.innerText = `${data.metadata?.skew_angle || 0}°`;
                    labTextOutput.innerText = data.text || 'No text extracted.';

                    if (data.preprocessed_image) {
                        labProcImg.src = data.preprocessed_image;
                        labProcImg.style.display = 'block';
                        document.querySelector('#lab-proc-viewport .placeholder-text').style.display = 'none';
                    }
                    showToast('Extraction complete!', 'success');
                } else {
                    labTextOutput.innerText = data.detail || 'Extraction failed.';
                    showToast(data.detail || 'Extraction failed.', 'error');
                }
            } catch (err) {
                labProcessBtn.disabled = false;
                labProcessBtn.innerText = 'Run Extraction Pipeline';
                labTextOutput.innerText = 'Error: ' + err.message;
                showToast('Server error during extraction.', 'error');
            }
        });
    }


    if (labCopyBtn) {
        labCopyBtn.addEventListener('click', () => {
            const text = labTextOutput.innerText;
            if (text) {
                navigator.clipboard.writeText(text);
                showToast('Copied to clipboard!', 'success');
            }
        });
    }

    // Utility Helpers
    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>'"]/g, tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag));
    }

    function formatBytes(bytes, decimals = 1) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    // Initial load
    loadTests();
});
