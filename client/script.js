const form = document.getElementById('chat-form');
const chatContainer = document.querySelector('#chat_container');
let history = [];

try {
  const storedHistory = localStorage.getItem('history');
  if (storedHistory) {
    history = JSON.parse(storedHistory);
    for (const message of history) {
      const isAi = message.startsWith('AI:');
      const value = message.substring(4);
      chatContainer.innerHTML += chatStripe(isAi, value);
    }
  }
} catch (error) {
  console.error(error);
}

let loadInterval;

function loader(element) {
  element.textContent = '';
  loadInterval = setInterval(() => {
    element.textContent += '.';
    if (element.textContent === '....') {
      element.textContent = '';
    }
  }, 300);
}

function typeText(element, text) {
  let index = 0;
  let interval = setInterval(() => {
    if (index < text.length) {
      element.innerHTML += text.charAt(index);
      index++;
    } else {
      clearInterval(interval);
    }
  }, 1);
}

function generateUniqueId() {
  const timestamp = Date.now();
  const randomNumber = Math.random();
  const hexadecimalString = randomNumber.toString(16);
  return `id-${timestamp}-${hexadecimalString}`;
}

function chatStripe(
  isAi,
  value,
  uniqueId,
  isConversationListItem = false
) {
  const aiClass = isAi ? 'ai' : '';
  const listItemClass = isConversationListItem
    ? 'conversation-list-item'
    : '';

  return `
    <div class="wrapper ${aiClass} ${listItemClass}">
      <div class="chat">
        <div class="profile">
          <img
            src=${isAi ? './assets/bot.svg' : './assets/user.svg'}
            alt="${isAi ? 'bot' : 'user'}"
          />
        </div>
        <div class="message" id=${uniqueId}>${value}</div>
      </div>
    </div>
  `;
}

function renderConversationList() {
  const conversationList = document.getElementById('conversation-list');
  conversationList.innerHTML = '';
  for (const message of history) {
    const isAi = message.startsWith('AI:');
    const value = message.substring(4);
    conversationList.innerHTML += chatStripe(
      isAi,
      value,
      null,
      true
    );
  }
}




const handleSubmit = async (e) => {
  e.preventDefault();

  const data = new FormData(form);
  const userPrompt = data.get('prompt');

  // Add the user's message to the history array
  history.push(`User: ${userPrompt}`);

  // user's chatStripe
  chatContainer.innerHTML += chatStripe(false, userPrompt);

  form.reset();

  // bot's chatStripe
  const uniqueId = generateUniqueId();
  chatContainer.innerHTML += chatStripe(true, '', uniqueId);

  chatContainer.scrollTop = chatContainer.scrollHeight;

  const messageDiv = document.getElementById(uniqueId);

  loader(messageDiv);

  const response = await fetch('https://chat-cbd.onrender.com/', {

    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt: userPrompt,
      history: history
    })
  });

  clearInterval(loadInterval);
  messageDiv.innerHTML = '';

  if (response.ok) {
    const data = await response.json();
    const parsedData = data.bot.trim();

    // Add the bot's response to the history array
    history.push(`AI: ${parsedData}`);

    typeText(messageDiv, parsedData);
    // Update the conversation list

  }

  try {
    localStorage.setItem('history', JSON.stringify(history));
  } catch (error) {
    console.error(error);
  }


}



form.onsubmit = handleSubmit;

const promptInput = document.querySelector('textarea[name="prompt"]');

promptInput.addEventListener('keydown', (e) => {
  if (e.keyCode === 13) {
    handleSubmit(e);
  }
});



const clearHistoryBtn = document.getElementById('clear-history-btn');

clearHistoryBtn.addEventListener('click', () => {
  history = [];
  try {
    localStorage.removeItem('history');
  } catch (error) {
    console.error(error);
  }
  chatContainer.innerHTML = '';
  renderConversationList();
});


