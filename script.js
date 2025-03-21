let progress = parseInt(localStorage.getItem("progress")) || 0;
let content = "";
let answers = JSON.parse(localStorage.getItem("answers")) || {};

document.addEventListener("DOMContentLoaded", function() {
    if(localStorage.getItem("user")) {
        document.getElementById("loginContainer").classList.add("hidden");
        document.getElementById("appContainer").classList.remove("hidden");
        loadMarkdown();
    }
});

function login() {
    let user = document.getElementById("username").value;
    if(user) {
        localStorage.setItem("user", user);
        document.getElementById("loginContainer").classList.add("hidden");
        document.getElementById("appContainer").classList.remove("hidden");
        loadMarkdown();
    }
}

function logout() {
    localStorage.removeItem("user");
    localStorage.removeItem("progress");
    localStorage.removeItem("answers");
    location.reload();
}

function loadMarkdown() {
    fetch("content.md")
        .then(response => response.text())
        .then(text => {
            content = text;
            renderMarkdown();
        });
}

function renderMarkdown() {
    // Split the content into sections using headings (# or ##)
    let sections = content.split(/(?=# )/);
    let output = "";
    let unlocked = progress;
    
    sections.forEach((section, index) => {
        let lines = section.trim().split("\n");
        let title = lines[0].startsWith("#") ? lines.shift().replace(/#/g, "").trim() : "";
        
        // Join the content back
        let sectionText = lines.join("\n");
        
        // Find all subsections if any (## headings)
        let subsections = sectionText.split(/(?=## )/).filter(s => s.trim());
        
        // Create the section HTML
        let sectionHTML = `<div class='section ${index > unlocked ? "hidden" : ""}'>`;
        if(title) sectionHTML += `<h3 onclick="toggleSection(this)">${title}</h3>`;
        
        // If there are subsections, process each one
        if (subsections.length > 0) {
            subsections.forEach((subsection, subIndex) => {
                let subLines = subsection.trim().split("\n");
                let subTitle = subLines[0].startsWith("##") ? subLines.shift().replace(/#/g, "").trim() : "";
                
                if(subTitle) sectionHTML += `<h4>${subTitle}</h4>`;
                
                // Process subsection content
                let subSectionText = subLines.join("\n");
                let quizStartIndex = subSectionText.indexOf("%Q%");
                
                let regularText = quizStartIndex > -1 ? subSectionText.substring(0, quizStartIndex) : subSectionText;
                let quizText = quizStartIndex > -1 ? subSectionText.substring(quizStartIndex + 3) : "";
                
                sectionHTML += `<p>${regularText.replace(/\n/g, "<br>")}</p>`;
                
                // Process quiz if it exists
                if (quizText.trim()) {
                    sectionHTML += processQuiz(quizText, index, subIndex);
                }
            });
        } else {
            // No subsections, process the main section
            let quizStartIndex = sectionText.indexOf("%Q%");
            
            let regularText = quizStartIndex > -1 ? sectionText.substring(0, quizStartIndex) : sectionText;
            let quizText = quizStartIndex > -1 ? sectionText.substring(quizStartIndex + 3) : "";
            
            sectionHTML += `<p>${regularText.replace(/\n/g, "<br>")}</p>`;
            
            // Process quiz if it exists
            if (quizText.trim()) {
                sectionHTML += processQuiz(quizText, index);
            }
        }
        
        sectionHTML += `</div>`;
        output += sectionHTML;
    });
    
    document.getElementById("content").innerHTML = output;
    document.getElementById("title").textContent = "결혼 준비";
    
    // Initialize sections for already completed content
    if (progress > 0) {
        for (let i = 0; i < progress; i++) {
            let section = document.querySelectorAll(".section")[i];
            if (section) {
                section.classList.add("collapsed");
            }
        }
    }
}

// Toggle section collapse/expand
function toggleSection(element) {
    let section = element.closest('.section');
    section.classList.toggle('collapsed');
}

function processQuiz(quizText, sectionIndex, subSectionIndex = null) {
    let quizHTML = "";
    let prefix = subSectionIndex !== null ? `${sectionIndex}-${subSectionIndex}` : `${sectionIndex}`;
    
    // Parse the quiz questions
    let questions = [];
    let currentQuestion = null;
    
    // First, try to extract individual questions
    quizText.split("\n").forEach(line => {
        line = line.trim();
        if (!line) return;
        
        // Check if this is a new question
        let questionMatch = line.match(/^(\d+)\.\s+(.*)/);
        if (questionMatch) {
            if (currentQuestion) {
                questions.push(currentQuestion);
            }
            currentQuestion = {
                number: questionMatch[1],
                text: questionMatch[2],
                options: [],
                answer: null
            };
        } 
        // Check if this is an option
        else if (line.match(/^[a-z]\)\s+/) && currentQuestion) {
            currentQuestion.options.push(line);
        }
        // Check if this is the answer
        else if (line.includes("**정답:**") && currentQuestion) {
            currentQuestion.answer = line.replace("**정답:**", "").trim();
        }
    });
    
    // Add the last question
    if (currentQuestion) {
        questions.push(currentQuestion);
    }
    
    // If no questions were found with the above method, try another approach
    if (questions.length === 0) {
        let questionBlocks = quizText.split(/(?=\d+\.\s)/).filter(q => q.trim());
        
        questionBlocks.forEach((block, idx) => {
            let lines = block.trim().split("\n");
            let questionLine = lines[0];
            let questionMatch = questionLine.match(/^(\d+)\.\s+(.*)/);
            
            if (questionMatch) {
                let questionObj = {
                    number: questionMatch[1],
                    text: questionMatch[2],
                    options: [],
                    answer: null
                };
                
                for (let i = 1; i < lines.length; i++) {
                    let line = lines[i].trim();
                    if (line.match(/^[a-z]\)\s+/)) {
                        questionObj.options.push(line);
                    } else if (line.includes("**정답:**")) {
                        questionObj.answer = line.replace("**정답:**", "").trim();
                    }
                }
                
                questions.push(questionObj);
            }
        });
    }
    
    // Generate HTML for questions
    questions.forEach((question, qIndex) => {
        let questionId = `${prefix}-${qIndex}`;
        let savedAnswer = answers[questionId] || "";
        
        quizHTML += `<div class="quiz-question">`;
        quizHTML += `<p><strong>${question.number}. ${question.text}</strong></p>`;
        
        // Add options
        if (question.options.length > 0) {
            quizHTML += `<div class="quiz-options">`;
            question.options.forEach(option => {
                quizHTML += `<p>${option}</p>`;
            });
            quizHTML += `</div>`;
        }
        
        // Render answer input
        quizHTML += `<textarea class='question' data-index='${sectionIndex}' data-qindex='${qIndex}' placeholder='답변을 입력하세요'>${savedAnswer}</textarea><br>`;
        quizHTML += `</div>`;
    });
    
    // Add the "Next" button
    if (questions.length > 0) {
        quizHTML += `<button class='next-btn' data-index='${sectionIndex}' onclick='saveAnswers(${sectionIndex})'>다음</button>`;
    }
    
    return quizHTML;
}

function saveAnswers(index) {
    let inputs = document.querySelectorAll(`.section:nth-child(${index+1}) .question`);
    inputs.forEach(input => {
        let qIndex = input.dataset.qindex;
        answers[`${index}-${qIndex}`] = input.value.trim();
    });
    localStorage.setItem("answers", JSON.stringify(answers));
    
    // Add 'collapsed' class to the current section
    let currentSection = document.querySelectorAll(".section")[index];
    currentSection.classList.add("collapsed");
    
    // Increment progress and show next section
    progress++;
    localStorage.setItem("progress", progress);
    let nextSection = document.querySelectorAll(".section")[progress];
    if (nextSection) nextSection.classList.remove("hidden");
    
    // Disable the next button
    document.querySelector(`.section:nth-child(${index+1}) .next-btn`).disabled = true;
    
    // Scroll to the newly visible section
    if (nextSection) {
        nextSection.scrollIntoView({ behavior: "smooth" });
    }
}
