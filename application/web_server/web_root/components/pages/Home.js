"use strict";
import { h, html, useState, useEffect, useMemo } from "../../bundle.js";
import { Icons, Button, Card } from "../Components.js";

function Home() {
  const [displayCards, setDisplayCards] = useState([]);
  const [devices, setDevices] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [wsStatus, setWsStatus] = useState("disconnected");
  const [newCardConfig, setNewCardConfig] = useState({
    t: "",
    di: "",
    ti: "",
    hi: "",
  });

  // Add loading and error states
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Add WebSocket ref to persist across renders
  const wsRef = { current: null };
  const reconnectTimeoutRef = { current: null };

  // WebSocket connection setup
  const connectWebSocket = () => {
    try {
      // Get the current port from the URL
      const currentPort =
        window.location.port ||
        (window.location.protocol === "https:" ? "443" : "80");
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${wsProtocol}//${window.location.hostname}:${currentPort}/websocket`;

      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log("WebSocket connected");
        setWsStatus("connected");
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "update") {
            setDisplayCards((prevCards) =>
              prevCards.map((card) => {
                const updatedCard = { ...card };
                let valueUpdated = false;

                // Check temperature node
                if (card.tn && card.tn.n === data.n) {
                  updatedCard.tn = {
                    ...card.tn,
                    v: data.v,
                  };
                  valueUpdated = true;
                }

                // Check humidity node
                if (card.hn && card.hn.n === data.n) {
                  updatedCard.hn = {
                    ...card.hn,
                    v: data.v,
                  };
                  valueUpdated = true;
                }

                // Update last update time if any value was updated
                if (valueUpdated) {
                  updatedCard.lastUpdate = new Date();
                }

                return updatedCard;
              })
            );
          }
        } catch (error) {
          console.error("Error processing WebSocket message:", error);
        }
      };

      wsRef.current.onclose = () => {
        console.log("WebSocket disconnected");
        setWsStatus("disconnected");
        // Attempt to reconnect after 5 seconds
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 5000);
      };

      wsRef.current.onerror = (error) => {
        console.error("WebSocket error:", error);
        setWsStatus("error");
      };
    } catch (error) {
      console.error("Error creating WebSocket connection:", error);
      setWsStatus("error");
    }
  };

  // Function to fetch devices list
  const fetchDevices = async () => {
    try {
      const response = await fetch("/api/devices/get", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch devices: ${response.statusText}`);
      }

      const data = await response.json();
      setDevices(data || []);
    } catch (error) {
      console.error("Error fetching devices:", error);
      setLoadError(error.message || "Failed to load devices");
      return false;
    }
    return true;
  };

  // Function to fetch card configurations
  const fetchCardConfigs = async () => {
    try {
      const response = await fetch("/api/home/get", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch card configurations: ${response.statusText}`
        );
      }

      const data = await response.json();
      setDisplayCards(data || []);
    } catch (error) {
      console.error("Error fetching card configurations:", error);
      setLoadError(error.message || "Failed to load card configurations");
      return false;
    }
    return true;
  };

  // Function to save card configurations
  const saveCardConfigs = async () => {
    if (displayCards.length === 0) {
      alert("No cards to save");
      return;
    }

    try {
      setIsSaving(true);
      setSaveError("");
      setSaveSuccess(false);

      // Validate card configurations before saving
      const invalidCards = displayCards.filter(
        (card) => !card.t || !card.dn || !card.tn || !card.hn
      );

      if (invalidCards.length > 0) {
        throw new Error("Some cards have invalid configurations");
      }

      const config = displayCards.map((card) => ({
        t: card.t,
        dn: card.dn,
        tn: {
          n: card.tn.n,
          a: card.tn.a,
          f: card.tn.f,
          dt: card.tn.dt,
          t: card.tn.t,
        },
        hn: {
          n: card.hn.n,
          a: card.hn.a,
          f: card.hn.f,
          dt: card.hn.dt,
          t: card.hn.t,
        },
      }));

      const response = await fetch("/api/home/set", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error(`Failed to save configuration: ${response.statusText}`);
      }

      // Call reboot API after successful save
      const rebootResponse = await fetch("/api/reboot/set", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!rebootResponse.ok) {
        throw new Error("Failed to reboot server");
      }

      // Set success state and show message
      setSaveSuccess(true);
      setIsSaving(false);

      // Show success message for 3 seconds
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);

      // Refresh page after 5 seconds to allow server to reboot
      setTimeout(() => {
        window.location.reload();
      }, 5000);
    } catch (error) {
      console.error("Error saving configuration:", error);
      setSaveError(error.message || "Failed to save configuration");
      setIsSaving(false);
    }
  };

  // Load initial data
  const loadInitialData = async () => {
    setIsLoading(true);
    setLoadError("");

    const devicesSuccess = await fetchDevices();
    const cardsSuccess = await fetchCardConfigs();

    if (!devicesSuccess || !cardsSuccess) {
      setLoadError("Failed to load some data. Please try again.");
    }

    setIsLoading(false);
  };

  // Initialize WebSocket connection and cleanup on unmount
  useEffect(() => {
    document.title = "SBIOT-Dashboard";
    connectWebSocket();
    loadInitialData();

    // Cleanup function
    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null; // Clear onclose handler before closing
        wsRef.current.close();
        console.log("WebSocket connection closed");
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  // Format time function
  const formatTime = (date) => {
    if (!date) return "Never";
    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 60) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleString();
  };

  // Add new function to handle initial Add Card button click
  const handleAddCardClick = () => {
    if (displayCards.length >= 200) {
      alert("Maximum limit of 200 cards reached. Cannot add more cards.");
      return;
    }
    setIsAddingCard(true);
  };

  const handleAddCard = () => {
    // Validate required fields
    if (
      !newCardConfig.t ||
      !newCardConfig.di ||
      !newCardConfig.ti ||
      !newCardConfig.hi
    ) {
      alert("Please fill in all required fields");
      return;
    }

    // Validate device and node selections
    if (!devices[parseInt(newCardConfig.di)]) {
      alert("Please select a valid device");
      return;
    }

    const device = devices[parseInt(newCardConfig.di)];
    if (
      !device.ns[parseInt(newCardConfig.ti)] ||
      !device.ns[parseInt(newCardConfig.hi)]
    ) {
      alert("Please select valid temperature and humidity nodes");
      return;
    }

    setDisplayCards((prev) => [
      ...prev,
      {
        t: newCardConfig.t,
        dn: device.n,
        tn: {
          n: device.ns[parseInt(newCardConfig.ti)].n,
          a: device.ns[parseInt(newCardConfig.ti)].a,
          f: device.ns[parseInt(newCardConfig.ti)].f,
          dt: device.ns[parseInt(newCardConfig.ti)].dt,
          t: device.ns[parseInt(newCardConfig.ti)].t,
          v: device.ns[parseInt(newCardConfig.ti)].value,
        },
        hn: {
          n: device.ns[parseInt(newCardConfig.hi)].n,
          a: device.ns[parseInt(newCardConfig.hi)].a,
          f: device.ns[parseInt(newCardConfig.hi)].f,
          dt: device.ns[parseInt(newCardConfig.hi)].dt,
          t: device.ns[parseInt(newCardConfig.hi)].t,
          v: device.ns[parseInt(newCardConfig.hi)].value,
        },
        lastUpdate: new Date(),
      },
    ]);
    setIsAddingCard(false);
    setNewCardConfig({
      t: "",
      di: "",
      ti: "",
      hi: "",
    });
  };

  const handleCancel = () => {
    setIsAddingCard(false);
    setNewCardConfig({
      t: "",
      di: "",
      ti: "",
      hi: "",
    });
  };

  const handleDeleteCard = (cardIndex) => {
    if (confirm("Are you sure you want to delete this card?")) {
      setDisplayCards((prev) => prev.filter((_, index) => index !== cardIndex));
    }
  };

  // Memoize filtered cards to prevent unnecessary recalculations
  const filteredCards = useMemo(
    () =>
      displayCards.filter((card) =>
        card.t.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [displayCards, searchQuery]
  );

  // Update the status indicator section
  const getStatusColor = () => {
    switch (wsStatus) {
      case "connected":
        return "bg-green-500";
      case "disconnected":
        return "bg-red-500";
      default:
        return "bg-yellow-500";
    }
  };

  const getStatusText = () => {
    switch (wsStatus) {
      case "connected":
        return "Connected";
      case "disconnected":
        return "Disconnected";
      default:
        return "Error";
    }
  };

  if (isLoading) {
    return html`
      <div class="p-6">
        <h1 class="text-2xl font-bold">Dashboard</h1>
        <div
          class="mt-6 bg-white rounded-lg shadow-md p-6 flex items-center justify-center"
        >
          <div class="flex items-center space-x-2">
            <${Icons.SpinnerIcon} className="h-5 w-5 text-blue-600" />
            <span class="text-gray-600">Loading dashboard data...</span>
          </div>
        </div>
      </div>
    `;
  }

  return html`
    <div class="p-6">
      ${loadError &&
      html`
        <div
          class="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded flex items-center justify-between"
        >
          <div>${loadError}</div>
          <button
            onClick=${loadInitialData}
            class="px-3 py-1 bg-red-200 hover:bg-red-300 rounded-md text-red-800 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            Retry
          </button>
        </div>
      `}
      ${saveError &&
      html`
        <div
          class="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded"
        >
          ${saveError}
        </div>
      `}
      ${saveSuccess &&
      html`
        <div
          class="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded"
        >
          Configuration saved successfully! System will reboot to apply
          changes...
        </div>
      `}

      <div class="flex justify-between items-center mb-6">
        <div class="flex items-center gap-4">
          <h1 class="text-2xl font-bold">Dashboard</h1>
          <div class="flex items-center gap-2">
            <div class="flex items-center">
              <div class="w-2 h-2 rounded-full ${getStatusColor()}"></div>
              <span class="ml-2 text-sm text-gray-600">${getStatusText()}</span>
            </div>
          </div>
        </div>
        <div class="flex items-center space-x-4">
          <span class="text-sm text-gray-500">
            Cards: ${displayCards.length}/200
          </span>
          <${Button}
            onClick=${handleAddCardClick}
            disabled=${displayCards.length >= 200 || isAddingCard}
            variant="primary"
            icon="PlusIcon"
          >
            Add Card
          <//>
        </div>
      </div>

      <!-- Search Box -->
      <div class="mb-6 flex items-center bg-white rounded-lg shadow-sm">
        <div class="relative flex-1">
          <div
            class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"
          >
            <${Icons.SearchIcon} className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            value=${searchQuery}
            onInput=${(e) => setSearchQuery(e.target.value)}
            placeholder="Search cards by title..."
            class="w-full pl-10 pr-4 py-2 border-none rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          ${searchQuery &&
          html`
            <button
              onClick=${() => setSearchQuery("")}
              class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
            >
              <${Icons.CloseIcon} className="h-5 w-5" />
            </button>
          `}
        </div>
        ${searchQuery &&
        html`
          <div class="px-4 py-2 text-sm text-gray-500">
            ${filteredCards.length}
            result${filteredCards.length !== 1 ? "s" : ""}
          </div>
        `}
      </div>

      ${isAddingCard &&
      html`
        <div class="mb-6 bg-white rounded-lg shadow-md p-6">
          <h2 class="text-lg font-semibold mb-4">Add New Display Card</h2>
          <form
            onSubmit=${(e) => {
              e.preventDefault();
              handleAddCard();
            }}
            class="space-y-4"
          >
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1"
                  >Title</label
                >
                <input
                  type="text"
                  value=${newCardConfig.t}
                  onInput=${(e) =>
                    setNewCardConfig({
                      ...newCardConfig,
                      t: e.target.value.slice(0, 20),
                    })}
                  maxlength="20"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter card title (max 20 chars)"
                  required
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1"
                  >Device</label
                >
                <select
                  value=${newCardConfig.di}
                  onInput=${(e) => {
                    setNewCardConfig({
                      ...newCardConfig,
                      di: e.target.value,
                      ti: "",
                      hi: "",
                    });
                  }}
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select device</option>
                  ${devices.map(
                    (device, index) => html`
                      <option value=${index}>${device.n} (${device.da})</option>
                    `
                  )}
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1"
                  >Temperature Node</label
                >
                <select
                  value=${newCardConfig.ti}
                  onInput=${(e) =>
                    setNewCardConfig({
                      ...newCardConfig,
                      ti: e.target.value,
                    })}
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled=${!newCardConfig.di}
                  required
                >
                  <option value="">Select temperature node</option>
                  ${newCardConfig.di !== "" &&
                  devices[newCardConfig.di].ns.map(
                    (node, index) => html`
                      <option value=${index}>
                        ${node.n} (${node.a}) - Current: ${node.value || "N/A"}
                      </option>
                    `
                  )}
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1"
                  >Humidity Node</label
                >
                <select
                  value=${newCardConfig.hi}
                  onInput=${(e) =>
                    setNewCardConfig({
                      ...newCardConfig,
                      hi: e.target.value,
                    })}
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled=${!newCardConfig.di}
                  required
                >
                  <option value="">Select humidity node</option>
                  ${newCardConfig.di !== "" &&
                  devices[newCardConfig.di].ns.map(
                    (node, index) => html`
                      <option value=${index}>
                        ${node.n} (${node.a}) - Current: ${node.value || "N/A"}
                      </option>
                    `
                  )}
                </select>
              </div>
            </div>
            <div class="flex justify-end space-x-3 mt-4">
              <button
                type="button"
                onClick=${handleCancel}
                class="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      `}
      ${displayCards.length > 0 &&
      html`
        <div class="grid grid-rows-[auto] grid-cols-4 gap-4">
          ${filteredCards.map(
            (card, index) => html`
              <${Card}
                key=${index}
                card=${card}
                onDelete=${() => handleDeleteCard(index)}
                onTitleUpdate=${(newTitle) => {
                  setDisplayCards((prev) =>
                    prev.map((c, i) =>
                      i === index ? { ...c, t: newTitle } : c
                    )
                  );
                }}
              />
              ${(index + 1) % 4 === 0 && index !== filteredCards.length - 1
                ? html`<div class="col-span-4"></div>`
                : ""}
            `
          )}
        </div>
      `}

      <!-- Save and Cancel Buttons -->
      <div
        class="mt-8 border-t border-gray-200 pt-6 pb-4 flex justify-end gap-4"
      >
        <${Button}
          onClick=${() => {
            if (confirm("Are you sure you want to discard all changes?")) {
              fetchCardConfigs();
            }
          }}
          variant="secondary"
          icon="CloseIcon"
          disabled=${isSaving}
        >
          Cancel
        <//>
        <${Button}
          onClick=${saveCardConfigs}
          disabled=${isSaving}
          loading=${isSaving}
          icon="SaveIcon"
        >
          ${isSaving ? "Saving..." : "Save Configuration"}
        <//>
      </div>
    </div>
  `;
}

export default Home;
