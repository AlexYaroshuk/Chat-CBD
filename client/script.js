document.addEventListener("DOMContentLoaded", () => {
  const conversationList = document.getElementById("conversation-list");
  const clearHistoryBtn = document.getElementById("clear-chatHistory-btn");
  const confirmationModal = document.getElementById("confirmation-modal");
  const confirmClearHistoryBtn = document.getElementById(
    "confirm-clear-history"
  );
  const cancelClearHistoryBtn = document.getElementById("cancel-clear-history");

  const chatContainer = document.querySelector("#chat_container");
  const startMessage = document.getElementById("start-message");
  const drawerBtn = document.getElementById("drawer-btn");
  const overlay = document.getElementById("overlay");
  const sidebar = document.querySelector(".sidebar");

  const form = document.getElementById("chat-form");
  const promptInput = document.querySelector('textarea[name="prompt"]');
  const submitBtn = document.getElementById("submit-btn");

  promptInput.addEventListener("input", () => {
    if (promptInput.value.trim() === "") {
      submitBtn.disabled = true;
    } else {
      submitBtn.disabled = false;
    }
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    // your submit code here
  });

  function handlePromptInput() {
    if (promptInput.value.trim() === "") {
      submitBtn.disabled = true;
    } else {
      submitBtn.disabled = false;
    }
  }

  promptInput.addEventListener("input", handlePromptInput);

  drawerBtn.addEventListener("click", () => {
    sidebar.classList.add("active"); // Add the 'active' class to the sidebar
    overlay.style.display = "block"; // Show the overlay
  });

  overlay.addEventListener("click", () => {
    sidebar.classList.remove("active"); // Remove the 'active' class from the sidebar
    overlay.style.display = "none"; // Hide the overlay
  });

  let chatHistory = [];
  let conversations = [];

  let loadInterval;

  // Get activeConversation from local storage
  let activeConversation = localStorage.getItem("activeConversation");

  // Set the active conversation style

  function setActiveConversationStyle(conversationId) {
    document.querySelectorAll(".conversation-list-item").forEach((item) => {
      if (item.dataset.conversationId === conversationId) {
        item.classList.add("active");
      } else {
        item.classList.remove("active");
      }
    });

    const newChatBtn = document.getElementById("new-chat-btn");
    if (conversationId === null) {
      newChatBtn.classList.add("active");
    } else {
      newChatBtn.classList.remove("active");
    }

    // Add these lines to remove the 'active' class from the sidebar and hide the overlay
    sidebar.classList.remove("active");
    overlay.style.display = "none";
  }

  // ... other code

  // Add event listeners to conversation list items
  function addConversationClickEventListeners() {
    const items = document.querySelectorAll(".conversation-list-item");
    items.forEach((item) => {
      item.addEventListener("click", (event) => {
        event.preventDefault();
        setActiveConversationStyle(item.dataset.conversationId);
        localStorage.setItem("activeConversation", item.dataset.conversationId);

        // Your logic for loading conversation content goes here
      });
    });
  }

  function loadActiveConversation() {
    if (activeConversation) {
      const activeConvIndex = conversations.findIndex(
        (conv) => conv.id === activeConversation
      );
      if (activeConvIndex >= 0) {
        chatHistory = conversations[activeConvIndex].messages;
        renderChatHistory();
        updateStartMessageDisplay();
        setActiveConversationStyle(activeConversation);
      }
    }
  }

  try {
    const storedConversations = localStorage.getItem("conversations");
    if (storedConversations) {
      const storedActiveConversation =
        localStorage.getItem("activeConversation");
      if (storedActiveConversation) {
        activeConversation = storedActiveConversation;
      } else {
        activeConversation = null;
      }

      if (storedConversations) {
        conversations = JSON.parse(storedConversations);
        renderConversationList();
        setActiveConversationStyle(activeConversation);
        const activeConvIndex = conversations.findIndex(
          (conv) => conv.id === activeConversation
        );
        if (activeConvIndex >= 0) {
          chatHistory = conversations[activeConvIndex].messages;
          renderChatHistory();
          updateStartMessageDisplay();
        }
      }
    }
  } catch (error) {
    console.error(error);
  }

  function loader(element) {
    element.textContent = "";
    loadInterval = setInterval(() => {
      element.textContent += ".";
      if (element.textContent === "....") {
        element.textContent = "";
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
    isError = false,
    isConversationListItem = false
  ) {
    const aiClass = isAi ? "ai" : "";
    const errorClass = isError ? "error" : ""; // Add an error class if isError is true
    const listItemClass = isConversationListItem
      ? "conversation-list-item"
      : "";
    const icon = isConversationListItem
      ? `<i class="material-icons">chat_bubble_outline</i>`
      : "";

    return `
    <div class="wrapper ${aiClass} ${listItemClass}">
      <div class="chat">
        <div class="profile">
          <img
            src=${isAi ? "./assets/bot.svg" : "./assets/user.svg"}
            alt="${isAi ? "bot" : "user"}"
          />
        </div>
        <div class="message ${errorClass}" id=${uniqueId}>${icon}${value}</div> <!-- Add the error class here -->
      </div>
    </div>
  `;
  }

  function conversationListItem(value, uniqueId) {
    return `
    <div class="conversation-list-item" id=${uniqueId}>
      <i class="material-icons">chat_bubble_outline</i>
      ${value}
    </div>
  `;
  }

  function renderConversationList() {
    conversationList.innerHTML = "";

    if (conversations.length > 0) {
      conversations.forEach((conversation, index) => {
        const conversationTitle = conversation.messages[0]
          ? conversation.messages[0].substring(6)
          : "New Chat";
        const conversationItem = document.createElement("div");
        conversationItem.className = "conversation-list-item";
        conversationItem.id = `conversation-${conversation.id}`;
        conversationItem.innerHTML = `
        <i class="material-icons">chat_bubble_outline</i>
        <span class="text-content">${conversationTitle}</span>
      `;
        conversationItem.dataset.conversationId = conversation.id;

        conversationList.appendChild(conversationItem);

        if (conversation.id === activeConversation) {
          conversationItem.classList.add("active");
        } else {
          conversationItem.classList.remove("active");
        }

        conversationItem.addEventListener("click", () => {
          const conversationIndex = conversations.findIndex(
            (conv) => conv.id === conversation.id
          );
          activeConversation = conversation.id;
          chatHistory = conversations[conversationIndex].messages;
          chatContainer.innerHTML = "";
          renderChatHistory();
          updateStartMessageDisplay();
          setActiveConversationStyle(conversation.id);
        });
      });
    }

    if (conversations.length === 0) {
      clearHistoryBtn.style.display = "none";
    } else {
      clearHistoryBtn.style.display = "flex";
    }

    // Add this line to call the function to add event listeners
    addConversationClickEventListeners();
  }

  function handleNewChatBtnClick() {
    activeConversation = null;
    chatHistory = [];
    chatContainer.innerHTML = "";
    updateStartMessageDisplay();
    setActiveConversationStyle(null); // Pass null to highlight the new-chat-btn
  }

  const newChatBtn = document.getElementById("new-chat-btn");
  newChatBtn.addEventListener("click", handleNewChatBtnClick);

  function renderChatHistory() {
    chatContainer.innerHTML = "";
    for (const message of chatHistory) {
      const isAi = message.startsWith("AI:");
      const value = message.substring(4);
      chatContainer.innerHTML += chatStripe(isAi, value);
    }
  }

  function updateStartMessageDisplay() {
    if (activeConversation === null) {
      startMessage.style.display = "block";
      const newChatItem = document.querySelector(".new-chat-item");
      if (newChatItem) {
        newChatItem.classList.add("active");
      }
    } else {
      startMessage.style.display = "none";
      const newChatItem = document.querySelector(".new-chat-item");
      if (newChatItem) {
        newChatItem.classList.remove("active");
      }
    }
  }

  function updateLocalStorageAndRender() {
    localStorage.setItem("conversations", JSON.stringify(conversations));
    renderConversationList();
  }

  function fetchWithTimeout(url, options, timeout = 15000) {
    return Promise.race([
      fetch(url, options),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Request timed out")), timeout)
      ),
    ]);
  }

  function timeout(ms) {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request took too long")), ms)
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();

    const data = new FormData(form);
    const userPrompt = data.get("prompt");

    if (!userPrompt.trim()) {
      return; // Do nothing if input is empty or only contains whitespace
    }

    chatHistory.push(`User: ${userPrompt}`);
    chatContainer.innerHTML += chatStripe(false, userPrompt);

    if (activeConversation === null) {
      const newConversation = {
        id: generateUniqueId(),
        messages: chatHistory,
      };
      activeConversation = newConversation.id;
      conversations.push(newConversation);
      updateStartMessageDisplay();
      renderConversationList();
    }

    form.reset();
    localStorage.removeItem("activeConversation");

    const uniqueId = generateUniqueId();
    chatContainer.innerHTML += chatStripe(true, "", uniqueId);

    // Update the conversation list item with the icon
    const listItem = document.getElementById(
      `conversation-${activeConversation}`
    );
    if (listItem) {
      listItem.innerHTML = `
    <i class="material-icons">chat_bubble_outline</i>
    <span class="text-content">${userPrompt}</span>
  `;
    }

    chatContainer.scrollTop = chatContainer.scrollHeight;

    const messageDiv = document.getElementById(uniqueId);
    try {
      loader(messageDiv);

      const FETCH_TIMEOUT = 15000; // 10 seconds

      const response = await fetchWithTimeout(
        "https://chat-cbd.onrender.com",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: userPrompt,
            chatHistory: chatHistory,
          }),
        },
        FETCH_TIMEOUT
      );

      clearInterval(loadInterval);
      messageDiv.innerHTML = "";

      if (response.ok) {
        const data = await response.json();
        const parsedData = data.bot.trim();
        chatHistory.push(`AI: ${parsedData}`);
        typeText(messageDiv, parsedData);

        if (activeConversation === null) {
          const newConversation = {
            id: generateUniqueId(),
            messages: chatHistory,
          };
          activeConversation = newConversation.id;
          conversations.push(newConversation);
        } else {
          // Update the conversation list item with the icon
          const convIndex = conversations.findIndex(
            (conv) => conv.id === activeConversation
          );
          if (convIndex >= 0) {
            const listItem = document.getElementById(
              `conversation-${activeConversation}`
            );
            if (listItem) {
              const textContent = listItem.querySelector(".text-content");
              if (textContent) {
                textContent.textContent = userPrompt;
              } else {
                listItem.innerHTML = `
        <i class="material-icons">chat_bubble_outline</i>
        <span class="text-content">${userPrompt}</span>
      `;
              }
            }
          }
        }

        updateLocalStorageAndRender();
      } else {
        const errorMessage = "An error occurred. Please try again.";
        messageDiv.innerHTML = errorMessage;
        messageDiv.classList.add("error"); // Add the 'error' class to the message
        chatHistory.push(`AI: ${errorMessage}`);
      }
    } catch (error) {
      clearInterval(loadInterval);
      const errorMessage =
        error.message === "Request timed out"
          ? "Request timed out. Please try again."
          : "An error occurred. Please try again.";
      messageDiv.innerHTML = errorMessage;
      messageDiv.classList.add("error"); // Add the 'error' class to the message
      chatHistory.push(`AI: ${errorMessage}`);
    }
  };

  form.onsubmit = handleSubmit;

  promptInput.addEventListener("keydown", (e) => {
    if (e.keyCode === 13) {
      handleSubmit(e);
    }
  });

  clearHistoryBtn.addEventListener("click", () => {
    confirmationModal.style.display = "block";
  });

  confirmClearHistoryBtn.addEventListener("click", () => {
    conversations = [];
    activeConversation = null;
    chatHistory = [];
    localStorage.removeItem("conversations");
    chatContainer.innerHTML = "";
    renderConversationList();
    updateStartMessageDisplay();
    confirmationModal.style.display = "none";
  });

  cancelClearHistoryBtn.addEventListener("click", () => {
    confirmationModal.style.display = "none";
  });

  updateStartMessageDisplay();
  setActiveConversationStyle(activeConversation);
  loadActiveConversation();
});
