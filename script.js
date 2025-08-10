// --- IMPORTANT SECURITY WARNING ---
// The API_KEY is exposed in this client-side code. This is NOT secure.
// For production, restrict your API key in the Google Cloud Console to your
// website's domain, or use a server-side proxy.
const SHEET_ID = '1ywHXRlPdRO0KcfeVojc3awgRvicvPikZAFevXwXfTsA';
const API_KEY = 'AIzaSyB3iENa1u4_eEwg-oaoKnmSp25v_PFJzsg';
const LOGIN_RANGE = 'eeeee!A:B';

// --- DOM Elements ---
const loginSection = document.getElementById('login-section');
const loginForm = document.getElementById('login-form');
const usernameInput = document.getElementById('username-input');
const passwordInput = document.getElementById('password-input');
const loginError = document.getElementById('login-error');

const sheetSelectionSection = document.getElementById('sheet-selection-section');
const sheetSelectionForm = document.getElementById('sheet-selection-form');
const sheetDropdown = document.getElementById('sheet-dropdown');
const sheetError = document.getElementById('sheet-error');

const loadingInitial = document.getElementById('loading-initial');
const quizPlayingSection = document.getElementById('quiz-playing-section');
const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
const rationaleContainer = document.getElementById('rationale-container');
const rationaleText = document.getElementById('rationale-text');
const nextBtn = document.getElementById('next-btn');

const resultsSection = document.getElementById('results-section');
const correctCountElement = document.getElementById('correct-count');
const wrongCountElement = document.getElementById('wrong-count');
const percentageScoreElement = document.getElementById('percentage-score');
const questionsReviewContainer = document.getElementById('questions-review-container');

const welcomeMessage = document.getElementById('welcome-message');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');
const timerText = document.getElementById('timer-text');

const generatePdfBtn = document.getElementById('generate-pdf-btn');
const restartQuizBtn = document.getElementById('restart-quiz-btn');
const pdfDownloadLinkContainer = document.getElementById('pdf-download-link-container');

// --- App State ---
let questions = [];
let currentQuestionIndex = 0;
let score = 0;
let timer;
let timeLeft = 60;
let userAnswers = [];
let userName = '';
let selectedSheet = '';
let availableSheets = [];
let resultsChart = null;
let currentPdfBlobUrl = null;

// --- Initialization ---
window.onload = () => {
    loadingInitial.classList.add('hide');
    loginSection.classList.remove('hide');
    addEventListeners();
};

function addEventListeners() {
    loginForm.addEventListener('submit', handleLogin);
    sheetSelectionForm.addEventListener('submit', handleSheetSelection);
    generatePdfBtn.addEventListener('click', handlePdfGeneration);
    restartQuizBtn.addEventListener('click', restartQuiz);
}

async function handleLogin(e) {
    e.preventDefault();
    const inputUsername = usernameInput.value.trim();
    const inputPassword = passwordInput.value.trim();
    
    if (await authenticateUser(inputUsername, inputPassword)) {
        userName = inputUsername;
        loginSection.classList.add('hide');
        loadingInitial.classList.remove('hide');
        await loadAvailableSheets();
    } else {
        loginError.textContent = 'Magacaaga ama Eraygaaga Sirta ah ma saxna.';
    }
}

async function handleSheetSelection(e) {
    e.preventDefault();
    selectedSheet = sheetDropdown.value;
    if (!selectedSheet) {
        sheetError.textContent = 'Fadlan dooro maado.';
        return;
    }
    sheetSelectionSection.classList.add('hide');
    loadingInitial.classList.remove('hide');
    await fetchQuestions();
}

async function handlePdfGeneration() {
    const btnText = generatePdfBtn.querySelector('.btn-text');
    const spinner = generatePdfBtn.querySelector('.loading-spinner');
    
    btnText.classList.add('hide');
    spinner.classList.remove('hide');
    generatePdfBtn.disabled = true;
    pdfDownloadLinkContainer.innerHTML = ''; 

    try {
        const pdfBlob = await createPdfBlob();
        
        if (currentPdfBlobUrl) {
            URL.revokeObjectURL(currentPdfBlobUrl);
        }
        currentPdfBlobUrl = URL.createObjectURL(pdfBlob);
        
        const downloadLink = document.createElement('a');
        downloadLink.href = currentPdfBlobUrl;
        downloadLink.download = `Natiijo-${userName}-${selectedSheet}.pdf`;
        downloadLink.className = 'btn btn-secondary';
        downloadLink.innerHTML = `<i class="fas fa-download"></i> Halkan Riix si aad ula Degto PDF`;
        
        pdfDownloadLinkContainer.appendChild(downloadLink);

    } catch (error) {
        console.error("Failed to generate PDF:", error);
        alert("Cilad ayaa ku timid diyaarinta PDF-ka. Fadlan isku day mar kale.");
    } finally {
        btnText.classList.remove('hide');
        spinner.classList.add('hide');
        generatePdfBtn.disabled = false;
    }
}

async function authenticateUser(username, password) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${LOGIN_RANGE}?key=${API_KEY}`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        const users = data.values;
        if (!users) return false;

        for (const user of users) {
            if (user[0] && user[1] && user[0].toLowerCase() === username.toLowerCase() && user[1] === password) {
                return true;
            }
        }
        return false;
    } catch (error) {
        console.error('Authentication error:', error);
        loginError.textContent = 'Cilad xagga isku xirka ah ayaa jirta. Fadlan isku day markale.';
        return false;
    }
}

async function loadAvailableSheets() {
    try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?key=${API_KEY}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        availableSheets = data.sheets.map(sheet => ({
            title: sheet.properties.title,
            sheetId: sheet.properties.sheetId
        }));

        sheetDropdown.innerHTML = '<option value="">Dooro Maado...</option>';
        availableSheets.forEach(sheet => {
            if (sheet.title.toLowerCase() !== 'eeeee') {
                const option = document.createElement('option');
                option.value = sheet.title;
                option.textContent = sheet.title;
                sheetDropdown.appendChild(option);
            }
        });
        loadingInitial.classList.add('hide');
        sheetSelectionSection.classList.remove('hide');
    } catch (error) {
        console.error('Error loading sheets:', error);
        sheetError.textContent = 'Khalad ayaa dhacay markii la soo dejinayay maadooyinka.';
        loadingInitial.classList.add('hide');
        sheetSelectionSection.classList.remove('hide');
    }
}

async function fetchQuestions() {
    try {
        const QUESTION_RANGE = `${selectedSheet}!A2:G`;
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${QUESTION_RANGE}?key=${API_KEY}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        const rows = data.values;
        if (!rows || rows.length === 0) throw new Error('Su\'aallo lagama helin maadadan.');

        questions = rows.map((row, index) => ({
            id: index + 1,
            question: row[0] || '',
            options: [row[1], row[2], row[3], row[4]].filter(option => option && option.trim() !== ''),
            correctAnswer: row[5] || '',
            rationale: row[6] || ''
        })).filter(q => q.question && q.options.length > 1 && q.correctAnswer);

        if (questions.length === 0) throw new Error('Su\'aallo sax ah lagama helin maadadan.');

        loadingInitial.classList.add('hide');
        quizPlayingSection.classList.remove('hide');
        welcomeMessage.textContent = ` ${userName}`;
        startQuiz();
    } catch (error) {
        console.error('Error fetching questions:', error);
        loadingInitial.classList.add('hide');
        sheetSelectionSection.classList.remove('hide');
        sheetError.textContent = `Khalad: ${error.message}. Fadlan isku day mar kale.`;
    }
}

function startQuiz() {
    currentQuestionIndex = 0;
    score = 0;
    userAnswers = [];
    questions = questions.sort(() => Math.random() - 0.5);
    updateProgress();
    displayQuestion();
}

function displayQuestion() {
    if (currentQuestionIndex >= questions.length) {
        endQuiz();
        return;
    }
    const question = questions[currentQuestionIndex];
    questionText.textContent = question.question;
    optionsContainer.innerHTML = '';
    rationaleContainer.classList.add('hide');
    nextBtn.classList.add('hide');

    const shuffledOptions = [...question.options].sort(() => Math.random() - 0.5);
    shuffledOptions.forEach(option => {
        const button = document.createElement('button');
        button.className = 'option-btn';
        button.textContent = option;
        button.onclick = () => selectAnswer(option, button);
        optionsContainer.appendChild(button);
    });
    timeLeft = 60;
    updateTimer();
    startTimer();
}

function selectAnswer(selectedOption, selectedButton) {
    clearInterval(timer);
    const question = questions[currentQuestionIndex];
    const isCorrect = selectedOption.trim() === question.correctAnswer.trim();
    userAnswers.push({
        question: question.question,
        selectedAnswer: selectedOption,
        correctAnswer: question.correctAnswer,
        isCorrect: isCorrect,
        rationale: question.rationale
    });
    if (isCorrect) {
        score++;
        selectedButton.classList.add('correct');
    } else {
        selectedButton.classList.add('wrong');
        Array.from(optionsContainer.children).forEach(btn => {
            if (btn.textContent.trim() === question.correctAnswer.trim()) {
                btn.classList.add('correct');
            }
        });
    }
    Array.from(optionsContainer.children).forEach(btn => btn.disabled = true);
    if (question.rationale) {
        rationaleText.textContent = question.rationale;
        rationaleContainer.classList.remove('hide');
    }
    nextBtn.classList.remove('hide');
    nextBtn.onclick = nextQuestion;
}

function nextQuestion() {
    currentQuestionIndex++;
    updateProgress();
    displayQuestion();
}

function updateProgress() {
    const progress = (currentQuestionIndex / questions.length) * 100;
    progressFill.style.width = `${progress}%`;
    progressText.textContent = `${currentQuestionIndex} / ${questions.length}`;
}

function startTimer() {
    timer = setInterval(() => {
        timeLeft--;
        updateTimer();
        if (timeLeft <= 0) {
            clearInterval(timer);
            userAnswers.push({
                question: questions[currentQuestionIndex].question,
                selectedAnswer: 'Waqtigaa kaa dhamaaday',
                correctAnswer: questions[currentQuestionIndex].correctAnswer,
                isCorrect: false,
                rationale: questions[currentQuestionIndex].rationale
            });
            nextQuestion();
        }
    }, 1000);
}

function updateTimer() {
    timerText.textContent = `${timeLeft}s`;
}

function endQuiz() {
    clearInterval(timer);
    quizPlayingSection.classList.add('hide');
    resultsSection.classList.remove('hide');
    displayResults();
}

function displayResults() {
    const totalQuestions = questions.length;
    const correctAnswers = score;
    const wrongAnswers = totalQuestions - correctAnswers;
    const percentage = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
    correctCountElement.textContent = correctAnswers;
    wrongCountElement.textContent = wrongAnswers;
    percentageScoreElement.textContent = `${percentage}%`;
    if (resultsChart) resultsChart.destroy();
    const ctx = document.getElementById('results-chart').getContext('2d');
    resultsChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Saxda ah', 'Qaldan'],
            datasets: [{
                data: [correctAnswers, wrongAnswers],
                backgroundColor: ['#10B981', '#EF4444'],
                borderColor: 'var(--gray-50)',
                borderWidth: 4
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '70%',
            plugins: { legend: { position: 'bottom', labels: { font: { size: 14 } } } }
        }
    });
    displayQuestionReview();
}

function displayQuestionReview() {
    questionsReviewContainer.innerHTML = '';
    userAnswers.forEach((answer, index) => {
        const itemClass = answer.isCorrect ? 'correct' : 'wrong';
        const questionDiv = document.createElement('div');
        questionDiv.className = `question-item ${itemClass}`;
        questionDiv.innerHTML = `
                <div class="question-header">
                    <span class="question-number">Su'aal ${index + 1}</span>
                    <span class="question-status ${itemClass}">${answer.isCorrect ? 'Sax' : 'Qalad'}</span>
                </div>
                <div class="question-text-review">${answer.question}</div>
                <div class="answer-section">
                    <div class="answer-row your-answer ${answer.isCorrect ? 'correct-answer' : 'wrong-answer'}">
                        <span class="answer-label">Jawaabtaada:</span>
                        <span class="answer-text">${answer.selectedAnswer}</span>
                    </div>
                    ${!answer.isCorrect ? `<div class="answer-row correct-answer"><span class="answer-label">Jawaabta Saxda ah:</span><span class="answer-text">${answer.correctAnswer}</span></div>` : ''}
                </div>
                ${answer.rationale ? `<div class="rationale-section"><div class="rationale-label"><i class="fas fa-lightbulb"></i> Falanqeyn</div><div class="rationale-text">${answer.rationale}</div></div>` : ''}
        `;
        questionsReviewContainer.appendChild(questionDiv);
    });
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const filter = btn.dataset.filter;
            document.querySelectorAll('.question-item').forEach(item => {
                item.style.display = (filter === 'all' || item.classList.contains(filter)) ? 'block' : 'none';
            });
        });
    });
}

async function getImageBase64(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok.');
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error('Error fetching image for PDF:', error);
        return null;
    }
}

async function createPdfBlob() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const logoUrl = 'https://res.cloudinary.com/dsnlshm9k/image/upload/v1734294137/LOGO_LAST_SAX_2024-2025_rkln16.png';
    
    // ---- PDF Header ----
    const logoData = await getImageBase64(logoUrl);
    let yPos = 15;

    if (logoData) {
        const imgProps = doc.getImageProperties(logoData);
        const imgWidth = 30;
        const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
        const xPos = (doc.internal.pageSize.getWidth() / 2) - (imgWidth / 2);
        doc.addImage(logoData, 'PNG', xPos, yPos, imgWidth, imgHeight);
        yPos += imgHeight + 8;
    }
    
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(16, 185, 129);
    doc.text('IMTIXANADA SHAHAADIGA F8', 105, yPos, { align: 'center' });
    yPos += 8;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(16, 185, 129);
    doc.text('WARBIXINTA NATIIJADA IMTIXAANKA', 105, yPos, { align: 'center' });
    yPos += 12;

    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.5);
    doc.line(20, yPos, 190, yPos);
    yPos += 12;

    // ---- User & Quiz Info ----
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(16, 185, 129);
    doc.text('XOGTA ARDAYGA:', 20, yPos);
    doc.text('XOGTA IMTIXAANKA:', 110, yPos);
    yPos += 8;
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(75, 85, 99);
    const currentDate = new Date().toLocaleDateString('so-SO', { year: 'numeric', month: 'long', day: 'numeric' });
    doc.text(`Magaca: ${userName}`, 20, yPos);
    doc.text(`Maadada: ${selectedSheet}`, 110, yPos);
    yPos += 7;
    doc.text(`Taariikhda: ${currentDate}`, 20, yPos);
    doc.text(`Su'aalaha: ${questions.length}`, 110, yPos);
    yPos += 12;

    // ---- Performance Summary ----
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(16, 185, 129);
    doc.text('NATIIJADA GUUD:', 20, yPos);

    const percentage = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;
    let performanceText;
    if (percentage >= 90) performanceText = 'GUUL WACAN (Excellent)';
    else if (percentage >= 70) performanceText = 'GUDBAY (Good)';
    else if (percentage >= 50) performanceText = 'LIITA (Needs Improvement)';
    else performanceText = 'HARAY (Failed)';
    
    doc.autoTable({
        startY: yPos + 2,
        head: [['Su\'aalaha Saxda ah', 'Su\'aalaha Qaldan', 'Boqolleyda (%)', 'Heerka']],
        body: [[score, questions.length - score, `${percentage}%`, performanceText]],
        theme: 'grid',
        styles: { fontSize: 10, cellPadding: 3, halign: 'center' },
        headStyles: { fillColor: [16, 185, 129] },
        didParseCell: function(data) {
            if (data.section === 'body' && data.column.index === 3) {
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.textColor = (percentage >= 70) ? [16, 185, 129] : [239, 68, 68]; 
            }
        },
        margin: { left: 20, right: 20 }
    });
    yPos = doc.lastAutoTable.finalY + 15;

    // ---- Detailed Answers Table ----
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(16, 185, 129);
    doc.text('FALANQEYNTA JAWAABAHA', 20, yPos);

    const tableData = userAnswers.map((answer, index) => [
        index + 1, answer.question, answer.selectedAnswer, answer.correctAnswer, answer.isCorrect ? 'Sax' : 'Qalad'
    ]);
    doc.autoTable({
        startY: yPos + 5,
        head: [['#', 'Su\'aasha', 'Jawaabtaada', 'Jawaabta Saxda ah', 'Natiijo']],
        body: tableData,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 2, overflow: 'linebreak', valign: 'middle' },
        headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
        columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 1: { cellWidth: 60 }, 2: { cellWidth: 40 }, 3: { cellWidth: 40 }, 4: { cellWidth: 20, halign: 'center' }},
        didDrawCell: function(data) {
            if (data.section === 'body' && data.column.index === 4) {
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.textColor = data.cell.raw === 'Sax' ? [16, 185, 129] : [239, 68, 68];
            }
        },
        margin: { left: 20, right: 20 }
    });

    // ---- Footer ----
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(156, 163, 175);
        doc.text('Waxaa soo saaray Cabdalla A. Shariif', 105, 285, { align: 'center' });
        doc.text(`Bogga ${i} ee ${pageCount}`, 190, 285, { align: 'right' });
    }
    return doc.output('blob');
}

function restartQuiz() {
    resultsSection.classList.add('hide');
    sheetSelectionSection.classList.remove('hide');
    pdfDownloadLinkContainer.innerHTML = '';
    if (currentPdfBlobUrl) {
        URL.revokeObjectURL(currentPdfBlobUrl);
        currentPdfBlobUrl = null;
    }
    sheetDropdown.selectedIndex = 0;
    sheetError.textContent = '';
    questions = [];
    currentQuestionIndex = 0;
    score = 0;
    userAnswers = [];
    selectedSheet = '';
    timeLeft = 60;
    clearInterval(timer);
    if (resultsChart) resultsChart.destroy();
    questionsReviewContainer.innerHTML = '';
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.filter === 'all') btn.classList.add('active');
    });
}