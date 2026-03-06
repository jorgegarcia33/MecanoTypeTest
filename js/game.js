/**
 * @fileoverview Game module for MecanoType
 * Handles core game logic, word generation, and user input
 */

import { audio, initAudio, playSound } from "./audio.js";
import { config } from "./config.js";
import { data } from "./data.js";
import {
  stats,
  userStats,
  saveUserStats,
  saveCharStats,
  checkAndSaveRecord,
  resetUserStats,
} from "./stats.js";
import {
  ui,
  timerContainer,
  timerDisplay,
  gameArea,
  wordsContainer,
  statsContainer,
  wpmEl,
  accEl,
  errorsEl,
  weakKeysEl,
  restartBtn,
  showToast,
  mobileInput,
} from "./ui.js";
import { t, startTimer, stopTimer } from "./utils.js";

// ===================================
// Game State
// ===================================

/** Statistics for the current game session */
let currentGameCharStats = {};

/**
 * Game state object
 * @type {Object}
 */
export const game = {
  timeLeft: config.timeLimit,
  currentWords: [],
  currentWordIndex: 0,
  currentLetterIndex: 0,
  isGameActive: false,
  isGameFinished: false,
  startTime: 0,
  correctChars: 0,
  totalChars: 0,
  errorCount: 0,
  zenBaseTop: 0,
};

export function initGame(tearPaper = true, keepView = false) {
  stopTimer();
  if (config.gameMode === "time") {
    game.timeLeft = config.timeLimit;
    timerDisplay.textContent = game.timeLeft;
    timerContainer.classList.remove("hidden");
  } else {
    timerContainer.classList.add("hidden");
  }
  const isRestart =
    wordsContainer.children.length > 0 ||
    game.isGameFinished ||
    ui.currentView !== "game";

  if (isRestart && tearPaper) {
    playSound("tear");
    const oldPaper = gameArea.cloneNode(true);
    oldPaper.id = "old-paper";
    oldPaper.style.position = "absolute";
    oldPaper.style.top = "0";
    oldPaper.style.left = "0";
    oldPaper.style.width = "100%";
    oldPaper.style.height = "100%";
    oldPaper.style.zIndex = "10";
    oldPaper.style.transform = gameArea.style.transform || "translateY(100px)";

    oldPaper.style.transition = "none";

    gameArea.parentElement.appendChild(oldPaper);

    void oldPaper.offsetWidth;

    oldPaper.classList.add("tearing");

    oldPaper.style.transition =
      "transform 0.6s ease-in, opacity 0.6s ease-in";

    oldPaper.style.transform = "translate(1000px, -200px) rotate(15deg)";
    oldPaper.style.opacity = "0";

    setTimeout(() => {
      oldPaper.remove();
    }, 600);
  }

  if (!keepView) {
    ui.currentView = "game";
  }
  window.removeEventListener("keydown", handleKeydown);
  window.removeEventListener("compositionend", handleCompositionEnd);

  game.currentWordIndex = 0;
  game.currentLetterIndex = 0;
  game.isGameActive = false;
  game.isGameFinished = false;
  game.correctChars = 0;
  game.totalChars = 0;
  game.errorCount = 0;
  currentGameCharStats = {};

  wordsContainer.innerHTML = "";
  wordsContainer.scrollTop = 0;

  if (!keepView) {
    wordsContainer.classList.remove("hidden");
    document.getElementById("settings-sheet").classList.add("hidden");
    document.getElementById("stats-sheet").classList.add("hidden");
  }

  statsContainer.classList.add("hidden");
  document.getElementById("restart-note").classList.add("hidden");
  restartBtn.classList.add("hidden");
  gameArea.style.alignItems = "stretch";
  document.body.classList.remove("focus-mode");

  if (config.zenModeEnabled) {
    document.body.classList.add("zen-mode");
    game.currentWords = [];
    const cursor = document.createElement("span");
    cursor.className = "zen-cursor";
    wordsContainer.appendChild(cursor);

    // Ensure layout is updated before measuring
    requestAnimationFrame(() => {
      game.zenBaseTop = cursor.offsetTop;
    });
  } else {
    document.body.classList.remove("zen-mode");
    game.currentWords = generateWords();
    renderWords();
  }

  window.addEventListener("keydown", handleKeydown);
  window.addEventListener("compositionend", handleCompositionEnd);

  if (mobileInput) mobileInput.focus();

  if (!config.zenModeEnabled) updateCursor();

  if (isRestart && tearPaper) {
    gameArea.style.transition = "none";
    gameArea.style.transform = "translateY(100%)";

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        gameArea.style.transition =
          "transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)";
        gameArea.style.transform = "translateY(100px)";
      });
    });
  } else {
    gameArea.style.transform = "translateY(100px)";
  }
}

export function generateWords() {
  const generated = [];
  const wordsLists = {
    es: data.wordsListES,
    de: data.wordsListDE,
    en: data.wordsListEN,
    fr: data.wordsListFR,
    pt: data.wordsListPT,
  };
  const list = wordsLists[config.currentLanguage];
  const count =
    data.wordCount === "infinite" || config.gameMode === "time"
      ? 100
      : data.wordCount;

  let practiceWords = [];

  if (config.generationMode === "learning") {
    const sortedWeakKeys = Object.entries(stats.charStats)
      .sort((a, b) => b[1].errors - a[1].errors)
      .map((entry) => entry[0]);

    const topWeakKeys = sortedWeakKeys.slice(0, 5);

    if (topWeakKeys.length > 0) {
      practiceWords = list.filter((word) =>
        topWeakKeys.some((key) => word.includes(key)),
      );
    }
  }

  for (let i = 0; i < count; i++) {
    let word = "";

    if (
      config.generationMode === "learning" &&
      practiceWords.length > 0 &&
      Math.random() < 0.6
    ) {
      word = practiceWords[Math.floor(Math.random() * practiceWords.length)];
    } else {
      word = list[Math.floor(Math.random() * list.length)];
    }

    if (config.uppercaseEnabled) {
      if (Math.random() < 0.6) {
        word = word.charAt(0).toUpperCase() + word.slice(1);
      } else if (Math.random() < 0.1) {
        word = word.toUpperCase();
      }
    }

    if (config.numbersEnabled) {
      if (Math.random() < 0.15) {
        word = Math.floor(Math.random() * 2024).toString();
      } else if (Math.random() < 0.1) {
        word += Math.floor(Math.random() * 10);
      }
    }

    if (config.symbolsEnabled) {
      if (Math.random() < 0.25) {
        const symbols = ".,!?;:()\"'-@#";
        const symbol = symbols.charAt(
          Math.floor(Math.random() * symbols.length),
        );

        if (".,!?;:".includes(symbol)) {
          word += symbol;
        } else if ("(".includes(symbol)) {
          word = "(" + word + ")";
        } else if ('"'.includes(symbol)) {
          word = '"' + word + '"';
        } else if ("-".includes(symbol)) {
          word = "-" + word;
        } else if ("@#".includes(symbol)) {
          word = symbol + word;
        }
      }
    }

    generated.push(word);
  }

  return generated;
}

export function renderWords(append = false) {
  if (!append) wordsContainer.innerHTML = "";

  const count =
    data.wordCount === "infinite" || config.gameMode === "time"
      ? 100
      : data.wordCount;
  const startIndex = append ? game.currentWords.length - count : 0;

  for (let i = startIndex; i < game.currentWords.length; i++) {
    const word = game.currentWords[i];
    const wordDiv = document.createElement("div");
    wordDiv.className = "word";

    word.split("").forEach((char) => {
      const letterSpan = document.createElement("span");
      letterSpan.className = "letter";
      letterSpan.textContent = char;
      wordDiv.appendChild(letterSpan);
    });

    wordsContainer.appendChild(wordDiv);
  }
}

export function updateCursor(instant = false) {
  if (config.zenModeEnabled) {
    updateZenCursor();
    return;
  }

  document
    .querySelectorAll(".letter")
    .forEach((el) => el.classList.remove("current"));
  document
    .querySelectorAll(".word")
    .forEach((el) => el.classList.remove("current-word-end"));

  const wordDivs = wordsContainer.querySelectorAll(".word");
  const currentWordDiv = wordDivs[game.currentWordIndex];

  if (currentWordDiv) {
    const currentLetterSpan = currentWordDiv.children[game.currentLetterIndex];

    if (currentLetterSpan) {
      currentLetterSpan.classList.add("current");
    } else {
      currentWordDiv.classList.add("current-word-end");
    }

    let firstWordTop = wordDivs[0].offsetTop;
    const spacer = document.getElementById("word-spacer");
    if (spacer) {
      firstWordTop -= spacer.offsetHeight;
    }

    const currentTop = currentWordDiv.offsetTop;
    const targetTranslate = -(currentTop - firstWordTop) + 100;

    if (instant) {
      gameArea.style.transition = "none";
    } else {
      gameArea.style.transition =
        "transform 0.1s cubic-bezier(0, 0.9, 0.15, 1)";
    }
    gameArea.style.transform = `translateY(${targetTranslate}px)`;
  }
}

export function updateZenCursor() {
  const cursor = wordsContainer.querySelector(".zen-cursor");
  if (!cursor) return;

  const currentTop = cursor.offsetTop;

  const targetTranslate = -(currentTop - game.zenBaseTop) + 100;

  gameArea.style.transition = "transform 0.1s cubic-bezier(0, 0.9, 0.15, 1)";
  gameArea.style.transform = `translateY(${targetTranslate}px)`;
}

export function handleZenInput(e) {
  if (e.isComposing || e.key === "Dead") return;

  if (e.key === "Tab") {
    e.preventDefault();
    initGame();
    return;
  }

  if (["Shift", "Control", "Alt", "CapsLock", "Meta"].includes(e.key)) return;

  if (!game.isGameActive) {
    game.isGameActive = true;
    if (audio.soundEnabled) initAudio();
    if (config.gameMode === "time") startTimer();
  }

  const cursor = wordsContainer.querySelector(".zen-cursor");
  if (!cursor) return;

  if (e.key === "Backspace") {
    const prev = cursor.previousSibling;
    if (prev) {
      if (prev.nodeType === Node.TEXT_NODE) {
        if (prev.textContent.length > 0) {
          prev.textContent = prev.textContent.slice(0, -1);
        }
        if (prev.textContent.length === 0) prev.remove();
      } else {
        prev.remove();
      }
    }
    updateZenCursor();
    return;
  }

  if (e.key === "Enter") {
    e.preventDefault();
    playSound("click");
    const br = document.createElement("br");
    wordsContainer.insertBefore(br, cursor);
    updateZenCursor();
    return;
  }

  const zenKey = e.key.normalize("NFC");
  if (zenKey.length === 1) {
    e.preventDefault();
    playSound("click");

    const prev = cursor.previousSibling;
    if (prev && prev.nodeType === Node.TEXT_NODE) {
      prev.textContent += zenKey;
    } else {
      const text = document.createTextNode(zenKey);
      wordsContainer.insertBefore(text, cursor);
    }
    updateZenCursor();
  }
}

/** Handle composed characters from dead keys (fallback when hidden input not focused) */
function handleCompositionEnd(e) {
  // Skip if hidden input is focused — its input event handles composed chars
  if (mobileInput && document.activeElement === mobileInput) return;
  if (e.data) {
    for (const char of e.data) {
      handleKeydown({ key: char, preventDefault: () => {} });
    }
  }
}

export function handleKeydown(e) {
  if (ui.currentView !== "game") return;

  if (config.zenModeEnabled) {
    handleZenInput(e);
    return;
  }

  if (game.isGameFinished) {
    if (e.key === "Tab" || e.key === "Enter") {
      e.preventDefault();
      initGame();
    }
    return;
  }

  if (e.isComposing || e.key === "Dead") return;
  if (["Shift", "Control", "Alt", "CapsLock"].includes(e.key)) return;

  if (e.key === "Tab") {
    e.preventDefault();
    initGame();
    return;
  }

  if (!game.isGameActive) {
    const isStartKey = e.key.length === 1 || e.key === " ";
    if (!isStartKey) return;

    game.isGameActive = true;
    document.body.classList.add("focus-mode");
    game.startTime = Date.now();
    if (audio.soundEnabled) initAudio();
    if (config.gameMode === "time") startTimer();

    userStats.started++;
    saveUserStats();
  }

  const typebars = document.querySelector(".typebars-inner");
  if (typebars) {
    typebars.classList.remove("active");
    void typebars.offsetWidth;
    typebars.classList.add("active");
  }

  const currentWord = game.currentWords[game.currentWordIndex];
  const wordDivs = wordsContainer.querySelectorAll(".word");
  const currentWordDiv = wordDivs[game.currentWordIndex];
  const currentLetterSpan = currentWordDiv.children[game.currentLetterIndex];

  if (e.key === "Backspace") {
    if (game.currentLetterIndex > 0) {
      game.currentLetterIndex--;
      const letter = currentWordDiv.children[game.currentLetterIndex];
      if (game.currentLetterIndex >= currentWord.length) {
        letter.remove();
      } else {
        letter.classList.remove("correct", "incorrect");
      }
    } else if (game.currentWordIndex > 0 && game.currentLetterIndex === 0) {
      game.currentWordIndex--;
      const prevWordDiv = wordDivs[game.currentWordIndex];
      game.currentLetterIndex = prevWordDiv.children.length;
    }
    updateCursor();
    return;
  }

  if (e.key === " ") {
    e.preventDefault();
    if (game.currentWordIndex < game.currentWords.length - 1) {
      game.totalChars++;

      let skippedErrors = 0;
      for (let i = game.currentLetterIndex; i < currentWord.length; i++) {
        const letter = currentWordDiv.children[i];
        letter.classList.add("incorrect");
        game.errorCount++;
        skippedErrors++;

        const char = currentWord[i];
        if (!stats.charStats[char]) {
          stats.charStats[char] = { total: 0, errors: 0 };
        }
        stats.charStats[char].total++;
        stats.charStats[char].errors++;

        if (!currentGameCharStats[char]) {
          currentGameCharStats[char] = 0;
        }
        currentGameCharStats[char]++;
      }

      if (skippedErrors > 0) {
        playSound("error");

        if (config.suddenDeathEnabled) {
          finishGame();
          return;
        }
      } else {
        playSound("click");
        game.correctChars++;
      }

      game.currentWordIndex++;
      game.currentLetterIndex = 0;

      let instantUpdate = false;

      if (data.wordCount === "infinite" || config.gameMode === "time") {
        if (game.currentWords.length - game.currentWordIndex < 50) {
          const newWords = generateWords();
          game.currentWords = game.currentWords.concat(newWords);
          renderWords(true);
        }

        const bufferBehind = 80;
        if (game.currentWordIndex > bufferBehind) {
          const wordDivs = wordsContainer.querySelectorAll(".word");
          const cutIndex = game.currentWordIndex - bufferBehind;

          let safeCutIndex = -1;
          for (let i = cutIndex; i > Math.max(0, cutIndex - 20); i--) {
            const w1 = wordDivs[i];
            const w2 = wordDivs[i + 1];
            if (w1 && w2 && w1.offsetTop < w2.offsetTop) {
              safeCutIndex = i;
              break;
            }
          }

          if (safeCutIndex !== -1) {
            const firstKeptWord = wordDivs[safeCutIndex + 1];
            const wordsContainerTop = wordsContainer.offsetTop;
            const rawTop = firstKeptWord.offsetTop - wordsContainerTop;

            const style = window.getComputedStyle(wordsContainer);
            const lineHeight = parseFloat(style.lineHeight) || 1;
            const lines = Math.round(rawTop / lineHeight);
            const newSpacerHeight = lines * lineHeight;

            let spacer = document.getElementById("word-spacer");
            if (!spacer) {
              spacer = document.createElement("div");
              spacer.id = "word-spacer";
              spacer.style.width = "100%";
              spacer.style.display = "block";
              wordsContainer.insertBefore(spacer, wordsContainer.firstChild);
            }

            spacer.style.height = `${newSpacerHeight}px`;

            for (let i = 0; i <= safeCutIndex; i++) {
              wordDivs[i].remove();
            }

            const wordsToRemoveCount = safeCutIndex + 1;
            game.currentWords.splice(0, wordsToRemoveCount);
            game.currentWordIndex -= wordsToRemoveCount;
            instantUpdate = true;
          }
        }
      }

      updateCursor(instantUpdate);
    } else if (game.currentWordIndex === game.currentWords.length - 1) {
      if (config.gameMode !== "time") {
        game.isGameFinished = true;
        finishGame();
      }
    }
    return;
  }

  // Normalize to NFC to handle dead key compositions on Linux
  const typedKey = e.key.normalize("NFC");

  if (typedKey.length === 1) {
    if (game.currentLetterIndex < currentWord.length) {
      const expectedChar =
        currentWord[game.currentLetterIndex].normalize("NFC");

      if (!stats.charStats[expectedChar]) {
        stats.charStats[expectedChar] = { total: 0, errors: 0 };
      }
      stats.charStats[expectedChar].total++;

      if (typedKey === expectedChar) {
        currentLetterSpan.classList.add("correct");
        game.correctChars++;
        playSound("click");
      } else {
        currentLetterSpan.classList.add("incorrect");
        game.errorCount++;
        playSound("error");

        stats.charStats[expectedChar].errors++;

        if (!currentGameCharStats[expectedChar]) {
          currentGameCharStats[expectedChar] = 0;
        }
        currentGameCharStats[expectedChar]++;

        if (config.suddenDeathEnabled) {
          finishGame();
          return;
        }
      }
    } else {
      const extraSpan = document.createElement("span");
      extraSpan.className = "letter incorrect extra";
      extraSpan.textContent = typedKey;
      currentWordDiv.appendChild(extraSpan);

      game.errorCount++;
      playSound("error");

      if (config.suddenDeathEnabled) {
        finishGame();
        return;
      }
    }

    game.totalChars++;
    game.currentLetterIndex++;

    updateCursor();

    if (
      game.currentWordIndex === game.currentWords.length - 1 &&
      game.currentLetterIndex === currentWord.length
    ) {
      if (data.wordCount === "infinite") {
        const newWords = generateWords();
        game.currentWords = game.currentWords.concat(newWords);
        renderWords(true);
      } else {
        finishGame();
      }
    }
  }
}

/**
 * Finish the game and display results
 */
export function finishGame() {
  game.isGameFinished = true;
  document.body.classList.remove("focus-mode");

  // Save character statistics
  saveCharStats();

  // Calculate results
  const endTime = Date.now();
  const timeInMinutes = (endTime - game.startTime) / 60000;

  // Prevent division by zero
  const netWPM =
    timeInMinutes > 0
      ? Math.round((game.totalChars - game.errorCount) / 5 / timeInMinutes)
      : 0;

  const totalProcessed = game.correctChars + game.errorCount;
  const accuracy =
    totalProcessed > 0
      ? Math.round((game.correctChars / totalProcessed) * 100)
      : 0;

  // Update user statistics
  userStats.completed++;
  userStats.time += Math.round((endTime - game.startTime) / 1000);

  // Check for new record
  const isNewRecord = checkAndSaveRecord(
    data.wordCount,
    Math.max(0, netWPM),
    accuracy,
  );

  saveUserStats();

  // Display results
  wpmEl.textContent = Math.max(0, netWPM);
  accEl.textContent = accuracy + "%";
  errorsEl.textContent = game.errorCount;

  // Show weak keys from this session
  const sortedWeakKeys = Object.entries(currentGameCharStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map((k) => k[0])
    .join(" ");

  weakKeysEl.textContent = sortedWeakKeys || t("results.none");

  // Show results UI
  statsContainer.classList.remove("hidden");
  document.getElementById("restart-note").classList.remove("hidden");
  restartBtn.classList.remove("hidden");

  // Show new record toast if applicable
  if (isNewRecord && netWPM > 0) {
    setTimeout(() => {
      showToast(
        t("toast.newRecord") || "🎉 New personal record!",
        "success",
        4000,
      );
    }, 500);
  }

  restartBtn.focus();
}

/**
 * Set up restart button event listeners
 */
export function restartGame() {
  if (!restartBtn) return;

  restartBtn.addEventListener("click", () => initGame());
  restartBtn.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      initGame();
    }
    // Prevent space from scrolling
    if (e.key === " ") {
      e.preventDefault();
    }
  });
}

// CapsLock Detection
export function checkCapsLockState(e) {
  const capsWarning = document.getElementById("caps-warning");
  if (!capsWarning) return;

  // We only care if we are in game view
  if (ui.currentView !== "game") {
    capsWarning.classList.add("hidden");
    return;
  }

  if (!e.getModifierState) return;

  // Ignore keyup of CapsLock to avoid double-processing
  if (e.key === "CapsLock" && e.type === "keyup") return;

  let isCapsOn = e.getModifierState("CapsLock");

  // On keydown of CapsLock, getModifierState returns the OLD state (pre-toggle).
  // Invert it to reflect the actual new state.
  if (e.key === "CapsLock") isCapsOn = !isCapsOn;

  capsWarning.classList.toggle("hidden", !isCapsOn);
}

window.addEventListener("keydown", checkCapsLockState, true);
window.addEventListener("keyup", checkCapsLockState, true);
window.addEventListener("mousedown", checkCapsLockState, true);
