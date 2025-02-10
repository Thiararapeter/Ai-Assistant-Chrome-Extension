// This import only work for service worker and web work. If script have dom dependency it will not work
importScripts("menus.js");
importScripts("contextMenuManager.js");

// Instantiate and initialize context menus
const menuManager = new ContextMenuManager(MENUS);

// When the Chrome extension is installed
chrome.runtime.onInstalled.addListener(() => {
  // Dynamically generate a unique rule ID
  const uniqueRuleId = Math.floor(Date.now() % 1000000);

  /*
   * Chrome sends its origin with a chrome ID in any POST API call, but it was not accepted by Ollama.
   * Therefore, this code will forcefully add the origin of the Ollama default port!
   */
  chrome.declarativeNetRequest.updateDynamicRules({
    addRules: [
      {
        id: uniqueRuleId,
        priority: 1,
        action: {
          type: "modifyHeaders",
          requestHeaders: [
            {
              header: "Origin",
              operation: "set", // Use 'set' operation to replace the value
              value: "http://127.0.0.1", // The new origin value
            },
          ],
        },
        condition: {
          urlFilter: "http://127.0.0.1:11434/*", // The API URL you want to target
          resourceTypes: ["main_frame", "xmlhttprequest"], // You can target specific types of requests
        },
      },
    ],
    removeRuleIds: [], // No rules to remove initially
  });

  // Set all the menus in the storage
  chrome.storage.local.set({ MENUS: MENUS }, function () {});

  // Initialize menus when the extension is installed or updated
  menuManager.initializeMenus();
});

// Listen for messages from the content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "callOllamaApi") {
    callOllamaApi(request.payload, request.tags)
      .then((data) => {
        sendResponse({ success: true, data }); // Send success response
      })
      .catch((error) => {
        sendResponse({
          success: false,
          error: error.message || "Unknown error",
        }); // Send error response
      });

    return true; // Indicates that the response will be sent asynchronously
  }
});

// Function to call the Ollama API
function callOllamaApi(payload, tags) {
  // This will look into all the models
  if (tags) {
    return fetch("http://127.0.0.1:11434/api/tags", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((response) => {
        if (!response.ok) {
          // Handle HTTP errors (e.g., 4xx, 5xx)
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
      })
      .catch((error) => {
        // Handle network errors (e.g., CORS, server unreachable)
        throw new Error(`Network error: ${error.message}`);
      });
  }

  // This is for generate chat
  return fetch("http://127.0.0.1:11434/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
    .then((response) => {
      if (!response.ok) {
        // Handle HTTP errors (e.g., 4xx, 5xx)
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.json();
    })
    .catch((error) => {
      // Handle network errors (e.g., CORS, server unreachable)
      throw new Error(`Network error: ${error.message}`);
    });
}

// Listen for clicks on the context menu item
chrome.contextMenus.onClicked.addListener((info, tab) => {
  menuManager.handleMenuClick(info);
});
