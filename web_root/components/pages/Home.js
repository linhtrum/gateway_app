"use strict";
import { h, html, useState, useEffect, useMemo } from "../../bundle.js";
import { Icons, Button, Card } from "../Components.js";

function CardModal({
  isOpen,
  onClose,
  onSubmit,
  card = null,
  isEditing = false,
  devices = [],
}) {
  const [formData, setFormData] = useState({
    t: card?.t || "",
    di: card?.di || "",
    ti: card?.ti || "",
    hi: card?.hi || "",
  });

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (isEditing && card) {
        // Find the device index that matches the card's device name
        const deviceIndex = devices.findIndex((device) => device.n === card.dn);

        // If device is found, find the node indices for temperature and humidity
        if (deviceIndex !== -1) {
          const device = devices[deviceIndex];
          const tempNodeIndex = device.ns.findIndex(
            (node) => node.n === card.tn.n
          );
          const humidNodeIndex = device.ns.findIndex(
            (node) => node.n === card.hn.n
          );

          setFormData({
            t: card.t,
            di: deviceIndex.toString(),
            ti: tempNodeIndex.toString(),
            hi: humidNodeIndex.toString(),
          });
        } else {
          // If device not found, reset to empty values
          setFormData({
            t: card.t,
            di: "",
            ti: "",
            hi: "",
          });
        }
      } else {
        // For new cards, reset to empty values
        setFormData({
          t: "",
          di: "",
          ti: "",
          hi: "",
        });
      }
    }
  }, [isOpen, card, isEditing, devices]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let error = null;

    // Handle device selection
    if (name === "di") {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
        ti: "", // Reset temperature node selection
        hi: "", // Reset humidity node selection
      }));
      return;
    }

    // Validate title
    if (name === "t") {
      if (!value || value.trim().length === 0) {
        error = "Title cannot be empty";
      } else if (value.length > 20) {
        error = "Title must not exceed 20 characters";
      }
    }

    if (error) {
      alert(error);
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validate required fields
    if (!formData.t || !formData.di || !formData.ti || !formData.hi) {
      alert("Please fill in all required fields");
      return;
    }

    // Validate device and node selections
    if (!devices[parseInt(formData.di)]) {
      alert("Please select a valid device");
      return;
    }

    const device = devices[parseInt(formData.di)];
    if (
      !device.ns[parseInt(formData.ti)] ||
      !device.ns[parseInt(formData.hi)]
    ) {
      alert("Please select valid temperature and humidity nodes");
      return;
    }

    // Prepare the card data
    const cardData = {
      t: formData.t,
      dn: device.n,
      tn: {
        n: device.ns[parseInt(formData.ti)].n,
        a: device.ns[parseInt(formData.ti)].a,
        f: device.ns[parseInt(formData.ti)].f,
        dt: device.ns[parseInt(formData.ti)].dt,
        t: device.ns[parseInt(formData.ti)].t,
        v: device.ns[parseInt(formData.ti)].value,
      },
      hn: {
        n: device.ns[parseInt(formData.hi)].n,
        a: device.ns[parseInt(formData.hi)].a,
        f: device.ns[parseInt(formData.hi)].f,
        dt: device.ns[parseInt(formData.hi)].dt,
        t: device.ns[parseInt(formData.hi)].t,
        v: device.ns[parseInt(formData.hi)].value,
      },
    };

    onSubmit(cardData);
  };

  if (!isOpen) return null;

  return html`
    <div
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    >
      <div
        class="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] flex flex-col"
      >
        <div class="px-6 py-4 border-b border-gray-200">
          <h3 class="text-lg font-medium text-gray-900">
            ${isEditing ? "Edit Card" : "Add New Card"}
          </h3>
        </div>
        <form onSubmit=${handleSubmit} class="flex-1 overflow-y-auto">
          <div class="px-6 py-4 space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Title<span class="text-red-500">*</span>
                <span class="text-xs text-gray-500 ml-1">(max 20 chars)</span>
              </label>
              <input
                type="text"
                name="t"
                value=${formData.t}
                onChange=${handleInputChange}
                maxlength="20"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter card title"
                required
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Device<span class="text-red-500">*</span>
              </label>
              <select
                name="di"
                value=${formData.di}
                onChange=${handleInputChange}
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
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Temperature Node<span class="text-red-500">*</span>
              </label>
              <select
                name="ti"
                value=${formData.ti}
                onChange=${handleInputChange}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled=${!formData.di}
                required
              >
                <option value="">Select temperature node</option>
                ${formData.di !== "" &&
                devices[formData.di].ns.map(
                  (node, index) => html`
                    <option value=${index}>
                      ${node.n} (${node.a}) - Current: ${node.value || "N/A"}
                    </option>
                  `
                )}
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Humidity Node<span class="text-red-500">*</span>
              </label>
              <select
                name="hi"
                value=${formData.hi}
                onChange=${handleInputChange}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled=${!formData.di}
                required
              >
                <option value="">Select humidity node</option>
                ${formData.di !== "" &&
                devices[formData.di].ns.map(
                  (node, index) => html`
                    <option value=${index}>
                      ${node.n} (${node.a}) - Current: ${node.value || "N/A"}
                    </option>
                  `
                )}
              </select>
            </div>
          </div>
          <div class="px-6 py-4 bg-gray-50 flex justify-end space-x-3">
            <button
              type="button"
              onClick=${onClose}
              class="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              ${isEditing ? "Save" : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function Home() {
  const [displayCards, setDisplayCards] = useState([]);
  const [devices, setDevices] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [wsStatus, setWsStatus] = useState("disconnected");

  // Add loading and error states
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Add WebSocket ref to persist across renders
  const wsRef = { current: null };
  const reconnectTimeoutRef = { current: null };

  // Add new state for editing card
  const [editingCardIndex, setEditingCardIndex] = useState(null);

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

  const fetchConfig = async () => {
    try {
      setIsLoading(true);
      setLoadError("");

      const [devicesResponse, cardsResponse] = await Promise.all([
        fetch("/api/devices/get", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }),
        fetch("/api/home/get", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }),
      ]);

      if (!devicesResponse.ok || !cardsResponse.ok) {
        throw new Error(
          `Failed to fetch devices or cards: ${devicesResponse.statusText} ${cardsResponse.statusText}`
        );
      }

      const [devicesData, cardsData] = await Promise.all([
        devicesResponse.json(),
        cardsResponse.json(),
      ]);

      setDevices(devicesData || []);
      setDisplayCards(cardsData || []);
    } catch (error) {
      console.error("Error fetching configuration:", error);
      setLoadError(error.message || "Failed to load configuration");
    } finally {
      setIsLoading(false);
    }
  };

  const saveConfig = async () => {
    try {
      setIsSaving(true);
      setSaveError("");
      setSaveSuccess(false);

      const cardsResponse = await Promise.all([
        fetch("/api/home/set", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(displayCards),
        }),
      ]);

      if (!cardsResponse.ok) {
        throw new Error(
          `Failed to save configuration: ${cardsResponse.statusText}`
        );
      }

      const rebootResponse = await fetch("/api/reboot/set", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!rebootResponse.ok) {
        throw new Error("Failed to reboot server");
      }

      setSaveSuccess(true);
      setIsSaving(false);

      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);

      setTimeout(() => {
        window.location.reload();
      }, 5000);
    } catch (error) {
      console.error("Error saving configuration:", error);
      setSaveError(error.message || "Failed to save configuration");
      setIsSaving(false);
    }
  };

   // Initialize WebSocket connection and cleanup on unmount
  useEffect(() => {
    document.title = "SBIOT-Dashboard";
    fetchConfig();
    connectWebSocket();

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
    setEditingCardIndex(null);
    setIsModalOpen(true);
  };

  const handleCardSubmit = (formData) => {
    if (editingCardIndex !== null) {
      // Editing existing card
      setDisplayCards((prev) =>
        prev.map((card, index) =>
          index === editingCardIndex ? { ...card, ...formData } : card
        )
      );
    } else {
      // Adding new card
      setDisplayCards((prev) => [
        ...prev,
        {
          ...formData,
          lastUpdate: new Date(),
        },
      ]);
    }
    setIsModalOpen(false);
    setEditingCardIndex(null);
  };

  // Add new function to handle edit card
  const handleEditCard = (cardIndex) => {
    setEditingCardIndex(cardIndex);
    setIsModalOpen(true);
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
  const getStatusIcon = () => {
    switch (wsStatus) {
      case "connected":
        return html`
          <svg
            class="w-4 h-4 text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M5 13l4 4L19 7"
            />
          </svg>
        `;
      case "disconnected":
        return html`
          <svg
            class="w-4 h-4 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        `;
      default:
        return html`
          <svg
            class="w-4 h-4 text-yellow-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        `;
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
            onClick=${fetchConfig}
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
              ${getStatusIcon()}
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
            disabled=${displayCards.length >= 200}
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

      ${displayCards.length > 0 &&
      html`
        <div class="grid grid-rows-[auto] grid-cols-4 gap-4">
          ${filteredCards.map(
            (card, index) => html`
              <${Card}
                key=${index}
                card=${card}
                onDelete=${() => handleDeleteCard(index)}
                onEdit=${() => handleEditCard(index)}
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
              fetchConfig();
            }
          }}
          variant="secondary"
          icon="CloseIcon"
          disabled=${isSaving}
        >
          Cancel
        <//>
        <${Button}
          onClick=${saveConfig}
          disabled=${isSaving}
          loading=${isSaving}
          icon="SaveIcon"
        >
          ${isSaving ? "Saving..." : "Save Configuration"}
        <//>
      </div>
      <!-- Card Modal -->
      <${CardModal}
        isOpen=${isModalOpen}
        onClose=${() => {
          setIsModalOpen(false);
          setEditingCardIndex(null);
        }}
        onSubmit=${handleCardSubmit}
        card=${editingCardIndex !== null
          ? displayCards[editingCardIndex]
          : null}
        isEditing=${editingCardIndex !== null}
        devices=${devices}
      />
    </div>
  `;
}

export default Home;
