"use strict";
import { h, html, useState, useEffect } from "../../bundle.js";
import { Icons, Button, Input, Select, Checkbox } from "../Components.js";
import { useLanguage } from "../LanguageContext.js";

function IOFunction() {
  const { t } = useLanguage();
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
    slaveAddress: 100,
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

  const TIMING_ACTIONS = [
    [0, t("restart")],
    [1, t("doAction")],
  ];

  const TIMING_DO_ACTIONS = [
    [1, "DO1"],
    [2, "DO2"],
  ];

  const TIMING_ACTION_TYPES = [
    [0, t("normalOpen")],
    [2, t("normalClose")],
    [3, t("flip")],
  ];

  const DO_FUNCTION_ACTIONS = [
    [0, t("noAction")],
    [1, t("outputHold")],
    [2, t("timerFlip")],
  ];

  // Fetch initial data
  const fetchData = async () => {
    try {
      setIsLoading(true);
      setLoadError("");

      const [ioStatusResponse, ioConfigResponse] = await Promise.all([
        fetch("/api/io/get", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }),
        fetch("/api/io-function/get", {
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
        do1: ioStatusData.do1 || false,
        do2: ioStatusData.do2 || false,
        di1: ioStatusData.di1 || false,
        di2: ioStatusData.di2 || false,
        ai1: ioStatusData.ai1 || 0,
        ai2: ioStatusData.ai2 || 0,
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

      const response = await fetch("/api/io-function/set", {
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
  const handleDoToggle = async (doNumber, doStatus) => {
    try {
      const response = await fetch("/api/io/do/toggle", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ [`do${doNumber}`]: doStatus }),
      });

      if (!response.ok) {
        throw new Error("Failed to toggle DO");
      }

      setIoStatus((prev) => ({
        ...prev,
        [`do${doNumber}`]: doStatus,
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

  // console.log(JSON.stringify(ioConfig));

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
              class=${`py-4 px-1 inline-flex items-center border-b-2 font-medium text-sm
                ${
                  activeTab === "io-control"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
            >
              ${t("ioControl")}
            </button>
            <button
              onClick=${() => setActiveTab("io-function")}
              class=${`py-4 px-1 inline-flex items-center border-b-2 font-medium text-sm
                ${
                  activeTab === "io-function"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
            >
              ${t("ioFunction")}
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
                  <h2 class="text-lg font-semibold mb-4">${t("doStatus")}</h2>
                  <div class="space-y-4">
                    <div class="flex items-center justify-between">
                      <span class="text-gray-700">DO1</span>
                      <button
                        onClick=${() =>
                          handleDoToggle(1, ioStatus.do1 === 1 ? 0 : 1)}
                        class=${`relative inline-flex h-6 w-11 items-center rounded-full ${
                          ioStatus.do1 === 1 ? "bg-blue-600" : "bg-gray-200"
                        }`}
                      >
                        <span
                          class=${`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                            ioStatus.do1 === 1
                              ? "translate-x-6"
                              : "translate-x-1"
                          }`}
                        ></span>
                      </button>
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="text-gray-700">DO2</span>
                      <button
                        onClick=${() =>
                          handleDoToggle(2, ioStatus.do2 === 1 ? 0 : 1)}
                        class=${`relative inline-flex h-6 w-11 items-center rounded-full ${
                          ioStatus.do2 === 1 ? "bg-blue-600" : "bg-gray-200"
                        }`}
                      >
                        <span
                          class=${`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                            ioStatus.do2 === 1
                              ? "translate-x-6"
                              : "translate-x-1"
                          }`}
                        ></span>
                      </button>
                    </div>
                  </div>
                </div>
                <!-- DI Status Panel -->
                <div class="bg-white rounded-lg shadow-md p-6">
                  <h2 class="text-lg font-semibold mb-4">${t("diStatus")}</h2>
                  <div class="space-y-4">
                    <div class="flex items-center justify-between">
                      <span class="text-gray-700">DI1</span>
                      <span
                        class=${`px-2 py-1 text-sm rounded-full ${
                          ioStatus.di1 === 1
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        ${ioStatus.di1 === 1 ? t("on") : t("off")}
                      </span>
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="text-gray-700">DI2</span>
                      <span
                        class=${`px-2 py-1 text-sm rounded-full ${
                          ioStatus.di2 === 1
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        ${ioStatus.di2 === 1 ? t("on") : t("off")}
                      </span>
                    </div>
                  </div>
                </div>
                <!-- AI Status Panel -->
                <div class="bg-white rounded-lg shadow-md p-6">
                  <h2 class="text-lg font-semibold mb-4">${t("aiStatus")}</h2>
                  <div class="space-y-4">
                    <div class="flex items-center justify-between">
                      <span class="text-gray-700">AI1</span>
                      <span class="text-gray-900"
                        >${ioStatus.ai1} ${String.fromCodePoint(0x00b5)}A</span
                      >
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="text-gray-700">AI2</span>
                      <span class="text-gray-900"
                        >${ioStatus.ai2} ${String.fromCodePoint(0x00b5)}A</span
                      >
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
                  ${Input({
                    type: "number",
                    name: "slaveAddress",
                    extra: "(1~255)",
                    label: t("slaveAddress"),
                    value: ioConfig.slaveAddress,
                    onChange: (e) =>
                      setIoConfig((prev) => ({
                        ...prev,
                        slaveAddress: parseInt(e.target.value) || 100,
                      })),
                    min: 1,
                    max: 255,
                  })}
                </div>
                <!-- Timing Function Section -->
                <div class="bg-white rounded-lg shadow-md p-6">
                  <h2 class="text-lg font-semibold mb-4">
                    ${t("timingFunction")}
                  </h2>
                  <div class="space-y-4">
                    ${ioConfig.timers.map(
                      (timer, index) => html`
                        <div
                          key=${index}
                          class="border rounded-lg p-4 ${timer.enabled
                            ? "border-blue-200 bg-blue-50"
                            : "border-gray-200"}"
                        >
                          <div class="flex items-center justify-between mb-4">
                            <h3 class="font-medium">Timer ${index + 1}</h3>
                            ${Checkbox({
                              key: `timer-${index}-enabled`,
                              name: "enabled",
                              label: t("enable"),
                              value: timer.enabled,
                              onChange: (e) =>
                                handleTimerChange(
                                  index,
                                  "enabled",
                                  e.target.checked
                                ),
                            })}
                          </div>
                          ${timer.enabled &&
                          html`
                            <div class="grid grid-cols-2 gap-4">
                              ${Input({
                                key: `timer-${index}-time`,
                                type: "time",
                                name: "time",
                                label: t("timingTime"),
                                value: timer.time,
                                onChange: (e) =>
                                  handleTimerChange(
                                    index,
                                    "time",
                                    e.target.value
                                  ),
                              })}
                              ${Select({
                                key: `timer-${index}-action`,
                                name: "action",
                                label: t("timingAction"),
                                value: timer.action,
                                onChange: (e) =>
                                  handleTimerChange(
                                    index,
                                    "action",
                                    parseInt(e.target.value)
                                  ),
                                options: TIMING_ACTIONS,
                              })}
                            </div>
                            ${timer.action === 1 &&
                            html`
                              <div class="mt-4 grid grid-cols-2 gap-4">
                                ${Select({
                                  key: `timer-${index}-doAction`,
                                  name: "doAction",
                                  label: t("doAction"),
                                  value: timer.doAction,
                                  onChange: (e) =>
                                    handleTimerChange(
                                      index,
                                      "doAction",
                                      parseInt(e.target.value)
                                    ),
                                  options: TIMING_DO_ACTIONS,
                                })}
                                ${Select({
                                  key: `timer-${index}-doActionType`,
                                  name: "doActionType",
                                  label: t("actionType"),
                                  value: timer.doActionType,
                                  onChange: (e) =>
                                    handleTimerChange(
                                      index,
                                      "doActionType",
                                      parseInt(e.target.value)
                                    ),
                                  options: TIMING_ACTION_TYPES,
                                })}
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
                  <h2 class="text-lg font-semibold mb-4">${t("doFunction")}</h2>
                  <div class="space-y-4">
                    ${Checkbox({
                      name: "restartHold",
                      label: t("enableRestartHold"),
                      value: ioConfig.restartHold,
                      onChange: (e) =>
                        setIoConfig((prev) => ({
                          ...prev,
                          restartHold: e.target.checked,
                        })),
                    })}

                    <div class="mt-4">
                      <h3 class="text-sm font-medium text-gray-700 mb-2">
                        ${t("doActionConfig")}
                      </h3>
                      <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                          <tr>
                            <th
                              class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase"
                            >
                              ${t("executeIO")}
                            </th>
                            <th
                              class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase"
                            >
                              ${t("executeAction")}
                            </th>
                            <th
                              class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase"
                            >
                              ${t("executeTime")}
                              <span class="text-xs"> (1~65535s)</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                          <tr>
                            <td class="px-4 py-2">DO1</td>
                            <td class="px-4 py-2">
                              ${Select({
                                name: "executeActionDO1",
                                value: ioConfig.executeActionDO1,
                                onChange: (e) =>
                                  handleDoActionChange(
                                    "executeActionDO1",
                                    parseInt(e.target.value)
                                  ),
                                options: DO_FUNCTION_ACTIONS,
                              })}
                            </td>
                            <td class="px-4 py-2">
                              ${Input({
                                type: "number",
                                name: "executeTimeDO1",
                                value: ioConfig.executeTimeDO1,
                                onChange: (e) =>
                                  handleDoActionChange(
                                    "executeTimeDO1",
                                    parseInt(e.target.value) || 2
                                  ),
                                min: 1,
                                max: 65535,
                              })}
                            </td>
                          </tr>
                          <tr>
                            <td class="px-4 py-2">DO2</td>
                            <td class="px-4 py-2">
                              ${Select({
                                name: "executeActionDO2",
                                value: ioConfig.executeActionDO2,
                                onChange: (e) =>
                                  handleDoActionChange(
                                    "executeActionDO2",
                                    parseInt(e.target.value)
                                  ),
                                options: DO_FUNCTION_ACTIONS,
                              })}
                            </td>
                            <td class="px-4 py-2">
                              ${Input({
                                type: "number",
                                name: "executeTimeDO2",
                                value: ioConfig.executeTimeDO2,
                                onChange: (e) =>
                                  handleDoActionChange(
                                    "executeTimeDO2",
                                    parseInt(e.target.value) || 2
                                  ),
                                min: 1,
                                max: 65535,
                              })}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
                <!-- DI Function Section -->
                <div class="bg-white rounded-lg shadow-md p-6">
                  <h2 class="text-lg font-semibold mb-4">${t("diFunction")}</h2>
                  ${Input({
                    type: "number",
                    name: "filterTime",
                    label: t("filterTime"),
                    extra: "(10~65535)ms",
                    value: ioConfig.filterTime,
                    onChange: (e) =>
                      setIoConfig((prev) => ({
                        ...prev,
                        filterTime: parseInt(e.target.value) || 10,
                      })),
                    min: 10,
                    max: 65535,
                  })}
                </div>
                <!-- Save and Cancel Buttons -->
                <div class="flex justify-end gap-4">
                  <${Button}
                    onClick=${() => {
                      if (
                        confirm("Are you sure you want to discard all changes?")
                      ) {
                        fetchData();
                      }
                    }}
                    variant="secondary"
                    icon="CloseIcon"
                    disabled=${isSaving}
                  >
                    ${t("cancel")}
                  <//>
                  <${Button}
                    onClick=${saveConfig}
                    disabled=${isSaving}
                    loading=${isSaving}
                    icon="SaveIcon"
                  >
                    ${isSaving ? t("saving") : t("save")}
                  <//>
                </div>
              </div>
            </div>
          `}
    </div>
  `;
}

export default IOFunction;
