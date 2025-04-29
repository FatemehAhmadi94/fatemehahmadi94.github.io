// Global variables
let csvData = [];
let cards = [];
let results = [];
let removedCards = [];
let highlightDefinitions = [];

// Cache start button
const startButton = document.getElementById('startButton');
startButton.disabled = true;
startButton.textContent = 'Loading data...';

async function loadData() {
  if (window.location.protocol === 'file:') {
    alert(
      '⚠️ Please serve via HTTP (e.g., `python -m http.server`) so fetch() can load local files.'
    );
    startButton.textContent = 'Serve via HTTP';
    return;
  }

  try {
    const [csvRes, jsonRes] = await Promise.all([
      fetch('data/clean.csv'),
      fetch('data/highlights.json'),
    ]);
    if (!csvRes.ok) throw new Error(`CSV fetch failed: ${csvRes.status}`);
    if (!jsonRes.ok) throw new Error(`JSON fetch failed: ${jsonRes.status}`);

    const [csvText, jsonData] = await Promise.all([
      csvRes.text(),
      jsonRes.json(),
    ]);

    csvData = await new Promise((res, rej) => {
      Papa.parse(csvText, {
        header: true,
        dynamicTyping: true,
        complete: p => res(p.data),
        error: err => rej(err),
      });
    });

    // Get all highlights but select only 5 random ones
    const allHighlights = jsonData.highlights || jsonData;
    highlightDefinitions = selectRandomHighlights(allHighlights, 5);

    startButton.disabled = false;
    startButton.textContent = 'Start';
    startButton.addEventListener('click', startLabeling);
  } catch (err) {
    console.error(err);
    startButton.textContent = 'Data load error';
    alert('Error loading data: ' + err.message);
  }
}

// Function to randomly select N highlights and add sequential cardId
function selectRandomHighlights(highlights, count = 5) {
  // Make a copy of the array to avoid modifying the original
  const availableHighlights = [...highlights];
  const selectedHighlights = [];
  
  // Make sure we don't try to select more items than are available
  const selectionCount = Math.min(count, availableHighlights.length);
  
  // Select 'count' random items
  for (let i = 0; i < selectionCount; i++) {
    // Generate a random index
    const randomIndex = Math.floor(Math.random() * availableHighlights.length);
    
    // Get the randomly selected highlight and add cardId
    const highlight = availableHighlights[randomIndex];
    highlight.cardId = i; // Add sequential cardId
    
    // Add the highlight to our results
    selectedHighlights.push(highlight);
    
    // Remove the selected item to avoid duplicates
    availableHighlights.splice(randomIndex, 1);
  }
  
  return selectedHighlights;
}

document.addEventListener('DOMContentLoaded', loadData);

function startLabeling() {
  document.getElementById('startSection').style.display = 'none';
  document.getElementById('tinder').style.display = 'flex';

  highlightDefinitions.forEach((def, i) => {
    if (!def.name) def.name = 'Domain Fold 2 – chesscom';
    cards.push({ id: i, data: csvData, highlight: def, name: def.name });
  });

  document.getElementById('progress-bar').max = cards.length;
  generateCards();
}

function generateCards() {
  const container = document.getElementById('tinder--cards');
  container.innerHTML = '';
  for (let i = 0; i < cards.length; i++) {
    container.appendChild(generateCard(cards[i]));
  }

  updateCards();
}

function generateCard(card) {
  const cardDiv = document.createElement('div');
  cardDiv.classList.add('tinder--card');
  //cardDiv.className = 'tinder--card';
  //cardDiv.id = 'card-' + card.id;
  cardDiv.id = `card-${card.id}`;
  cardDiv.innerHTML = `
    <div class="table-container">
      <div id="table-${card.id}" style="width:100%; height:100%;"></div>
    </div>
  `;
  setTimeout(() => initializeTable(card), 0);
  setTimeout(() => randomlyColorPills(cardDiv), 0);
  attachHammer(cardDiv);
  return cardDiv;
}

function initializeTable(card) {
  const el = document.getElementById('table-' + card.id);
  if (!csvData.length) return;

  const headers = Object.keys(csvData[0]);
  const rowIdx  = card.highlight.row;
  const colName = card.highlight.column;

  const cols = headers.map(h => ({
    title: h,
    field: h,
    formatter(cell) {
      const r = cell.getRow().getPosition();
      const c = cell.getColumn().getField();
      if (r === rowIdx && c === colName) {
        return `<div class="highlight-cell">${cell.getValue()}</div>`;
      }
      return cell.getValue();
    },
  }));

  const table = new Tabulator(el, {
    data: card.data,
    layout: 'fitColumns',
    height: '100%',
    columns: cols,
  });

  // Register event handler for when table rendering is complete
  table.on("renderComplete", function() {
    // This runs when the table has finished rendering
    setTimeout(() => {
      scrollToHighlightedCell(table, rowIdx, colName);
    }, 100);
  });
}

// Dedicated function to scroll to the highlighted cell with multiple approaches
function scrollToHighlightedCell(table, rowIdx, colName) {
  // Wait a bit to ensure the table is fully rendered and measured
  setTimeout(() => {
    try {
      // 1. Get the target row
      const rows = table.getRows();
      const targetRow = rows[rowIdx];
      if (!targetRow) {
        console.warn('Target row not found:', rowIdx);
        return;
      }

      // 2. First try Tabulator's built-in scrolling methods
      table.scrollToRow(targetRow, 'center')
        .then(() => table.scrollToColumn(colName, 'center'))
        .catch(e => console.warn('Tabulator scroll failed:', e));
    } catch (err) {
      console.error('Error scrolling to cell:', err);
    }
  }, 50);
}

function randomlyColorPills(cardDiv) {
  let pills = cardDiv.querySelectorAll('.pill');
  let highlighted = 0;
  pills.forEach(pill => {
    if (Math.random() < 0.3) {
      pill.style.backgroundColor = '#3b82f6';
      pill.style.color = '#fff';
      highlighted++;
    }
  });
  if (highlighted === 0 && pills.length) {
    const r = Math.floor(Math.random() * pills.length);
    pills[r].style.backgroundColor = '#3b82f6';
    pills[r].style.color = '#fff';
  }
}

function updateProgress() {
  const bar = document.getElementById('progress-bar');
  const text = document.getElementById('progress-text');
  bar.value = results.length;
  text.textContent = `${Math.round((results.length / bar.max) * 100)}%`;
}



function showResult() {
  document.getElementById('tinder').style.display = 'none';
  const correct = results.filter(r => r.userSwipe === r.correct).length;
  const name = cards[0]?.name || '';
  const res = document.getElementById('result');
  res.style.display = 'block';
  
  // Create table rows for each highlight
  let tableRows = '';
  highlightDefinitions.forEach((def, index) => {
    const resultItem = results.find(r => r.cardId === def.cardId);
    const isCorrect = resultItem ? resultItem.userSwipe === def.correct : false;
    const statusClass = isCorrect ? 'correct-answer' : 'wrong-answer';
    
    // Determine user's actual answer
    let userAnswer = 'No answer';
    if (resultItem) {
      // For errors (where correct=false in the data), user should say "Error" (right swipe)
      // For correct data (where correct=true), user should say "Valid" (right swipe)
      // The user's choice is represented by userSwipe (true = right/valid, false = left/error)
      const userSaidError = !resultItem.userSwipe;
      const userSaidValid = resultItem.userSwipe;
      
      if (def.correct) {
        // For genuinely valid data points
        userAnswer = userSaidValid ? "Correct ✓" : "Error ✗";
      } else {
        // For genuinely erroneous data points
        userAnswer = userSaidError ? "Error ✓" : "Correct ✗";
      }
    }
    
    tableRows += `
      <tr class="${statusClass}">
        <td>${index + 1}</td>
        <td>${def.column}</td>
        <td>${def.correctvalue || ''}</td>
        <td>${def.errourneousvalue || ''}</td>
        <td>${userAnswer}</td>
      </tr>
    `;
  });
  
  res.innerHTML = `
    <h3>You got ${correct} out of ${cards.length} correct!</h3>
    
    <div class="results-table-container">
      <table class="results-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Column</th>
            <th>Correct Value</th>
            <th>Erroneous Value</th>
            <th>Your Answer</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    </div>
    
    <button id="tryAgainBtn">Try Again</button>
  `;
  
  document.getElementById('tryAgainBtn').addEventListener('click', () => location.reload());
}

function recordSwipe(cardId, dir) {
  const def = highlightDefinitions.find(d => d.cardId === cardId);
  if (!def) return;
  results.push({ cardId, userSwipe: dir === 'right', correct: def.correct });
  updateProgress();
}

function getTopCard() {
  return document.querySelector('.tinder--card:not(.swiped)');
}

// **Updated** removeCard: defer updateCards() until after the transition
function removeCard(like) {
  const card = getTopCard();
  if (!card || card.classList.contains('animating')) return;
  card.classList.add('animating', 'swiped');

  const angle = like ? 15 : -15;
  // push it completely off‐screen
  card.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
  card.style.transform  = `translate(${like ? 150 : -150}vw, 0) rotate(${angle}deg)`;
  card.style.opacity    = '0';

  // record & queue
  const id = +card.id.split('-')[1];
  recordSwipe(id, like ? 'right' : 'left');
  removedCards.push({ card, like });

  card.addEventListener('transitionend', () => {
    card.classList.remove('animating');
    updateCards();
    if (results.length === cards.length) showResult();
  }, { once: true });
}




function updateCards() {
  document
    .querySelectorAll('.tinder--card:not(.swiped)')
    .forEach((c, i, a) => {
      c.style.zIndex = 100 + (a.length - i);
      c.style.transform = '';
      c.style.opacity = '1';
    });
}

function attachHammer(el) {
  const hammer = new Hammer(el);
  hammer.on('pan', e => {
    el.style.zIndex = 1000;
    el.classList.add('moving');
    if (!e.deltaX) return;
    const xMulti = e.deltaX * 0.03;
    const yMulti = e.deltaY / 80;
    const rotate = xMulti * yMulti;
    el.style.transform = `translate(${e.deltaX}px, ${e.deltaY}px) rotate(${rotate}deg)`;
  });
  hammer.on('panend', e => {
    el.classList.remove('moving');
    const moveOutWidth = document.body.clientWidth;
    const keep = Math.abs(e.deltaX) < 80 || Math.abs(e.velocityX) < 0.5;

    if (!keep) {
      removeCard(e.deltaX > 0);
    } else {
      // reset position & then re-stack all cards
      el.style.transition = 'transform 0.3s, z-index 0s 0.3s';
      el.style.transform = '';
      el.addEventListener('transitionend', () => {
        updateCards();
      }, { once: true });
    }
  });
}

// Button controls
document.querySelector('.btn-no').addEventListener('click', () => removeCard(false));
document.querySelector('.btn-yes').addEventListener('click', () => removeCard(true));
// document.querySelector('.btn-back').addEventListener('click', () => {
//   if (!removedCards.length) return alert('No swiped card to undo.');

//   const { card, like } = removedCards.pop();
//   // cancel any “swiped” status so updateCards will include it
//   card.classList.remove('swiped');

//   // jump it off-screen in the same direction
//   const angle = like ? 15 : -15;
//   card.style.transition = 'none';
//   card.style.transform  = `translate(${like ? 150 : -150}vw, 0) rotate(${angle}deg)`;
//   card.style.opacity    = '0';
//   void card.offsetWidth; // force layout

//   // then animate it back into view with its table intact
//   card.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
//   card.style.transform  = '';
//   card.style.opacity    = '1';

//   // rollback the recorded swipe and update UI
//   const id = +card.id.split('-')[1];
//   results = results.filter(r => r.cardId !== id);
//   updateProgress();
//   updateCards();
// });
