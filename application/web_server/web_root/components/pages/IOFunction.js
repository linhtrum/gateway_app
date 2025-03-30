"use strict";
import { h, html, useState, useEffect } from "../../bundle.js";
import { Icons, Button } from "../Components.js";

const TIMING_ACTIONS = [
  [0, "Restart"],
  [1, "DO Action"],
];

const TIMING_DO_ACTIONS = [
  [1, "DO1"],
  [2, "DO2"],
];

const TIMING_ACTION_TYPES = [
  [0, "Normal Open(NO)"],
  [2, "Normal Close(NC)"],
  [3, "Flip"],
];

const DO_FUNCTION_ACTIONS = [
  [0, "No Action"],
  [1, "Output Hold"],
  [2, "Timer Flip"],
];

function IOFunction() {
  // State management
  const [activeTab, setActiveTab] = useState("io-control");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  // IO Status state
  const [ioStatus, setIoStatus] = useState({
    do1: false,
    do2: false,
    di1: false,
    di2: false,
    ai1: 0,
    ai2: 0,
  });

  // IO Configuration state
  const [ioConfig, setIoConfig] = useState({
    slaveAddress: 1,
    timers: Array(6)
      .fill()
      .map(() => ({
        enabled: false,
        time: "00:00:00",
        action: 0,
        doAction: 1,
        doActionType: 0,
      })),
    restartHold: false,
    executeActionDO1: 0,
    executeActionDO2: 0,
    executeTimeDO1: 2,
    executeTimeDO2: 2,
    filterTime: 10,
  });

  // Fetch initial data
  const fetchData = async () => {
    try {
      setIsLoading(true);
      setLoadError("");

      const [ioStatusResponse, ioConfigResponse] = await Promise.all([
        fetch("/api/io/status", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }),
        fetch("/api/io/config", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }),
      ]);

      if (!ioStatusResponse.ok || !ioConfigResponse.ok) {
        throw new Error("Failed to fetch IO data");
      }

      const [ioStatusData, ioConfigData] = await Promise.all([
        ioStatusResponse.json(),
        ioConfigResponse.json(),
      ]);

      // Update states with fetched data
      setIoStatus({
        do1: ioStatusData.do?.do1 || false,
        do2: ioStatusData.do?.do2 || false,
        di1: ioStatusData.di?.di1 || false,
        di2: ioStatusData.di?.di2 || false,
        ai1: ioStatusData.ai?.ai1 || 0,
        ai2: ioStatusData.ai?.ai2 || 0,
      });

      setIoConfig({
        slaveAddress: ioConfigData.slaveAddress || 1,
        timers: ioConfigData.timers || ioConfig.timers,
        restartHold: ioConfigData.restartHold || false,
        executeActionDO1: ioConfigData.executeActionDO1 || 0,
        executeActionDO2: ioConfigData.executeActionDO2 || 0,
        executeTimeDO1: ioConfigData.executeTimeDO1 || 2,
        executeTimeDO2: ioConfigData.executeTimeDO2 || 2,
        filterTime: ioConfigData.filterTime || 10,
      });
    } catch (error) {
      console.error("Error fetching IO data:", error);
      setLoadError(
        error.name === "AbortError"
          ? "Request timed out. Please try again."
          : error.message || "Failed to load IO data"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Save configuration
  const saveConfig = async () => {
    try {
      setIsSaving(true);
      setSaveError("");
      setSaveSuccess(false);

      const response = await fetch("/api/io/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(ioConfig),
      });

      if (!response.ok) {
        throw new Error("Failed to save IO configuration");
      }

      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (error) {
      console.error("Error saving IO configuration:", error);
      setSaveError(
        error.name === "AbortError"
          ? "Request timed out. Please try again."
          : error.message || "Failed to save configuration"
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Handle DO toggle
  const handleDoToggle = async (doNumber) => {
    try {
      const response = await fetch("/api/io/do/toggle", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ do: doNumber }),
      });

      if (!response.ok) {
        throw new Error("Failed to toggle DO");
      }

      setIoStatus((prev) => ({
        ...prev,
        [`do${doNumber}`]: !prev[`do${doNumber}`],
      }));
    } catch (error) {
      console.error("Error toggling DO:", error);
      alert("Failed to toggle DO");
    }
  };

  // Handle timer changes
  const handleTimerChange = (index, field, value) => {
    setIoConfig((prev) => ({
      ...prev,
      timers: prev.timers.map((timer, i) => {
        if (i === index) {
          if (field === "time") {
            return { ...timer, time: value || "00:00:00" };
          }
          return { ...timer, [field]: value };
        }
        return timer;
      }),
    }));
  };

  // Handle DO action changes
  const handleDoActionChange = (field, value) => {
    setIoConfig((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Parse time string to hours, minutes, seconds
  const parseTime = (timeStr) => {
    const [hours, minutes, seconds] = timeStr.split(":").map(Number);
    return { hours, minutes, seconds };
  };

  // Format time for display
  const formatTime = (hours, minutes, seconds) => {
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    document.title = "SBIOT-IO Function";
    fetchData();
  }, []);

  if (isLoading) {
    return html`
      <div class="p-6">
        <h1 class="text-2xl font-bold mb-6">IO Function</h1>
        <div class="flex items-center justify-center h-full">
          <${Icons.SpinnerIcon} className="h-8 w-8 text-blue-600" />
        </div>
      </div>
    `;
  }

  return html`
    <div class="p-6">
      <h1 class="text-2xl font-bold mb-6">IO Function</h1>

      ${loadError &&
      html`
        <div
          class="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded flex items-center justify-between"
        >
          <div>${loadError}</div>
          <button
            onClick=${fetchData}
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
          IO configuration saved successfully!
        </div>
      `}

      <!-- Tabs -->
      <div class="mb-6">
        <div class="border-b border-gray-200">
          <nav class="-mb-px flex space-x-8">
            <button
              onClick=${() => setActiveTab("io-control")}
              class=${`uppercase py-4 px-1 inline-flex items-center border-b-2 font-medium text-sm
                ${
                  activeTab === "io-control"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
            >
              IO Control
            </button>
            <button
              onClick=${() => setActiveTab("io-function")}
              class=${`uppercase py-4 px-1 inline-flex items-center border-b-2 font-medium text-sm
                ${
                  activeTab === "io-function"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
            >
              IO Function
            </button>
          </nav>
        </div>
      </div>

      ${activeTab === "io-control"
        ? html`
            <div class="max-w-[60%] mx-auto">
              <!-- IO Control Tab Content -->
              <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <!-- DO Status Panel -->
                <div class="bg-white rounded-lg shadow-md p-6">
                  <h2 class="text-lg font-semibold mb-4">DO Status</h2>
                  <div class="space-y-4">
                    <div class="flex items-center justify-between">
                      <span class="text-gray-700">DO1</span>
                      <button
                        onClick=${() => handleDoToggle(1)}
                        class=${`relative inline-flex h-6 w-11 items-center rounded-full ${
                          ioStatus.do1 ? "bg-blue-600" : "bg-gray-200"
                        }`}
                      >
                        <span
                          class=${`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                            ioStatus.do1 ? "translate-x-6" : "translate-x-1"
                          }`}
                        ></span>
                      </button>
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="text-gray-700">DO2</span>
                      <button
                        onClick=${() => handleDoToggle(2)}
                        class=${`relative inline-flex h-6 w-11 items-center rounded-full ${
                          ioStatus.do2 ? "bg-blue-600" : "bg-gray-200"
                        }`}
                      >
                        <span
                          class=${`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                            ioStatus.do2 ? "translate-x-6" : "translate-x-1"
                          }`}
                        ></span>
                      </button>
                    </div>
                  </div>
                </div>
                <!-- DI Status Panel -->
                <div class="bg-white rounded-lg shadow-md p-6">
                  <h2 class="text-lg font-semibold mb-4">DI Status</h2>
                  <div class="space-y-4">
                    <div class="flex items-center justify-between">
                      <span class="text-gray-700">DI1</span>
                      <span
                        class=${`px-2 py-1 text-sm rounded-full ${
                          ioStatus.di1
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        ${ioStatus.di1 ? "ON" : "OFF"}
                      </span>
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="text-gray-700">DI2</span>
                      <span
                        class=${`px-2 py-1 text-sm rounded-full ${
                          ioStatus.di2
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        ${ioStatus.di2 ? "ON" : "OFF"}
                      </span>
                    </div>
                  </div>
                </div>
                <!-- AI Status Panel -->
                <div class="bg-white rounded-lg shadow-md p-6">
                  <h2 class="text-lg font-semibold mb-4">AI Status</h2>
                  <div class="space-y-4">
                    <div class="flex items-center justify-between">
                      <span class="text-gray-700">AI1</span>
                      <span class="text-gray-900">${ioStatus.ai1} uA</span>
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="text-gray-700">AI2</span>
                      <span class="text-gray-900">${ioStatus.ai2} uA</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          `
        : html`
            <!-- IO Function Tab Content -->
            <div class="max-w-[60%] mx-auto">
              <div class="space-y-6">
                <!-- Slave Address Section -->
                <div class="bg-white rounded-lg shadow-md p-6">
                  <!-- <h2 class="text-lg font-semibold mb-4">Slave Address</h2> -->
                  <div class="max-w-xs">
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                      Slave Address
                      <span class="text-xs"> (1~255)</span>
                    </label>
                    <input
                      type="number"
                      value=${ioConfig.slaveAddress}
                      onChange=${(e) =>
                        setIoConfig((prev) => ({
                          ...prev,
                          slaveAddress: parseInt(e.target.value) || 1,
                        }))}
                      min="1"
                      max="247"
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <!-- Timing Function Section -->
                <div class="bg-white rounded-lg shadow-md p-6">
                  <h2 class="text-lg font-semibold mb-4">Timing Function</h2>
                  <div class="space-y-4">
                    ${ioConfig.timers.map(
                      (timer, index) => html`
                        <div
                          class="border rounded-lg p-4 ${timer.enabled
                            ? "border-blue-200 bg-blue-50"
                            : "border-gray-200"}"
                        >
                          <div class="flex items-center justify-between mb-4">
                            <h3 class="font-medium">Timer ${index + 1}</h3>
                            <label class="flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked=${timer.enabled}
                                onChange=${(e) =>
                                  handleTimerChange(
                                    index,
                                    "enabled",
                                    e.target.checked
                                  )}
                                class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <span class="ml-2 text-sm text-gray-700"
                                >Enable</span
                              >
                            </label>
                          </div>
                          ${timer.enabled &&
                          html`
                            <div class="grid grid-cols-2 gap-4">
                              <div>
                                <label
                                  class="block text-sm font-medium text-gray-700 mb-1"
                                >
                                  Timing Time
                                </label>
                                <input
                                  type="time"
                                  value=${timer.time}
                                  onChange=${(e) =>
                                    handleTimerChange(
                                      index,
                                      "time",
                                      e.target.value
                                    )}
                                  step="1"
                                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                              <div>
                                <label
                                  class="block text-sm font-medium text-gray-700 mb-1"
                                >
                                  Timing Action
                                </label>
                                <select
                                  value=${timer.action}
                                  onChange=${(e) =>
                                    handleTimerChange(
                                      index,
                                      "action",
                                      parseInt(e.target.value)
                                    )}
                                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  ${TIMING_ACTIONS.map(
                                    ([value, label]) =>
                                      html`<option value=${value}>
                                        ${label}
                                      </option>`
                                  )}
                                </select>
                              </div>
                            </div>
                            ${timer.action === 1 &&
                            html`
                              <div class="mt-4 grid grid-cols-2 gap-4">
                                <div>
                                  <label
                                    class="block text-sm font-medium text-gray-700 mb-1"
                                  >
                                    DO Action
                                  </label>
                                  <select
                                    value=${timer.doAction}
                                    onChange=${(e) =>
                                      handleTimerChange(
                                        index,
                                        "doAction",
                                        parseInt(e.target.value)
                                      )}
                                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  >
                                    ${TIMING_DO_ACTIONS.map(
                                      ([value, label]) =>
                                        html`<option value=${value}>
                                          ${label}
                                        </option>`
                                    )}
                                  </select>
                                </div>
                                <div>
                                  <label
                                    class="block text-sm font-medium text-gray-700 mb-1"
                                  >
                                    Action Type
                                  </label>
                                  <select
                                    value=${timer.doActionType}
                                    onChange=${(e) =>
                                      handleTimerChange(
                                        index,
                                        "doActionType",
                                        parseInt(e.target.value)
                                      )}
                                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  >
                                    ${TIMING_ACTION_TYPES.map(
                                      ([value, label]) =>
                                        html`<option value=${value}>
                                          ${label}
                                        </option>`
                                    )}
                                  </select>
                                </div>
                              </div>
                            `}
                          `}
                        </div>
                      `
                    )}
                  </div>
                </div>
                <!-- DO Function Section -->
                <div class="bg-white rounded-lg shadow-md p-6">
                  <h2 class="text-lg font-semibold mb-4">DO Function</h2>
                  <div class="space-y-4">
                    <div class="flex items-center">
                      <input
                        type="checkbox"
                        checked=${ioConfig.restartHold}
                        onChange=${(e) =>
                          setIoConfig((prev) => ({
                            ...prev,
                            restartHold: e.target.checked,
                          }))}
                        class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span class="ml-2 text-sm text-gray-700"
                        >Enable Restart Hold</span
                      >
                    </div>
                    <div class="mt-4">
                      <h3 class="text-sm font-medium text-gray-700 mb-2">
                        DO Action Config
                      </h3>
                      <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                          <tr>
                            <th
                              class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase"
                            >
                              Execute IO
                            </th>
                            <th
                              class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase"
                            >
                              Execute Action
                            </th>
                            <th
                              class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase"
                            >
                              Execute Time
                              <span class="text-xs"> (1~65535s)</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                          <tr>
                            <td class="px-4 py-2">DO1</td>
                            <td class="px-4 py-2">
                              <select
                                value=${ioConfig.executeActionDO1}
                                onChange=${(e) =>
                                  handleDoActionChange(
                                    "executeActionDO1",
                                    parseInt(e.target.value)
                                  )}
                                class="w-full px-2 py-1 border border-gray-300 rounded"
                              >
                                ${DO_FUNCTION_ACTIONS.map(
                                  ([value, label]) =>
                                    html`<option value=${value}>
                                      ${label}
                                    </option>`
                                )}
                              </select>
                            </td>
                            <td class="px-4 py-2">
                              <input
                                type="number"
                                value=${ioConfig.executeTimeDO1}
                                onChange=${(e) =>
                                  handleDoActionChange(
                                    "executeTimeDO1",
                                    parseInt(e.target.value) || 0
                                  )}
                                min="1"
                                max="65535"
                                class="w-full px-2 py-1 border border-gray-300 rounded"
                              />
                            </td>
                          </tr>
                          <tr>
                            <td class="px-4 py-2">DO2</td>
                            <td class="px-4 py-2">
                              <select
                                value=${ioConfig.executeActionDO2}
                                onChange=${(e) =>
                                  handleDoActionChange(
                                    "executeActionDO2",
                                    parseInt(e.target.value)
                                  )}
                                class="w-full px-2 py-1 border border-gray-300 rounded"
                              >
                                ${DO_FUNCTION_ACTIONS.map(
                                  ([value, label]) =>
                                    html`<option value=${value}>
                                      ${label}
                                    </option>`
                                )}
                              </select>
                            </td>
                            <td class="px-4 py-2">
                              <input
                                type="number"
                                value=${ioConfig.executeTimeDO2}
                                onChange=${(e) =>
                                  handleDoActionChange(
                                    "executeTimeDO2",
                                    parseInt(e.target.value) || 0
                                  )}
                                min="1"
                                max="65535"
                                class="w-full px-2 py-1 border border-gray-300 rounded"
                              />
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
                <!-- DI Function Section -->
                <div class="bg-white rounded-lg shadow-md p-6">
                  <h2 class="text-lg font-semibold mb-4">DI Function</h2>
                  <div class="max-w-xs">
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                      Filter Time
                      <span class="text-xs"> (10~65535)ms</span>
                    </label>
                    <input
                      type="number"
                      value=${ioConfig.filterTime}
                      onChange=${(e) =>
                        setIoConfig((prev) => ({
                          ...prev,
                          filterTime: parseInt(e.target.value) || 10,
                        }))}
                      min="10"
                      max="65535"
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          `}

      <!-- Save and Cancel Buttons -->
      <div
        class="mt-8 border-t border-gray-200 pt-6 pb-4 flex justify-end gap-4"
      >
        <${Button}
          onClick=${() => {
            if (confirm("Are you sure you want to discard all changes?")) {
              fetchData();
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
          ${isSaving ? "Saving..." : "Save"}
        <//>
      </div>
    </div>
  `;
}

export default IOFunction;
