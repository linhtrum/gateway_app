"use strict";
import { h, html, useState, useEffect, useMemo } from "../../bundle.js";
import { Icons, Button, Tabs, Input, Select, Checkbox } from "../Components.js";

// Constants and configuration
const CONFIG = {
  MAX_DEVICES: 128,
  MAX_TOTAL_NODES: 300,
  MAX_NAME_LENGTH: 20,
  MIN_POLLING_INTERVAL: 10,
  MAX_POLLING_INTERVAL: 65535,
  MIN_TIMEOUT: 10,
  MAX_TIMEOUT: 65535,
  DATA_TYPES: [
    [1, "Boolean"],
    [2, "Int8"],
    [3, "UInt8"],
    [4, "Int16"],
    [5, "UInt16"],
    [6, "Int32 (ABCD)"],
    [7, "Int32 (CDAB)"],
    [8, "UInt32 (ABCD)"],
    [9, "UInt32 (CDAB)"],
    [10, "Float (ABCD)"],
    [11, "Float (CDAB)"],
    [12, "Double"],
  ],
  FUNCTION_CODES: [
    [1, "01 - Read Coils"],
    [2, "02 - Read Discrete Inputs"],
    [3, "03 - Read Holding Registers"],
    [4, "04 - Read Input Registers"],
  ],
  REPORT_CHANNELS: [
    [1, "MQTT"],
    [2, "Socket1"],
    [3, "Socket2"],
  ],
  MQTT_QOS_OPTIONS: [
    [0, "QOS0"],
    [1, "QOS1"],
    [2, "QOS2"],
  ],
  REPORT_INTERVALS: [
    [1, "Every Minute"],
    [2, "Every Quarter"],
    [3, "Every Hour"],
    [4, "Fixed Time"],
  ],
  QUERY_SET_TYPES: [
    [0, "ModbusRTU"],
    [1, "ModbusTCP"],
    [2, "Json"],
  ],
  MAX_JSON_TEMPLATE_BYTES: 2048,
  PORT_OPTIONS: [
    [0, "SERIAL1"],
    [1, "SERIAL2"],
    [2, "ETHERNET"],
    [3, "IO"],
    [4, "VIRTUAL"],
  ],
  PROTOCOL_TYPES: [
    [0, "Modbus"],
    [1, "DL/T645"],
  ],
};

const IO_NODE_OPTIONS = [
  { name: "DI1", ra: 0, fc: 2, dt: 1 },
  { name: "DI2", ra: 1, fc: 2, dt: 1 },
  { name: "DO1", ra: 0, fc: 1, dt: 1 },
  { name: "DO2", ra: 1, fc: 1, dt: 1 },
  { name: "AI1", ra: 0, fc: 4, dt: 10 },
  { name: "AI2", ra: 2, fc: 4, dt: 10 },
];

function Devices() {
  // State management
  const [activeTab, setActiveTab] = useState("edge-computing");
  const [edgeComputingEnabled, setEdgeComputingEnabled] = useState(0);
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isAddingDevice, setIsAddingDevice] = useState(false);
  const [isAddingNode, setIsAddingNode] = useState(false);
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [events, setEvents] = useState([]);
  const [editingEventId, setEditingEventId] = useState(null);
  const [eventError, setEventError] = useState("");
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [jsonTemplateError, setJsonTemplateError] = useState("");
  const [reportConfig, setReportConfig] = useState({
    enabled: false,
    channel: 1,
    mqttTopic: "",
    mqttQos: 0,
    periodicEnabled: false,
    periodicInterval: 60,
    regularEnabled: false,
    regularInterval: 1,
    regularFixedTime: "00:00",
    failurePaddingEnabled: false,
    failurePaddingContent: "",
    quotationMark: false,
    jsonTemplate: "",
    mqttDataQuerySet: false,
    mqttQuerySetType: 0,
    mqttQuerySetTopic: "",
    mqttQuerySetQos: 0,
    mqttRespondTopic: "",
    mqttRespondQos: 0,
    mqttRetainedMessage: false,
  });

  // Reset modal states when tab changes
  useEffect(() => {
    setIsAddingDevice(false);
    setIsAddingNode(false);
    setIsAddingEvent(false);
    setEditingIndex(null);
    setEditingDevice(null);
    setEditingNodeIndex(null);
    setEditingNode(null);
    setEditingEventId(null);
  }, [activeTab]);

  // Form states
  const [newDevice, setNewDevice] = useState({
    n: "",
    da: 1,
    pi: 1000,
    g: false,
    p: 0,
    pr: 0,
    em: false,
    ma: 1,
    sa: "",
    sp: 502,
  });
  const [newNode, setNewNode] = useState({
    n: "",
    a: 1,
    fc: 1,
    dt: 1,
    t: 1000,
    er: false,
    vr: 1,
    em: false,
    ma: 1,
    fo: "",
  });
  const [newEvent, setNewEvent] = useState({
    n: "", // Event name
    e: true, // Enable
    c: 1, // Trigger condition
    p: "", // Trigger point
    sc: 100, // Scan code
    mi: 1000, // Minimum interval
    ut: 20000, // Upper threshold
    lt: 0, // Lower threshold
    te: 1, // Trigger execution
    ta: 1, // Trigger action
    d: "", // Description
  });

  // Edit states
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingDevice, setEditingDevice] = useState(null);
  const [editingNodeIndex, setEditingNodeIndex] = useState(null);
  const [editingNode, setEditingNode] = useState(null);

  // Memoized values
  const totalNodes = useMemo(
    () =>
      devices.reduce((total, device) => total + (device.ns?.length || 0), 0),
    [devices]
  );

  const selectedDeviceNodes = useMemo(
    () => (selectedDevice !== null ? devices[selectedDevice]?.ns || [] : []),
    [devices, selectedDevice]
  );

  // Add trigger condition options
  const TRIGGER_CONDITIONS = [
    [1, "Forward Follow"],
    [2, "Reverse Follow"],
    [3, ">="],
    [4, "<="],
    [5, "Within Threshold"],
    [6, "Out of Threshold"],
    [7, ">"],
    [8, "<"],
  ];

  // Add trigger execution options
  const TRIGGER_EXECUTIONS = [
    [1, "DO1"],
    [2, "DO2"],
  ];

  // Add trigger action options
  const TRIGGER_ACTIONS = [
    [1, "Normal Open(NO)"],
    [2, "Normal Close(NC)"],
    [3, "Flip"],
  ];

  // Add function to get all available nodes for trigger point selection
  const getAllNodes = useMemo(() => {
    const nodes = [];
    devices.forEach((device) => {
      device.ns?.forEach((node) => {
        nodes.push({
          value: node.n,
          label: node.n,
        });
      });
    });
    return nodes;
  }, [devices]);

  // Add function to determine which threshold fields should be shown
  const getThresholdVisibility = useMemo(() => {
    const condition = parseInt(newEvent.c);
    return {
      showUpper: ![1, 2, 4, 8].includes(condition),
      showLower: ![1, 2, 3, 7].includes(condition),
    };
  }, [newEvent.c]);

  // Add function to determine if trigger action should be shown
  const showTriggerAction = useMemo(() => {
    const condition = parseInt(newEvent.c);
    return ![1, 2].includes(condition);
  }, [newEvent.c]);

  // Add function to get trigger condition label
  const getTriggerConditionLabel = (condition) => {
    const found = TRIGGER_CONDITIONS.find(
      ([value]) => value === parseInt(condition)
    );
    return found ? found[1] : "";
  };

  // Add function to get trigger execution label
  const getTriggerExecutionLabel = (execution) => {
    const found = TRIGGER_EXECUTIONS.find(
      ([value]) => value === parseInt(execution)
    );
    return found ? found[1] : "";
  };

  // Add function to get trigger action label
  const getTriggerActionLabel = (action) => {
    const found = TRIGGER_ACTIONS.find(([value]) => value === parseInt(action));
    return found ? found[1] : "";
  };

  const fetchDeviceConfig = async () => {
    try {
      setIsLoading(true);
      setLoadError("");

      const [
        edgeResponse,
        devicesResponse,
        eventsResponse,
        reportConfigResponse,
      ] = await Promise.all([
        fetch("/api/edge/get", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }),
        fetch("/api/devices/get", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }),
        fetch("/api/event/get", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }),
        fetch("/api/report/get", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }),
      ]);

      if (
        !edgeResponse.ok ||
        !devicesResponse.ok ||
        !eventsResponse.ok ||
        !reportConfigResponse.ok
      ) {
        throw new Error("Failed to fetch configurations");
      }

      const [edgeData, devicesData, eventsData, reportConfigData] =
        await Promise.all([
          edgeResponse.json(),
          devicesResponse.json(),
          eventsResponse.json(),
          reportConfigResponse.json(),
        ]);
      setEdgeComputingEnabled(edgeData.enabled);
      setDevices(devicesData || []);
      setSelectedDevice(devicesData.length > 0 ? 0 : null);
      setEvents(eventsData || []);

      // Convert JSON template object to string if it exists
      const processedReportConfig = { ...reportConfigData };
      if (processedReportConfig.jsonTemplate) {
        try {
          processedReportConfig.jsonTemplate = JSON.stringify(
            processedReportConfig.jsonTemplate,
            null,
            2
          );
        } catch (e) {
          console.error("Error stringifying JSON template:", e);
        }
      }
      setReportConfig(processedReportConfig || {});
    } catch (error) {
      console.error("Error fetching configurations:", error);
      setLoadError(
        error.name === "AbortError"
          ? "Request timed out. Please try again."
          : error.message || "Failed to load configurations"
      );
    } finally {
      setIsLoading(false);
      setIsLoadingEvents(false);
    }
  };

  const saveDeviceConfig = async () => {
    try {
      setIsSaving(true);
      setSaveError("");
      setSaveSuccess(false);

      // Convert JSON template string to object if it exists and is valid
      let updatedReportConfig = { ...reportConfig };
      if (updatedReportConfig.jsonTemplate) {
        try {
          const parsedJson = JSON.parse(updatedReportConfig.jsonTemplate);
          updatedReportConfig.jsonTemplate = parsedJson;
        } catch (e) {
          console.error("Error parsing JSON template:", e);
          setSaveError("Invalid JSON template format");
          setIsSaving(false);
          return;
        }
      }

      // Save device configuration
      // const controller = new AbortController();
      // const timeoutId = setTimeout(() => controller.abort(), 10000);

      // const response = await fetch("/api/devices/set", {
      //   method: "POST",
      //   headers: {
      //     "Content-Type": "application/json",
      //   },
      //   body: JSON.stringify(devices),
      //   signal: controller.signal,
      // });

      // clearTimeout(timeoutId);

      // if (!response.ok) {
      //   throw new Error(
      //     `Failed to save device configuration: ${response.statusText}`
      //   );
      // }

      // Save events configuration
      // const eventsController = new AbortController();
      // const eventsTimeoutId = setTimeout(() => eventsController.abort(), 10000);

      // const eventsResponse = await fetch("/api/event/set", {
      //   method: "POST",
      //   headers: {
      //     "Content-Type": "application/json",
      //   },
      //   body: JSON.stringify(events),
      //   signal: eventsController.signal,
      // });

      // clearTimeout(eventsTimeoutId);

      // if (!eventsResponse.ok) {
      //   throw new Error(
      //     `Failed to save events configuration: ${eventsResponse.statusText}`
      //   );
      // }

      // Save report configuration
      // const reportController = new AbortController();
      // const reportTimeoutId = setTimeout(() => reportController.abort(), 10000);

      // const reportResponse = await fetch("/api/report/set", {
      //   method: "POST",
      //   headers: {
      //     "Content-Type": "application/json",
      //   },
      //   body: JSON.stringify(updatedReportConfig),
      //   signal: reportController.signal,
      // });

      // clearTimeout(reportTimeoutId);

      // if (!reportResponse.ok) {
      //   throw new Error(
      //     `Failed to save report configuration: ${reportResponse.statusText}`
      //   );
      // }

      // Call reboot API after successful save
      // const rebootController = new AbortController();
      // const rebootTimeoutId = setTimeout(() => rebootController.abort(), 10000);

      // const rebootResponse = await fetch("/api/reboot/set", {
      //   method: "POST",
      //   headers: {
      //     "Content-Type": "application/json",
      //   },
      //   signal: rebootController.signal,
      // });

      // clearTimeout(rebootTimeoutId);

      // if (!rebootResponse.ok) {
      //   throw new Error("Failed to reboot server");
      // }

      const [edgeResponse, deviceResponse, reportResponse, eventResponse] =
        await Promise.all([
          fetch("/api/edge-computing/set", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          }),
          fetch("/api/device/set", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          }),
          fetch("/api/report/set", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          }),
          fetch("/api/event/set", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          }),
        ]);

      if (
        !edgeResponse.ok ||
        !deviceResponse.ok ||
        !reportResponse.ok ||
        !eventResponse.ok
      ) {
        throw new Error("Failed to save configuration");
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

      // Show success message for 3 seconds
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);

      // Refresh page after 5 seconds
      setTimeout(() => {
        window.location.reload();
      }, 5000);
    } catch (error) {
      console.error("Error saving configuration:", error);
      setSaveError(
        error.name === "AbortError"
          ? "Request timed out. Please try again."
          : error.message || "Failed to save configuration"
      );
      setIsSaving(false);
    }
  };

  const Th = (props) =>
    html`<th
      class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
    >
      ${props.children}
    </th>`;
  const Td = (props) =>
    html`<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
      ${props.children}
    </td>`;

  const isDeviceNameUnique = (name, excludeIndex = -1) => {
    return !devices.some(
      (device, index) =>
        index !== excludeIndex && device.n.toLowerCase() === name.toLowerCase()
    );
  };

  const isNodeNameUnique = (name, deviceIndex, excludeNodeIndex = -1) => {
    if (!devices[deviceIndex] || !devices[deviceIndex].ns) return true;
    return !devices[deviceIndex].ns.some(
      (node, index) =>
        index !== excludeNodeIndex &&
        node.n.toLowerCase() === name.toLowerCase()
    );
  };

  // Add new function to check node name uniqueness across all devices
  const isNodeNameUniqueAcrossDevices = (
    name,
    excludeDeviceIndex = -1,
    excludeNodeIndex = -1
  ) => {
    return !devices.some((device, deviceIndex) => {
      // Skip the excluded device
      if (deviceIndex === excludeDeviceIndex) return false;

      // Check nodes in current device
      return device.ns?.some((node, nodeIndex) => {
        // Skip the excluded node
        if (
          deviceIndex === excludeDeviceIndex &&
          nodeIndex === excludeNodeIndex
        )
          return false;
        return node.n.toLowerCase() === name.toLowerCase();
      });
    });
  };

  // Validation functions
  const validateDeviceName = (name) => {
    if (!name || name.trim().length === 0) {
      return "Device name cannot be empty";
    }
    if (name.length > CONFIG.MAX_NAME_LENGTH) {
      return `Device name cannot exceed ${CONFIG.MAX_NAME_LENGTH} characters`;
    }
    return null;
  };

  const validateSlaveAddress = (address) => {
    const numValue = parseInt(address);
    if (isNaN(numValue) || numValue < 1 || numValue > 247) {
      return "Slave address must be between 1 and 247";
    }
    return null;
  };

  const validatePollingInterval = (interval) => {
    const numValue = parseInt(interval);
    if (
      isNaN(numValue) ||
      numValue < CONFIG.MIN_POLLING_INTERVAL ||
      numValue > CONFIG.MAX_POLLING_INTERVAL
    ) {
      return `Polling interval must be between ${CONFIG.MIN_POLLING_INTERVAL} and ${CONFIG.MAX_POLLING_INTERVAL} ms`;
    }
    return null;
  };

  const validateNodeName = (name) => {
    if (!name || name.trim().length === 0) {
      return "Node name cannot be empty";
    }
    if (name.length > CONFIG.MAX_NAME_LENGTH) {
      return `Node name cannot exceed ${CONFIG.MAX_NAME_LENGTH} characters`;
    }
    return null;
  };

  const validateTimeout = (timeout) => {
    const numValue = parseInt(timeout);
    if (
      isNaN(numValue) ||
      numValue < CONFIG.MIN_TIMEOUT ||
      numValue > CONFIG.MAX_TIMEOUT
    ) {
      return `Timeout must be between ${CONFIG.MIN_TIMEOUT} and ${CONFIG.MAX_TIMEOUT} ms`;
    }
    return null;
  };

  const validateServerAddress = (address) => {
    if (!address) return "Server address is required for Ethernet devices";
    if (address.length > 64)
      return "Server address must not exceed 64 characters";
    return "";
  };

  const validateServerPort = (port) => {
    if (!port) return "Server port is required for Ethernet devices";
    const portNum = parseInt(port);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      return "Server port must be between 1 and 65535";
    }
    return "";
  };

  // Add shared validation function
  const validateDeviceConfig = (device, excludeIndex = -1) => {
    const errors = [];

    // Validate device name
    const nameError = validateDeviceName(device.n);
    if (nameError) errors.push(nameError);

    // Validate slave address
    const addressError = validateSlaveAddress(device.da);
    if (addressError) errors.push(addressError);

    // Validate polling interval
    const intervalError = validatePollingInterval(device.pi);
    if (intervalError) errors.push(intervalError);

    // Validate server address and port for Ethernet devices
    if (device.port === 3) {
      const serverAddressError = validateServerAddress(device.serverAddress);
      if (serverAddressError) errors.push(serverAddressError);

      const serverPortError = validateServerPort(device.serverPort);
      if (serverPortError) errors.push(serverPortError);
    }

    if (!isDeviceNameUnique(device.n, excludeIndex)) {
      errors.push("Device name already exists");
    }

    return errors;
  };

  const validateNodeConfig = (node) => {
    const errors = [];

    const nameError = validateNodeName(node.n);
    if (nameError) errors.push(nameError);

    const timeoutError = validateTimeout(node.t);
    if (timeoutError) errors.push(timeoutError);

    if (!isNodeNameUniqueAcrossDevices(node.n)) {
      errors.push("Node name already exists");
    }

    if (totalNodes >= CONFIG.MAX_TOTAL_NODES) {
      errors.push(
        `Maximum total number of nodes (${CONFIG.MAX_TOTAL_NODES}) reached across all devices. Cannot add more nodes.`
      );
    }

    return errors;
  };

  // AddDeviceModal Form handlers
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    let error = null;

    // Handle checkbox inputs
    if (type === "checkbox") {
      setNewDevice((prev) => ({
        ...prev,
        [name]: checked,
      }));
      return;
    }

    // Handle numeric inputs
    if (["da", "pi", "p", " pr", "ma", "sp"].includes(name)) {
      const numValue = parseInt(value);
      if (value !== "") {
        if (
          name === "da" &&
          (isNaN(numValue) || numValue < 1 || numValue > 255)
        ) {
          error = "Slave address must be between 1 and 255";
        } else if (
          name === "pi" &&
          (isNaN(numValue) ||
            numValue < CONFIG.MIN_POLLING_INTERVAL ||
            numValue > CONFIG.MAX_POLLING_INTERVAL)
        ) {
          error = `Polling interval must be between ${CONFIG.MIN_POLLING_INTERVAL} and ${CONFIG.MAX_POLLING_INTERVAL} ms`;
        } else if (
          name === "ma" &&
          (isNaN(numValue) || numValue < 0 || numValue > 255)
        ) {
          error = "Map device address must be between 0 and 255";
        } else if (
          name === "sp" &&
          (isNaN(numValue) || numValue < 255 || numValue > 65535)
        ) {
          error = "Server port must be between 255 and 65535";
        }
      }
      setNewDevice((prev) => ({
        ...prev,
        [name]: value === "" ? "" : numValue,
      }));
      return;
    }

    if (name === "n") {
      if (!value || value.trim().length === 0) {
        error = "Device name cannot be empty";
      } else if (value.length > CONFIG.MAX_NAME_LENGTH) {
        error = `Device name cannot exceed ${CONFIG.MAX_NAME_LENGTH} characters`;
      }
    }

    if (error) {
      alert(error);
      return;
    }

    setNewDevice((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // EditDeviceModal Form handlers
  const handleEditInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    let error = null;

    // Handle checkbox inputs
    if (type === "checkbox") {
      setEditingDevice((prev) => ({
        ...prev,
        [name]: checked,
      }));
      return;
    }

    // Handle numeric inputs
    if (["da", "pi", "p", " pr", "ma", "sp"].includes(name)) {
      const numValue = parseInt(value);
      if (value !== "") {
        if (
          name === "da" &&
          (isNaN(numValue) || numValue < 1 || numValue > 255)
        ) {
          error = "Slave address must be between 1 and 255";
        } else if (
          name === "pi" &&
          (isNaN(numValue) ||
            numValue < CONFIG.MIN_POLLING_INTERVAL ||
            numValue > CONFIG.MAX_POLLING_INTERVAL)
        ) {
          error = `Polling interval must be between ${CONFIG.MIN_POLLING_INTERVAL} and ${CONFIG.MAX_POLLING_INTERVAL} ms`;
        } else if (
          name === "ma" &&
          (isNaN(numValue) || numValue < 0 || numValue > 255)
        ) {
          error = "Map device address must be between 0 and 255";
        } else if (
          name === "sp" &&
          (isNaN(numValue) || numValue < 255 || numValue > 65535)
        ) {
          error = "Server port must be between 255 and 65535";
        }
      }
      // Update the value as a number
      setEditingDevice((prev) => ({
        ...prev,
        [name]: value === "" ? "" : numValue,
      }));
      return;
    }

    // Validate device name
    if (name === "n") {
      if (!value || value.trim().length === 0) {
        error = "Device name cannot be empty";
      } else if (value.length > CONFIG.MAX_NAME_LENGTH) {
        error = `Device name cannot exceed ${CONFIG.MAX_NAME_LENGTH} characters`;
      }
    }

    if (error) {
      alert(error);
      return;
    }

    setEditingDevice((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // AddNodeModal Form handlers
  const handleNodeInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    let error = null;

    // Handle checkbox inputs
    if (type === "checkbox") {
      setNewNode((prev) => ({
        ...prev,
        [name]: checked,
      }));
      return;
    }

    // Handle numeric fields
    if (["a", "fc", "dt", "t", "vr", "ma"].includes(name)) {
      const numValue = parseInt(value);
      if (value !== "") {
        if (
          name === "t" &&
          (isNaN(numValue) ||
            numValue < CONFIG.MIN_TIMEOUT ||
            numValue > CONFIG.MAX_TIMEOUT)
        ) {
          error = `Timeout must be between ${CONFIG.MIN_TIMEOUT} and ${CONFIG.MAX_TIMEOUT} ms`;
        } else if (
          name === "vr" &&
          (isNaN(numValue) || numValue < 1 || numValue > 65535)
        ) {
          error = "Variation range must be between 1 and 65535";
        } else if (
          name === "ma" &&
          (isNaN(numValue) || numValue < 0 || numValue > 65535)
        ) {
          error = "Map node address must be between 0 and 65535";
        }
      }
      setNewNode((prev) => ({
        ...prev,
        [name]: value === "" ? "" : numValue,
      }));
      return;
    }

    // Handle formula field
    if (name === "fo") {
      if (value.length > 128) {
        error = "Formula cannot exceed 128 characters";
      }
      setNewNode((prev) => ({
        ...prev,
        [name]: value,
      }));
      return;
    }

    // Handle other fields
    if (name === "n") {
      error = validateNodeName(value);
      if (!error && value && !isNodeNameUniqueAcrossDevices(value)) {
        error =
          "A node with this name already exists in any device. Please use a unique name.";
      }
    }

    if (error) {
      alert(error);
      return;
    }

    setNewNode((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // EditNodeModal Form handlers
  const handleEditNodeInputChange = (e) => {
    const { name, value, type, checked } = e.target;

    // Handle checkbox inputs
    if (type === "checkbox") {
      setEditingNode((prev) => ({
        ...prev,
        [name]: checked,
      }));
      return;
    }

    // Handle numeric fields
    if (["a", "fc", "dt", "t", "vr", "ma"].includes(name)) {
      const numValue = parseInt(value);
      if (value !== "") {
        if (
          name === "t" &&
          (isNaN(numValue) ||
            numValue < CONFIG.MIN_TIMEOUT ||
            numValue > CONFIG.MAX_TIMEOUT)
        ) {
          alert(
            `Timeout must be between ${CONFIG.MIN_TIMEOUT} and ${CONFIG.MAX_TIMEOUT} ms`
          );
          return;
        } else if (
          name === "vr" &&
          (isNaN(numValue) || numValue < 1 || numValue > 65535)
        ) {
          alert("Variation range must be between 1 and 65535");
          return;
        } else if (
          name === "ma" &&
          (isNaN(numValue) || numValue < 0 || numValue > 65534)
        ) {
          alert("Map node address must be between 0 and 65534");
          return;
        }
      }
      setEditingNode((prev) => ({
        ...prev,
        [name]: value === "" ? "" : numValue,
      }));
      return;
    }

    // Handle formula field
    if (name === "fo") {
      if (value.length > 128) {
        alert("Formula cannot exceed 128 characters");
        return;
      }
      setEditingNode((prev) => ({
        ...prev,
        [name]: value,
      }));
      return;
    }

    // Handle other fields
    if (name === "n") {
      if (value.length > CONFIG.MAX_NAME_LENGTH) {
        alert(`Node name cannot exceed ${CONFIG.MAX_NAME_LENGTH} characters`);
        return;
      }
      if (
        value &&
        !isNodeNameUniqueAcrossDevices(value, selectedDevice, editingNodeIndex)
      ) {
        alert(
          "A node with this name already exists in any device. Please use a unique name."
        );
        return;
      }
    }

    setEditingNode((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // AddDeviceModal Submit handlers
  const handleSubmit = (e) => {
    e.preventDefault();
    const errors = validateDeviceConfig(newDevice);

    if (errors.length > 0) {
      alert(errors.join("\n"));
      return;
    }

    // Add the new device
    setDevices((prev) => [...prev, { ...newDevice, ns: [] }]);
    setNewDevice({
      n: "", //device name
      p: 0, //device port
      pr: 0, //device protocol
      da: 1, //device address
      pi: 1000, //polling interval
      g: false, //device group
      sa: "", //server address
      sp: 502, //server port
      em: false, //enable map
      ma: 1, //map device address
    });
    setIsAddingDevice(false);
  };

  // AddNodeModal Submit handlers
  const handleNodeSubmit = (e) => {
    e.preventDefault();
    if (selectedDevice === null) return;

    const errors = validateNodeConfig(newNode);

    if (errors.length > 0) {
      alert(errors.join("\n"));
      return;
    }

    const updatedDevices = devices.map((device, index) => {
      if (index === selectedDevice) {
        return {
          ...device,
          ns: [
            ...(device.ns || []),
            {
              ...newNode,
              dt: parseInt(newNode.dt), // Ensure dt is numeric
              a: parseInt(newNode.a),
              fc: parseInt(newNode.fc),
              t: parseInt(newNode.t),
              vr: parseInt(newNode.vr),
              ma: parseInt(newNode.ma),
            },
          ],
        };
      }
      return device;
    });

    setDevices(updatedDevices);
    setNewNode({
      n: "",
      a: 1,
      fc: 1,
      dt: 1, // Reset to default numeric value
      t: 1000,
      er: false,
      vr: 1,
      em: false,
      ma: 1,
      fo: "",
    });
    setIsAddingNode(false);
  };

  const deleteDevice = (index) => {
    const deviceName = devices[index].n;
    if (
      confirm(
        `Are you sure you want to delete device "${deviceName}"? This will also delete all its nodes.`
      )
    ) {
      const newDevices = devices.filter((_, i) => i !== index);
      setDevices(newDevices);
      if (selectedDevice === index) {
        setSelectedDevice(null);
      }
    }
  };

  const deleteNode = (nodeIndex) => {
    const nodeName = devices[selectedDevice].ns[nodeIndex].n;
    if (confirm(`Are you sure you want to delete node "${nodeName}"?`)) {
      const updatedDevices = devices.map((device, index) => {
        if (index === selectedDevice) {
          const updatedNodes = device.ns.filter((_, i) => i !== nodeIndex);
          return { ...device, ns: updatedNodes };
        }
        return device;
      });
      setDevices(updatedDevices);
    }
  };

  const startEditing = (index) => {
    setEditingIndex(index);
    // Create a deep copy of the device to avoid modifying the original
    const deviceToEdit = {
      n: devices[index].n,
      da: parseInt(devices[index].da),
      pi: parseInt(devices[index].pi),
      g: Boolean(devices[index].g),
      p: parseInt(devices[index].p),
      pr: parseInt(devices[index].pr),
      sa: devices[index].sa,
      sp: parseInt(devices[index].sp),
      em: Boolean(devices[index].em),
      ma: parseInt(devices[index].ma),
      ns: [...(devices[index].ns || [])],
    };
    setEditingDevice(deviceToEdit);
  };

  const saveEdit = (index) => {
    const errors = validateDeviceConfig(editingDevice, index);

    if (errors.length > 0) {
      alert(errors.join("\n"));
      return;
    }

    const newDevices = [...devices];
    newDevices[index] = { ...editingDevice, ns: devices[index].ns || [] };
    setDevices(newDevices);
    setEditingIndex(null);
    setEditingDevice(null);
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditingDevice(null);
  };

  const startEditingNode = (nodeIndex) => {
    setEditingNodeIndex(nodeIndex);
    const nodeToEdit = {
      n: devices[selectedDevice].ns[nodeIndex].n,
      a: parseInt(devices[selectedDevice].ns[nodeIndex].a),
      fc: parseInt(devices[selectedDevice].ns[nodeIndex].fc),
      dt: parseInt(devices[selectedDevice].ns[nodeIndex].dt),
      t: parseInt(devices[selectedDevice].ns[nodeIndex].t),
      er: Boolean(devices[selectedDevice].ns[nodeIndex].er),
      vr: parseInt(devices[selectedDevice].ns[nodeIndex].vr),
      fo: devices[selectedDevice].ns[nodeIndex].fo || "",
      em: Boolean(devices[selectedDevice].ns[nodeIndex].em),
      ma: parseInt(devices[selectedDevice].ns[nodeIndex].ma),
    };
    setEditingNode(nodeToEdit);
  };

  const saveNodeEdit = (nodeIndex) => {
    if (
      !editingNode.n ||
      !editingNode.a ||
      !editingNode.fc ||
      !editingNode.dt ||
      !editingNode.t
    ) {
      alert("Please fill in all node fields");
      return;
    }

    // Check if node name is unique across all devices (excluding current node)
    if (
      !isNodeNameUniqueAcrossDevices(editingNode.n, selectedDevice, nodeIndex)
    ) {
      alert(
        "A node with this name already exists in any device. Please use a unique name."
      );
      return;
    }

    const updatedDevices = devices.map((device, index) => {
      if (index === selectedDevice) {
        const updatedNodes = [...device.ns];
        updatedNodes[nodeIndex] = editingNode;
        return { ...device, ns: updatedNodes };
      }
      return device;
    });

    setDevices(updatedDevices);
    setEditingNodeIndex(null);
    setEditingNode(null);
  };

  const cancelNodeEdit = () => {
    setEditingNodeIndex(null);
    setEditingNode(null);
  };

  // Add new function to generate unique device name
  const generateUniqueDeviceName = () => {
    let baseName = "Device";
    let counter = 1;
    let newName = `${baseName}${counter}`;

    while (!isDeviceNameUnique(newName)) {
      counter++;
      newName = `${baseName}${counter}`;
    }

    return newName;
  };

  // Add new function to generate unique node name
  const generateUniqueNodeName = (deviceIndex) => {
    let baseName = "Node";
    let counter = 1;
    let newName = `${baseName}${deviceIndex + 1}${counter}`;

    while (!isNodeNameUnique(newName, deviceIndex)) {
      counter++;
      newName = `${baseName}${deviceIndex + 1}${counter}`;
    }

    return newName;
  };

  // Update handleAddDevice to use unique name
  const handleAddDevice = () => {
    if (devices.length >= CONFIG.MAX_DEVICES) {
      alert(
        `Maximum number of devices (${CONFIG.MAX_DEVICES}) reached. Cannot add more devices.`
      );
      return;
    }

    const uniqueName = generateUniqueDeviceName();
    setNewDevice({
      n: uniqueName,
      da: 1,
      pi: 1000,
      g: false,
      p: 0,
      pr: 0,
      em: false,
      ma: 1,
      sa: "",
      sp: 502,
    });
    setIsAddingDevice(true);
  };

  // Update handleAddNode to use unique name
  const handleAddNode = () => {
    if (selectedDevice === null) {
      alert("Please select a device first");
      return;
    }

    if (totalNodes >= CONFIG.MAX_TOTAL_NODES) {
      alert(
        `Maximum total number of nodes (${CONFIG.MAX_TOTAL_NODES}) reached across all devices. Cannot add more nodes.`
      );
      return;
    }

    const uniqueName = generateUniqueNodeName(selectedDevice);
    setNewNode({
      n: uniqueName, // Node name
      a: 1, // Address
      fc: devices[selectedDevice].p === 4 ? 4 : 1, // Function code
      dt: 1, // Data type
      t: 1000, // Timeout
      er: false, // Enable reporting
      vr: 1, // Variation range
      em: false, // Enable mapping
      ma: 1, // Mapped address
      fo: "", // Formula
    });
    setIsAddingNode(true);
  };

  // Add new function to handle cancel add device
  const handleCancelAddDevice = () => {
    setIsAddingDevice(false);
    setNewDevice({
      n: "", // Device name
      da: 1, // Slave address
      pi: 1000, // Polling interval
      g: false, // Group address
      p: 0, // Port
      pr: 0, // Protocol
      em: false, // Enable mapping
      ma: 1, // Mapped address
      sa: "", // Server address
      sp: 502, // Server port
    });
  };

  // Add new function to handle cancel add node
  const handleCancelAddNode = () => {
    setIsAddingNode(false);
    setNewNode({
      n: "",
      a: 1,
      fc: 1,
      dt: 1,
      t: 1000,
      er: false,
      vr: 1,
      em: false,
      ma: 1,
      fo: "",
    });
  };

  // Update handleEventInputChange to handle the new key names
  const handleEventInputChange = (e) => {
    const { name, value, type, checked } = e.target;

    // Handle checkbox inputs
    if (type === "checkbox") {
      setNewEvent((prev) => ({
        ...prev,
        [name]: checked,
      }));
      return;
    }

    // Handle numeric fields
    if (["c", "sc", "mi", "ut", "lt", "te", "ta"].includes(name)) {
      setNewEvent((prev) => ({
        ...prev,
        [name]: parseInt(value) || 0,
      }));
      return;
    }

    // Handle select and other inputs
    setNewEvent((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Add function to check if event name is unique
  const isEventNameUnique = (name, excludeId = null) => {
    return !events.some(
      (event) =>
        event.id !== excludeId && event.n.toLowerCase() === name.toLowerCase()
    );
  };

  // Update handleEventSubmit to use new key names
  const handleEventSubmit = (e) => {
    e.preventDefault();

    // Validate required fields
    if (!newEvent.n.trim()) {
      setEventError("Event name is required");
      return;
    }
    if (!newEvent.p) {
      setEventError("Trigger point is required");
      return;
    }
    if (!newEvent.sc) {
      setEventError("Scanning cycle is required");
      return;
    }
    if (!newEvent.mi) {
      setEventError("Minimum trigger interval is required");
      return;
    }

    // Validate thresholds based on trigger condition
    const condition = parseInt(newEvent.c);
    if ([3, 5, 6, 7].includes(condition) && newEvent.ut === undefined) {
      setEventError("Upper threshold is required for this trigger condition");
      return;
    }
    if ([4, 5, 6, 8].includes(condition) && newEvent.lt === undefined) {
      setEventError("Lower threshold is required for this trigger condition");
      return;
    }

    // Check for unique event name
    if (!isEventNameUnique(newEvent.n, editingEventId)) {
      setEventError("An event with this name already exists");
      return;
    }

    if (editingEventId) {
      // Update existing event
      setEvents((prev) =>
        prev.map((event) =>
          event.id === editingEventId
            ? { ...newEvent, id: editingEventId }
            : event
        )
      );
    } else {
      // Check event limit before adding new event
      if (events.length >= 10) {
        setEventError(
          "Maximum number of events (10) reached. Cannot add more events."
        );
        return;
      }
      // Add new event
      setEvents((prev) => [...prev, { ...newEvent, id: Date.now() }]);
    }
    setIsAddingEvent(false);
    setEditingEventId(null);
    setEventError("");
    setNewEvent({
      n: "",
      e: true,
      c: 1,
      p: "",
      sc: 100,
      mi: 1000,
      ut: 20000,
      lt: 0,
      te: 1,
      ta: 1,
      d: "",
    });
  };

  // Update startEditingEvent to use new key names
  const startEditingEvent = (event) => {
    setEditingEventId(event.id);
    setNewEvent({
      n: event.n,
      e: event.e,
      c: event.c,
      p: event.p,
      sc: event.sc,
      mi: event.mi,
      ut: event.ut,
      lt: event.lt,
      te: event.te,
      ta: event.ta,
      d: event.d,
    });
  };

  // Update handleCancelAddEvent to use new key names
  const handleCancelAddEvent = () => {
    setIsAddingEvent(false);
    setEditingEventId(null);
    setNewEvent({
      n: "",
      e: true,
      c: 1,
      p: "",
      sc: 100,
      mi: 1000,
      ut: 20000,
      lt: 0,
      te: 1,
      ta: 1,
      d: "",
    });
  };

  // Add function to delete event
  const deleteEvent = (eventId) => {
    if (confirm("Are you sure you want to delete this event?")) {
      setEvents((prev) => prev.filter((event) => event.id !== eventId));
    }
  };

  // Add new function to handle report config changes
  const handleReportConfigChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (type === "checkbox") {
      setReportConfig((prev) => ({
        ...prev,
        [name]: checked,
      }));
      return;
    }

    if (type === "number" || type === "select-one") {
      setReportConfig((prev) => ({
        ...prev,
        [name]: parseInt(value) || 0,
      }));
      return;
    }

    // Special handling for jsonTemplate
    if (name === "jsonTemplate") {
      const bytes = getStringBytes(value);
      if (bytes > CONFIG.MAX_JSON_TEMPLATE_BYTES) {
        setJsonTemplateError(
          `Template exceeds maximum size of ${CONFIG.MAX_JSON_TEMPLATE_BYTES} bytes`
        );
        return;
      }
      if (!validateJSON(value) && value !== "") {
        setJsonTemplateError("Invalid JSON format");
        return;
      }
      setJsonTemplateError("");
    }

    setReportConfig((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Add new function to handle time input
  const handleTimeChange = (e) => {
    const timeValue = e.target.value;
    setReportConfig((prev) => ({
      ...prev,
      regularFixedTime: timeValue,
    }));
  };

  // Add function to calculate string bytes
  const getStringBytes = (str) => {
    return new TextEncoder().encode(str).length;
  };

  // Add function to validate JSON
  const validateJSON = (str) => {
    try {
      JSON.parse(str);
      return true;
    } catch (e) {
      return false;
    }
  };

  const AddDeviceModal = ({
    isOpen,
    onClose,
    onSubmit,
    newDevice,
    setNewDevice,
    devices,
    maxDevices,
  }) => {
    if (!isOpen) return null;
    const handleSubmit = (e) => {
      e.preventDefault();
      // const errors = validateDeviceConfig(newDevice);

      // if (errors.length > 0) {
      //   alert(errors.join("\n"));
      //   return;
      // }
      onSubmit(e);
    };

    const handleDevicePortChange = (e) => {
      const selectedPort = parseInt(e.target.value);
      if (selectedPort === 3) {
        setNewDevice((prev) => ({
          ...prev,
          n: "IO",
          p: selectedPort,
          pr: 0,
          da: 100,
        }));
      } else if (selectedPort === 4) {
        setNewDevice((prev) => ({
          ...prev,
          n: "VIRTUAL",
          p: selectedPort,
          pr: 0,
        }));
      } else {
        setNewDevice((prev) => ({
          ...prev,
          p: selectedPort,
        }));
      }
    };

    return html`
      <div
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      >
        <div
          class="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
        >
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-medium text-gray-900">Add New Device</h3>
            <button
              onClick=${onClose}
              class="text-gray-400 hover:text-gray-500"
            >
              <${Icons.CloseIcon} className="h-5 w-5" />
            </button>
          </div>
          <form onSubmit=${handleSubmit} class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              ${Input({
                type: "text",
                label: "Device Name",
                extra: `${newDevice.n.length}/20`,
                name: "n",
                value: newDevice.n,
                onChange: handleInputChange,
                required: true,
                disabled: newDevice.p > 2,
                maxLength: 20,
              })}
              ${Select({
                label: "Port",
                name: "p",
                value: newDevice.p,
                onChange: handleDevicePortChange,
                required: true,
                options: CONFIG.PORT_OPTIONS,
              })}
            </div>
            <div class="grid grid-cols-2 gap-4">
              ${Select({
                label: "Protocol",
                name: "pr",
                value: newDevice.pr,
                onChange: handleInputChange,
                required: true,
                options: CONFIG.PROTOCOL_TYPES,
                disabled: newDevice.p > 2,
              })}
              ${Input({
                type: "number",
                label: "Slave Address",
                extra: "(1-255)",
                name: "da",
                value: newDevice.da,
                onChange: handleInputChange,
                required: true,
                disabled: newDevice.p === 3,
                min: 1,
                max: 255,
              })}
            </div>
            <div class="grid grid-cols-2 gap-4">
              ${Input({
                type: "number",
                label: "Polling Interval",
                extra: "(100-65535)ms",
                name: "pi",
                value: newDevice.pi,
                onChange: handleInputChange,
                required: true,
                min: 10,
                max: 65535,
                step: 10,
              })}
              ${Checkbox({
                label: "Merge Collection",
                name: "g",
                value: newDevice.g,
                onChange: handleInputChange,
              })}
            </div>
            <div class="grid grid-cols-2 gap-4">
              ${Checkbox({
                label: "Enable Address Mapping",
                name: "em",
                value: newDevice.em,
                onChange: handleInputChange,
              })}
              ${newDevice.em &&
              html`
                ${Input({
                  type: "number",
                  label: "Mapped Slave Address",
                  extra: "(1-255)",
                  name: "ma",
                  value: newDevice.ma,
                  onChange: handleInputChange,
                  required: newDevice.em,
                  min: 1,
                  max: 255,
                })}
              `}
            </div>
            <div class="grid grid-cols-2 gap-4">
              ${newDevice.p === 2 &&
              html`
                ${Input({
                  type: "text",
                  label: "Server Address",
                  name: "sa",
                  value: newDevice.sa,
                  onChange: handleInputChange,
                  required: newDevice.p === 2,
                  maxlength: 64,
                  required: newDevice.p === 2,
                })}
                ${Input({
                  type: "number",
                  label: "Server Port",
                  extra: "(255-65535)",
                  name: "sp",
                  value: newDevice.sp,
                  onChange: handleInputChange,
                  required: newDevice.p === 2,
                  min: 255,
                  max: 65535,
                })}
              `}
            </div>
            <div class="flex justify-center space-x-3 mt-6">
              <button
                type="button"
                onClick=${onClose}
                class="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Add Device
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  };

  const EditDeviceModal = ({
    isOpen,
    onClose,
    onSubmit,
    editingDevice,
    setEditingDevice,
    deviceIndex,
  }) => {
    // Return null if modal is not open or editingDevice is null
    if (!isOpen || !editingDevice) return null;

    const handleSubmit = (e) => {
      e.preventDefault();

      // const errors = validateDeviceConfig(editingDevice, deviceIndex);

      // if (errors.length > 0) {
      //   alert(errors.join("\n"));
      //   return;
      // }

      onSubmit(deviceIndex);
    };

    const handleDevicePortChange = (e) => {
      const selectedPort = parseInt(e.target.value);
      if (selectedPort === 3) {
        setEditingDevice((prev) => ({
          ...prev,
          n: "IO",
          p: selectedPort,
        }));
      } else if (selectedPort === 4) {
        setEditingDevice((prev) => ({
          ...prev,
          n: "VIRTUAL",
          p: selectedPort,
        }));
      } else {
        setEditingDevice((prev) => ({
          ...prev,
          p: selectedPort,
        }));
      }
    };

    return html`
      <div
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      >
        <div
          class="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
        >
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-medium text-gray-900">Edit Device</h3>
            <button
              onClick=${onClose}
              class="text-gray-400 hover:text-gray-500"
            >
              <${Icons.CloseIcon} className="h-5 w-5" />
            </button>
          </div>
          <form onSubmit=${handleSubmit} class="space-y-4">
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              ${Input({
                type: "text",
                label: "Device Name",
                extra: `${editingDevice.n.length}/20`,
                name: "n",
                value: editingDevice.n,
                onChange: handleEditInputChange,
                required: true,
                disabled: editingDevice.p > 2,
                maxLength: 20,
              })}
              ${Select({
                label: "Port",
                name: "p",
                value: editingDevice.p,
                onChange: handleDevicePortChange,
                required: true,
                options: CONFIG.PORT_OPTIONS,
              })}
            </div>
            <div class="grid grid-cols-2 gap-4">
              ${Select({
                label: "Protocol",
                name: "pr",
                value: editingDevice.pr,
                onChange: handleInputChange,
                required: true,
                options: CONFIG.PROTOCOL_TYPES,
              })}
              ${Input({
                type: "number",
                label: "Slave Address",
                extra: "(1-255)",
                name: "da",
                value: editingDevice.da,
                onChange: handleInputChange,
                required: true,
                min: 1,
                max: 255,
              })}
            </div>

            <div class="grid grid-cols-2 gap-4">
              ${Input({
                type: "number",
                label: "Polling Interval",
                extra: "(100-65535)ms",
                name: "pi",
                value: editingDevice.pi || 1000,
                onChange: handleEditInputChange,
                required: true,
                min: 10,
                max: 65535,
                step: 10,
              })}
              ${Checkbox({
                label: "Merge Collection",
                name: "g",
                value: editingDevice.g,
                onChange: handleEditInputChange,
              })}
            </div>
            <div class="grid grid-cols-2 gap-4">
              ${Checkbox({
                label: "Enable Address Mapping",
                name: "em",
                value: editingDevice.em,
                onChange: handleEditInputChange,
              })}
              ${editingDevice.em &&
              html`
                ${Input({
                  type: "number",
                  label: "Mapped Slave Address",
                  extra: "(1-255)",
                  name: "ma",
                  value: editingDevice.ma,
                  onChange: handleEditInputChange,
                  required: editingDevice.em,
                  min: 1,
                  max: 255,
                })}
              `}
            </div>
            <div class="grid grid-cols-2 gap-4">
              ${editingDevice.p === 2 &&
              html`
                ${Input({
                  type: "text",
                  label: "Server Address",
                  name: "sa",
                  value: editingDevice.sa,
                  onChange: handleEditInputChange,
                  required: editingDevice.p === 2,
                  maxlength: 64,
                })}
                ${Input({
                  type: "number",
                  label: "Server Port",
                  extra: "(255-65535)",
                  name: "sp",
                  value: editingDevice.sp,
                  onChange: handleEditInputChange,
                  required: editingDevice.p === 2,
                  min: 255,
                  max: 65535,
                })}
              `}
            </div>
            <div class="flex justify-center space-x-3 mt-6">
              <button
                type="button"
                onClick=${onClose}
                class="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  };

  const AddNodeModal = ({
    isOpen,
    onClose,
    onSubmit,
    newNode,
    setNewNode,
    totalNodes,
    maxNodes,
    devicePort,
  }) => {
    if (!isOpen) return null;

    const handleSubmit = (e) => {
      e.preventDefault();
      e.stopPropagation();

      onSubmit(e);
    };

    // console.log(newNode);

    const handleNodeNameChange = (e) => {
      const selectedName = e.target.value;
      if (devicePort === 3) {
        const selectedOption = IO_NODE_OPTIONS.find(
          (opt) => opt.name === selectedName
        );

        if (selectedOption) {
          setNewNode((prev) => ({
            ...prev,
            n: selectedName,
            a: selectedOption.ra,
            fc: selectedOption.fc,
            dt: selectedOption.dt,
          }));
        }
      } else {
        setNewNode((prev) => ({
          ...prev,
          n: selectedName,
        }));
      }
    };

    return html`
      <div
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      >
        <div
          class="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
        >
          <div class="px-6 py-4 border-b border-gray-200">
            <div class="flex justify-between items-center">
              <h3 class="text-lg font-semibold">
                Add New Node
                ${totalNodes >= maxNodes
                  ? html`<span class="text-red-500 text-sm font-normal ml-2">
                      (Maximum nodes limit reached)
                    </span>`
                  : html`<span class="text-gray-500 text-sm font-normal ml-2">
                      (${maxNodes - totalNodes} nodes remaining)
                    </span>`}
              </h3>
              <button
                onClick=${onClose}
                class="text-gray-400 hover:text-gray-500 focus:outline-none"
              >
                <svg
                  class="h-6 w-6"
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
              </button>
            </div>
          </div>
          <div class="px-6 py-4">
            <form onSubmit=${handleSubmit} class="space-y-4">
              <div class="grid grid-cols-2 gap-4">
                ${devicePort == 3
                  ? html`
                      ${Select({
                        label: "Node Name",
                        extra: `${newNode.n.length}/20`,
                        name: "n",
                        value: newNode.n,
                        onChange: handleNodeNameChange,
                        required: true,
                        options_extra: IO_NODE_OPTIONS.map((opt) => ({
                          value: opt.name,
                          label: opt.name,
                        })),
                        required: true,
                      })}
                    `
                  : html`
                      ${Input({
                        type: "text",
                        label: "Node Name",
                        extra: `${newNode.n.length}/20`,
                        name: "n",
                        value: newNode.n,
                        onChange: handleNodeInputChange,
                        required: true,
                        maxlength: CONFIG.MAX_NAME_LENGTH,
                        placeholder: "Node name",
                      })}
                    `}
                ${Select({
                  label: "Function Code",
                  name: "fc",
                  value: newNode.fc,
                  onChange: handleNodeInputChange,
                  required: true,
                  options: CONFIG.FUNCTION_CODES,
                  disabled:
                    (devicePort === 3 &&
                      IO_NODE_OPTIONS.some((opt) => opt.name === newNode.n)) ||
                    devicePort === 4,
                })}
              </div>
              <div class="grid grid-cols-2 gap-4">
                ${Input({
                  type: "text",
                  label: "Register Address",
                  extra: "(0-65535)",
                  name: "a",
                  value: newNode.a,
                  onChange: handleNodeInputChange,
                  required: true,
                  placeholder: "Register address",
                  disabled:
                    devicePort === 3 &&
                    IO_NODE_OPTIONS.some((opt) => opt.name === newNode.n),
                })}
                ${Select({
                  label: "Data Type",
                  name: "dt",
                  value: newNode.dt,
                  onChange: handleNodeInputChange,
                  required: true,
                  options: CONFIG.DATA_TYPES,
                  disabled:
                    devicePort === 3 &&
                    IO_NODE_OPTIONS.some((opt) => opt.name === newNode.n),
                })}
              </div>
              <div class="grid grid-cols-2 gap-4">
                ${Input({
                  type: "number",
                  label: "Timeout",
                  extra: "(100-65535)ms",
                  name: "t",
                  value: newNode.t,
                  onChange: handleNodeInputChange,
                  required: true,
                  min: CONFIG.MIN_TIMEOUT,
                  max: CONFIG.MAX_TIMEOUT,
                  placeholder: "Timeout",
                })}
              </div>
              <div class="grid grid-cols-2 gap-4">
                ${Checkbox({
                  label: "Reporting on Change",
                  name: "er",
                  value: newNode.er,
                  onChange: handleNodeInputChange,
                })}
                ${newNode.er &&
                html`
                  ${Input({
                    type: "number",
                    label: "Variation Range",
                    extra: "(1-65535)",
                    name: "vr",
                    value: newNode.vr,
                    onChange: handleNodeInputChange,
                    min: 1,
                    max: 65535,
                    placeholder: "Variation range",
                    required: newNode.er,
                  })}
                `}
              </div>
              <div class="grid grid-cols-2 gap-4">
                ${Checkbox({
                  label: "Enable Address Mapping",
                  name: "em",
                  value: newNode.em,
                  onChange: handleNodeInputChange,
                })}
                ${newNode.em &&
                html`
                  ${Input({
                    type: "number",
                    label: "Mapped Slave Address",
                    extra: "(0-65534)",
                    name: "ma",
                    value: newNode.ma,
                    onChange: handleNodeInputChange,
                    required: newNode.em,
                    min: 0,
                    max: 65534,
                    placeholder: "Mapped slave address",
                  })}
                `}
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div class="col-span-2">
                  ${Input({
                    type: "text",
                    label: "Calculation Formula",
                    name: "fo",
                    extra: `${newNode.fo ? newNode.fo.length : 0}/20`,
                    value: newNode.fo,
                    onChange: handleNodeInputChange,
                    maxlength: 20,
                    placeholder: "Enter calculation formula",
                    note: "The collected data is calculated by the formula and then uploaded. For example, collected value plus 100: <code class='text-blue-500'>node1+100</code>",
                  })}
                </div>
              </div>
              <div class="flex justify-center space-x-3 mt-6">
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
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
  };

  // EditNodeModal component
  const EditNodeModal = ({
    isOpen,
    onClose,
    onSubmit,
    editingNode,
    setEditingNode,
    nodeIndex,
    devicePort,
  }) => {
    if (!isOpen) return null;

    const handleSubmit = (e) => {
      e.preventDefault();
      e.stopPropagation();
      // const errors = validateDeviceConfig(editingNode, nodeIndex);
      // if (errors.length > 0) {
      //   console.error("Validation errors:", errors);
      //   return;
      // }
      onSubmit(nodeIndex);
    };

    const handleNodeNameChange = (e) => {
      const selectedName = e.target.value;
      if (devicePort === 3) {
        const selectedOption = IO_NODE_OPTIONS.find(
          (opt) => opt.name === selectedName
        );

        if (selectedOption) {
          setNewNode((prev) => ({
            ...prev,
            n: selectedName,
            a: selectedOption.ra,
            fc: selectedOption.fc,
            dt: selectedOption.dt,
          }));
        }
      } else {
        setNewNode((prev) => ({
          ...prev,
          n: selectedName,
        }));
      }
    };

    return html`
      <div
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      >
        <div
          class="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
        >
          <div class="px-6 py-4 border-b border-gray-200">
            <div class="flex justify-between items-center">
              <h3 class="text-lg font-semibold">Edit Node</h3>
              <button
                onClick=${onClose}
                class="text-gray-400 hover:text-gray-500 focus:outline-none"
              >
                <svg
                  class="h-6 w-6"
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
              </button>
            </div>
          </div>
          <div class="px-6 py-4">
            <form onSubmit=${handleSubmit} class="space-y-4">
              <div class="grid grid-cols-2 gap-4">
                ${devicePort == 3
                  ? html`
                      ${Select({
                        label: "Node Name",
                        extra: `${editingNode.n.length}/20`,
                        name: "n",
                        value: editingNode.n,
                        onChange: handleNodeNameChange,
                        required: true,
                        options_extra: IO_NODE_OPTIONS.map((opt) => ({
                          value: opt.name,
                          label: opt.name,
                        })),
                        required: true,
                      })}
                    `
                  : html`
                      ${Input({
                        type: "text",
                        label: "Node Name",
                        extra: `${editingNode.n.length}/20`,
                        name: "n",
                        value: editingNode.n,
                        onChange: handleNodeNameChange,
                        required: true,
                        maxlength: CONFIG.MAX_NAME_LENGTH,
                        placeholder: "Node name",
                      })}
                    `}
                ${Select({
                  label: "Function Code",
                  name: "fc",
                  value: editingNode.fc,
                  onChange: handleEditNodeInputChange,
                  required: true,
                  options: CONFIG.FUNCTION_CODES,
                  disabled:
                    devicePort === 3 &&
                    IO_NODE_OPTIONS.some((opt) => opt.name === editingNode.n),
                })}
              </div>
              <div class="grid grid-cols-2 gap-4">
                ${Input({
                  type: "text",
                  label: "Register Address",
                  extra: "(0-65535)",
                  name: "a",
                  value: editingNode.a,
                  onChange: handleEditNodeInputChange,
                  required: true,
                  placeholder: "Register address",
                  disabled:
                    devicePort === 3 &&
                    IO_NODE_OPTIONS.some((opt) => opt.name === editingNode.n),
                })}
                ${Select({
                  label: "Data Type",
                  name: "dt",
                  value: editingNode.dt,
                  onChange: handleEditNodeInputChange,
                  required: true,
                  options: CONFIG.DATA_TYPES,
                  disabled:
                    devicePort === 3 &&
                    IO_NODE_OPTIONS.some((opt) => opt.name === editingNode.n),
                })}
              </div>
              <div class="grid grid-cols-2 gap-4">
                ${Input({
                  type: "number",
                  label: "Timeout",
                  extra: "(100-65535)ms",
                  name: "t",
                  value: editingNode.t,
                  onChange: handleEditNodeInputChange,
                  required: true,
                  min: CONFIG.MIN_TIMEOUT,
                  max: CONFIG.MAX_TIMEOUT,
                  placeholder: "Timeout",
                })}
              </div>
              <div class="grid grid-cols-2 gap-4">
                ${Checkbox({
                  label: "Reporting on Change",
                  name: "er",
                  value: editingNode.er,
                  onChange: handleEditNodeInputChange,
                })}
                ${editingNode.er &&
                html`
                  ${Input({
                    type: "number",
                    label: "Variation Range",
                    extra: "(1-65535)",
                    name: "vr",
                    value: editingNode.vr,
                    onChange: handleEditNodeInputChange,
                    min: 1,
                    max: 65535,
                    placeholder: "Variation range",
                    required: editingNode.er,
                  })}
                `}
              </div>
              <div class="grid grid-cols-2 gap-4">
                ${Checkbox({
                  label: "Enable Address Mapping",
                  name: "em",
                  value: editingNode.em,
                  onChange: handleEditNodeInputChange,
                })}
                ${editingNode.em &&
                html`
                  ${Input({
                    type: "number",
                    label: "Mapped Slave Address",
                    extra: "(0-65534)",
                    name: "ma",
                    value: editingNode.ma,
                    onChange: handleEditNodeInputChange,
                    required: editingNode.em,
                    min: 0,
                    max: 65534,
                    placeholder: "Mapped slave address",
                  })}
                `}
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div class="col-span-2">
                  ${Input({
                    type: "text",
                    label: "Calculation Formula",
                    name: "fo",
                    extra: `${editingNode.fo ? editingNode.fo.length : 0}/20`,
                    value: editingNode.fo,
                    onChange: handleEditNodeInputChange,
                    maxlength: 20,
                    placeholder: "Enter calculation formula",
                    note: "The collected data is calculated by the formula and then uploaded. For example, collected value plus 100: <code class='text-blue-500'>node1+100</code>",
                  })}
                </div>
              </div>
              <div class="flex justify-center space-x-3 mt-6">
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
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
  };

  // Add Event Modal Component
  const AddEventModal = ({
    isOpen,
    onClose,
    onSubmit,
    newEvent,
    setNewEvent,
    events,
    getAllNodes,
    getThresholdVisibility,
    showTriggerAction,
    handleEventInputChange,
  }) => {
    if (!isOpen) return null;

    const handleSubmit = (e) => {
      e.preventDefault();
      e.stopPropagation();
      onSubmit(e);
    };

    return html`
      <div
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      >
        <div
          class="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
        >
          <div class="px-6 py-4 border-b border-gray-200">
            <div class="flex justify-between items-center">
              <h3 class="text-lg font-semibold">
                Add New Event
                ${events.length >= 10
                  ? html`<span class="text-red-500 text-sm font-normal ml-2">
                      (Maximum events limit reached)
                    </span>`
                  : html`<span class="text-gray-500 text-sm font-normal ml-2">
                      (${10 - events.length} events remaining)
                    </span>`}
              </h3>
              <button
                onClick=${onClose}
                class="text-gray-400 hover:text-gray-500 focus:outline-none"
              >
                <svg
                  class="h-6 w-6"
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
              </button>
            </div>
          </div>
          <div class="px-6 py-4">
            <form onSubmit=${handleSubmit} class="space-y-4">
              <div class="grid grid-cols-2 gap-4">
                ${Input({
                  type: "text",
                  label: "Event Name",
                  extra: `${newEvent.n.length}/20`,
                  name: "n",
                  value: newEvent.n,
                  onChange: handleEventInputChange,
                  required: true,
                  maxlength: 20,
                  placeholder: "Enter event name",
                })}
                ${Checkbox({
                  label: "Enable Event",
                  name: "e",
                  value: newEvent.e,
                  onChange: handleEventInputChange,
                })}
              </div>

              <div class="grid grid-cols-2 gap-4">
                ${Select({
                  label: "Trigger Condition",
                  name: "c",
                  value: newEvent.c,
                  onChange: handleEventInputChange,
                  required: true,
                  options: TRIGGER_CONDITIONS,
                })}
                ${Select({
                  label: "Trigger Point",
                  name: "p",
                  value: newEvent.p,
                  onChange: handleEventInputChange,
                  required: true,
                  disabled: getAllNodes.length === 0,
                  options_extra: getAllNodes,
                })}
              </div>

              <div class="grid grid-cols-2 gap-4">
                ${Input({
                  type: "number",
                  label: "Scanning Cycle",
                  extra: "(0-10000)ms",
                  name: "sc",
                  value: newEvent.sc,
                  onChange: handleEventInputChange,
                  required: true,
                  min: 0,
                  max: 10000,
                  step: 10,
                  placeholder: "Scanning cycle",
                })}
                ${Input({
                  type: "number",
                  label: "Min Trigger Interval",
                  extra: "(500-10000)ms",
                  name: "mi",
                  value: newEvent.mi,
                  onChange: handleEventInputChange,
                  required: true,
                  min: 500,
                  max: 10000,
                  step: 100,
                  placeholder: "Min trigger interval",
                })}
              </div>

              <div class="grid grid-cols-2 gap-4">
                ${Input({
                  type: "number",
                  label: "Upper Threshold",
                  name: "ut",
                  value: newEvent.ut,
                  onChange: handleEventInputChange,
                  placeholder: "Enter upper threshold",
                  required: [3, 5, 6, 7].includes(parseInt(newEvent.c)),
                  disabled: !getThresholdVisibility.showUpper,
                  note: "The threshold is a single point precision of 0-20000uA, and the other points are floating-point precision.",
                })}
                ${Input({
                  type: "number",
                  label: "Lower Threshold",
                  name: "lt",
                  value: newEvent.lt,
                  onChange: handleEventInputChange,
                  required: [4, 5, 6, 8].includes(parseInt(newEvent.c)),
                  disabled: !getThresholdVisibility.showLower,
                  placeholder: "Enter lower threshold",
                  note: "The threshold is a single point precision of 0-20000uA, and the other points are floating-point precision.",
                })}
              </div>

              <div class="grid grid-cols-2 gap-4">
                ${Select({
                  label: "Trigger Execution",
                  name: "te",
                  value: newEvent.te,
                  onChange: handleEventInputChange,
                  required: true,
                  options: TRIGGER_EXECUTIONS,
                })}
                ${showTriggerAction &&
                html`
                  ${Select({
                    label: "Trigger Action",
                    name: "ta",
                    value: newEvent.ta,
                    onChange: handleEventInputChange,
                    options: TRIGGER_ACTIONS,
                  })}
                `}
              </div>
              ${Input({
                type: "text",
                label: "Event Description",
                extra: `${newEvent.d.length}/20`,
                name: "d",
                value: newEvent.d,
                onChange: handleEventInputChange,
                placeholder: "Enter event description",
                maxlength: 20,
                required: true,
              })}

              <div class="flex justify-center space-x-3 mt-4">
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
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
  };

  // Edit Event Modal Component
  const EditEventModal = ({
    isOpen,
    onClose,
    onSubmit,
    editingEvent,
    setEditingEvent,
    getAllNodes,
    getThresholdVisibility,
    showTriggerAction,
    handleEventInputChange,
  }) => {
    if (!isOpen) return null;

    const handleSubmit = (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      onSubmit(e);
    };

    return html`
      <div
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      >
        <div
          class="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
        >
          <div class="px-6 py-4 border-b border-gray-200">
            <div class="flex justify-between items-center">
              <h3 class="text-lg font-semibold">Edit Event</h3>
              <button
                onClick=${onClose}
                class="text-gray-400 hover:text-gray-500 focus:outline-none"
              >
                <svg
                  class="h-6 w-6"
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
              </button>
            </div>
          </div>
          <div class="px-6 py-4">
            <form onSubmit=${handleSubmit} class="space-y-4">
              <div class="grid grid-cols-2 gap-4">
                ${Input({
                  type: "text",
                  label: "Event Name",
                  extra: `${editingEvent.n.length}/20`,
                  name: "n",
                  value: editingEvent.n,
                  onChange: handleEventInputChange,
                  required: true,
                  maxlength: 20,
                  placeholder: "Enter event name",
                })}
                ${Checkbox({
                  label: "Enable Event",
                  name: "e",
                  value: editingEvent.e,
                  onChange: handleEventInputChange,
                })}
              </div>

              <div class="grid grid-cols-2 gap-4">
                ${Select({
                  label: "Trigger Condition",
                  name: "c",
                  value: editingEvent.c,
                  onChange: handleEventInputChange,
                  options: TRIGGER_CONDITIONS,
                })}
                ${Select({
                  label: "Trigger Point",
                  name: "p",
                  value: editingEvent.p,
                  onChange: handleEventInputChange,
                  required: true,
                  disabled: getAllNodes.length === 0,
                  options_extra: getAllNodes,
                })}
              </div>

              <div class="grid grid-cols-2 gap-4">
                ${Input({
                  type: "number",
                  label: "Scanning Cycle",
                  extra: "(0-10000)ms",
                  name: "sc",
                  value: editingEvent.sc,
                  onChange: handleEventInputChange,
                  required: true,
                  min: 0,
                  max: 10000,
                  step: 10,
                  placeholder: "Scanning cycle",
                })}
                ${Input({
                  type: "number",
                  label: "Min Trigger Interval",
                  extra: "(500-10000)ms",
                  name: "mi",
                  value: editingEvent.mi,
                  onChange: handleEventInputChange,
                  required: true,
                  min: 500,
                  max: 10000,
                  step: 100,
                  placeholder: "Min trigger interval",
                })}
              </div>

              <div class="grid grid-cols-2 gap-4">
                ${Input({
                  type: "number",
                  label: "Upper Threshold",
                  name: "ut",
                  value: editingEvent.ut,
                  onChange: handleEventInputChange,
                  placeholder: "Enter upper threshold",
                  required: [3, 5, 6, 7].includes(parseInt(editingEvent.c)),
                  disabled: !getThresholdVisibility.showUpper,
                  note: "The threshold is a single point precision of 0-20000uA, and the other points are floating-point precision.",
                })}
                ${Input({
                  type: "number",
                  label: "Lower Threshold",
                  name: "lt",
                  value: editingEvent.lt,
                  onChange: handleEventInputChange,
                  required: [4, 5, 6, 8].includes(parseInt(editingEvent.c)),
                  placeholder: "Enter lower threshold",
                  disabled: !getThresholdVisibility.showLower,
                  note: "The threshold is a single point precision of 0-20000uA, and the other points are floating-point precision.",
                })}
              </div>

              ${Select({
                label: "Trigger Execution",
                name: "te",
                value: editingEvent.te,
                onChange: handleEventInputChange,
                required: true,
                options: TRIGGER_EXECUTIONS,
              })}
              ${showTriggerAction &&
              html`
                ${Select({
                  label: "Trigger Action",
                  name: "ta",
                  value: editingEvent.ta,
                  onChange: handleEventInputChange,
                  options: TRIGGER_ACTIONS,
                })}
              `}
              ${Input({
                type: "text",
                label: "Event Description",
                extra: `${editingEvent.d.length}/20`,
                name: "d",
                value: editingEvent.d,
                onChange: handleEventInputChange,
                placeholder: "Enter event description",
                maxlength: 20,
                required: true,
              })}

              <div class="flex justify-center space-x-3 mt-4">
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
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
  };

  const renderEdgeComputingTab = () => {
    return html`
      <div class="bg-white rounded-lg shadow-md p-6">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-semibold text-gray-800">
            Edge Computing Settings
          </h2>
        </div>
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Enable Edge Computing
              </label>
              <p class="text-sm text-gray-500">
                When disabled, all other tabs will be disabled and edge
                computing features will not be available.
              </p>
            </div>
            <div class="flex items-center">
              <button
                onClick=${() =>
                  setEdgeComputingEnabled(edgeComputingEnabled ? false : true)}
                class=${`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  edgeComputingEnabled ? "bg-blue-600" : "bg-gray-200"
                }`}
                disabled=${isSaving}
              >
                <span
                  class=${`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    edgeComputingEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>
          ${saveError &&
          html`
            <div
              class="p-4 bg-red-100 border border-red-400 text-red-700 rounded"
            >
              ${saveError}
            </div>
          `}
          ${saveSuccess &&
          html`
            <div
              class="p-4 bg-green-100 border border-green-400 text-green-700 rounded"
            >
              Edge computing status updated successfully!
            </div>
          `}
        </div>
      </div>
    `;
  };

  const renderDevicesTab = () => {
    return html`
      <!-- Device Configuration Tab Content -->
      <div>
        <!-- Add New Device Button -->
        <div class="mb-8 flex justify-between items-center">
          <h2 class="text-xl font-semibold">
            Device Configuration
            <span class="text-sm text-gray-500 font-normal">
              (${devices.length}/${CONFIG.MAX_DEVICES} devices)
            </span>
          </h2>
          <${Button}
            onClick=${handleAddDevice}
            disabled=${isAddingDevice || devices.length >= CONFIG.MAX_DEVICES}
            variant="primary"
            icon="PlusIcon"
          >
            Add Device
          <//>
        </div>

        <!-- Add New Device Form -->
        <${AddDeviceModal}
          isOpen=${isAddingDevice}
          onClose=${handleCancelAddDevice}
          onSubmit=${handleSubmit}
          newDevice=${newDevice}
          setNewDevice=${setNewDevice}
          devices=${devices}
          maxDevices=${CONFIG.MAX_DEVICES}
        />

        <${EditDeviceModal}
          isOpen=${editingIndex !== null}
          onClose=${cancelEdit}
          onSubmit=${saveEdit}
          editingDevice=${editingDevice}
          setEditingDevice=${setEditingDevice}
          deviceIndex=${editingIndex}
        />

        <!-- Devices Table -->
        <div class="bg-white rounded-lg shadow-md overflow-hidden mb-8">
          <table class="min-w-full divide-y divide-gray-200 table-fixed">
            <thead class="bg-gray-50">
              <tr>
                <${Th}>No.<//>
                <${Th}>Name<//>
                <${Th}>Port<//>
                <${Th}>Protocol<//>
                <${Th}>Slave Address<//>
                <${Th}>Polling Interval<//>
                <${Th}>Address Mapping<//>
                <${Th}>Merge Collection<//>
                <${Th}>Actions<//>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              ${devices.map(
                (device, index) => html`
                  <tr
                    key=${index}
                    class=${selectedDevice === index ? "bg-blue-50" : ""}
                    onClick=${() => setSelectedDevice(index)}
                    style="cursor: pointer;"
                  >
                    <td
                      class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                    >
                      ${index + 1}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">${device.n}</td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      ${CONFIG.PORT_OPTIONS.find(
                        ([value]) => value === device.p
                      )?.[1]}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      ${CONFIG.PROTOCOL_TYPES.find(
                        ([value]) => value === device.pr
                      )?.[1]}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">${device.da}</td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      ${`${device.pi} ms`}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      ${device.em ? "Yes" : "No"}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      ${device.g ? "Yes" : "No"}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap space-x-2">
                      <button
                        onClick=${(e) => {
                          e.stopPropagation();
                          startEditing(index);
                          setPrevDeviceName(device.n);
                        }}
                        class="text-blue-600 hover:text-blue-900 mr-2"
                      >
                        Edit
                      </button>
                      <button
                        onClick=${(e) => {
                          e.stopPropagation();
                          deleteDevice(index);
                        }}
                        class="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                `
              )}
            </tbody>
          </table>
        </div>

        ${selectedDevice !== null &&
        html`
          <div class="mt-8">
            <div class="flex justify-between items-center mb-4">
              <h2 class="text-xl font-semibold">
                Node Details for ${devices[selectedDevice].n}
                <span class="text-sm text-gray-500 font-normal">
                  (Device Nodes: ${selectedDeviceNodes.length}, Total Nodes:
                  ${totalNodes}/${CONFIG.MAX_TOTAL_NODES})
                </span>
              </h2>
              <${Button}
                onClick=${handleAddNode}
                disabled=${totalNodes >= CONFIG.MAX_TOTAL_NODES}
                variant="primary"
                icon="PlusIcon"
              >
                Add Node
              <//>
            </div>

            <${AddNodeModal}
              isOpen=${isAddingNode}
              onClose=${handleCancelAddNode}
              onSubmit=${handleNodeSubmit}
              newNode=${newNode}
              setNewNode=${setNewNode}
              totalNodes=${totalNodes}
              maxNodes=${CONFIG.MAX_TOTAL_NODES}
              devicePort=${devices[selectedDevice].p}
            />

            <${EditNodeModal}
              isOpen=${editingNodeIndex !== null}
              onClose=${cancelNodeEdit}
              onSubmit=${saveNodeEdit}
              editingNode=${editingNode}
              setEditingNode=${setEditingNode}
              nodeIndex=${editingNodeIndex}
              devicePort=${devices[selectedDevice].p}
            />

            <!-- Nodes Table -->
            <div class="bg-white rounded-lg shadow-md overflow-hidden">
              <table class="min-w-full divide-y divide-gray-200 table-fixed">
                <thead class="bg-gray-50">
                  <tr>
                    <${Th}>No.<//>
                    <${Th}>Name<//>
                    <${Th}>Register Address<//>
                    <${Th}>Function code<//>
                    <${Th}>Data type<//>
                    <${Th}>Timeout<//>
                    <${Th}>Actions<//>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  ${selectedDeviceNodes.map(
                    (node, nodeIndex) => html`
                      <tr key=${nodeIndex}>
                        <td
                          class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                        >
                          ${nodeIndex + 1}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">${node.n}</td>
                        <td class="px-6 py-4 whitespace-nowrap">${node.a}</td>
                        <td class="px-6 py-4 whitespace-nowrap">
                          ${CONFIG.FUNCTION_CODES.find(
                            ([value]) => value === node.fc
                          )?.[1]}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                          ${CONFIG.DATA_TYPES.find(
                            ([value]) => value === node.dt
                          )?.[1]}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                          ${node.t} ms
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                          <div class="flex space-x-2">
                            <button
                              onClick=${() => startEditingNode(nodeIndex)}
                              class="text-blue-600 hover:text-blue-900"
                            >
                              Edit
                            </button>
                            <button
                              onClick=${() => deleteNode(nodeIndex)}
                              class="text-red-600 hover:text-red-900"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    `
                  )}
                </tbody>
              </table>
            </div>
          </div>
        `}
      </div>
    `;
  };

  const renderReportTab = () => {
    return html`
      <!-- Data Report Tab Content -->
      <div class="max-w-[60%] mx-auto">
        <div class="space-y-4">
          <div class="bg-white rounded-lg shadow-md p-6">
            <div class="space-y-4">
              <div>
                <h2 class="text-xl font-semibold mb-4">Data channel</h2>

                <!-- Channel Selection -->
                ${Select({
                  name: "channel",
                  label: "Report Channel",
                  value: reportConfig.channel,
                  onChange: handleReportConfigChange,
                  options: CONFIG.REPORT_CHANNELS,
                })}
              </div>
            </div>
          </div>

          <!-- MQTT Configuration -->
          <div class="bg-white rounded-lg shadow-md p-6">
            <div class="space-y-4">
              <h2 class="text-xl font-semibold mb-4">Data Query/Set</h2>
              ${Checkbox({
                name: "mqttDataQuerySet",
                label: "Enable Data Query/Set",
                value: reportConfig.mqttDataQuerySet,
                onChange: handleReportConfigChange,
              })}
              ${reportConfig.mqttDataQuerySet &&
              html`
                ${Select({
                  name: "mqttQuerySetType",
                  label: "Query or Set Type",
                  value: reportConfig.mqttQuerySetType,
                  onChange: handleReportConfigChange,
                  options: CONFIG.QUERY_SET_TYPES,
                })}
              `}
              ${reportConfig.mqttDataQuerySet &&
              reportConfig.channel === 1 &&
              html`
                ${Input({
                  type: "text",
                  name: "mqttQuerySetTopic",
                  extra: `${reportConfig.mqttQuerySetTopic.length}/64`,
                  label: "Query or Set Topic",
                  value: reportConfig.mqttQuerySetTopic,
                  onChange: handleReportConfigChange,
                  maxlength: 64,
                  placeholder: "Enter query/set topic",
                })}
                ${Select({
                  name: "mqttQuerySetQos",
                  label: "Query or Set QoS",
                  value: reportConfig.mqttQuerySetQos,
                  onChange: handleReportConfigChange,
                  options: CONFIG.MQTT_QOS_OPTIONS,
                })}
                ${Input({
                  type: "text",
                  name: "mqttRespondTopic",
                  extra: `${reportConfig.mqttRespondTopic.length}/64`,
                  label: "Respond Topic",
                  value: reportConfig.mqttRespondTopic,
                  onChange: handleReportConfigChange,
                  maxlength: 64,
                  placeholder: "Enter respond topic",
                })}
                ${Checkbox({
                  name: "mqttRetainedMessage",
                  label: "Retained Message",
                  value: reportConfig.mqttRetainedMessage,
                  onChange: handleReportConfigChange,
                })}
              `}
            </div>
          </div>
          <div class="bg-white rounded-lg shadow-md p-6">
            <h2 class="text-xl font-semibold mb-4">Data Report of nodes</h2>
            <!-- Enable/Disable -->
            <div class="mb-4">
              ${Checkbox({
                name: "enabled",
                label: "Enable Data Reporting",
                value: reportConfig.enabled,
                onChange: handleReportConfigChange,
              })}
            </div>

            ${reportConfig.enabled &&
            html`
              <!-- MQTT Configuration -->
              ${reportConfig.channel === 1 &&
              html`
                <div class="mb-4 space-y-4">
                  ${Input({
                    type: "text",
                    name: "mqttTopic",
                    label: "Report Topic",
                    value: reportConfig.mqttTopic,
                    onChange: handleReportConfigChange,
                    maxlength: 64,
                    placeholder: "Enter report topic",
                  })}
                  ${Select({
                    name: "mqttQos",
                    label: "QoS Level",
                    value: reportConfig.mqttQos,
                    onChange: handleReportConfigChange,
                    options: CONFIG.MQTT_QOS_OPTIONS,
                  })}
                </div>
              `}

              <!-- Periodic Reporting -->
              <div class="mb-4 space-y-4">
                ${Checkbox({
                  name: "periodicEnabled",
                  label: "Enable Periodic Reporting",
                  value: reportConfig.periodicEnabled,
                  onChange: handleReportConfigChange,
                })}
                ${reportConfig.periodicEnabled &&
                html`
                  ${Input({
                    type: "number",
                    name: "periodicInterval",
                    extra: "(1-36000)s",
                    label: "Reporting Interval",
                    value: reportConfig.periodicInterval,
                    onChange: handleReportConfigChange,
                    min: 1,
                    max: 36000,
                  })}
                `}
              </div>

              <!-- Regular Reporting -->
              <div class="mb-4 space-y-4">
                ${Checkbox({
                  name: "regularEnabled",
                  label: "Enable Regular Reporting",
                  value: reportConfig.regularEnabled,
                  onChange: handleReportConfigChange,
                })}
                ${reportConfig.regularEnabled &&
                html`
                  ${Select({
                    name: "regularInterval",
                    label: "Regular Time",
                    value: reportConfig.regularInterval,
                    onChange: handleReportConfigChange,
                    options: CONFIG.REPORT_INTERVALS,
                  })}
                  ${reportConfig.regularInterval === 4 &&
                  html`
                    ${Input({
                      type: "time",
                      name: "regularFixedTime",
                      label: "Fixed Time",
                      value: reportConfig.regularFixedTime,
                      onChange: handleReportConfigChange,
                    })}
                  `}
                `}
              </div>

              <!-- Failure Padding -->
              <div class="mb-4 space-y-4">
                ${Checkbox({
                  name: "failurePaddingEnabled",
                  label: "Enable Failure Padding",
                  value: reportConfig.failurePaddingEnabled,
                  onChange: handleReportConfigChange,
                })}
                ${reportConfig.failurePaddingEnabled &&
                html`
                  ${Input({
                    type: "text",
                    name: "failurePaddingContent",
                    label: "Content of Padding",
                    value: reportConfig.failurePaddingContent,
                    onChange: handleReportConfigChange,
                    maxlength: 16,
                  })}
                `}
              </div>

              <!-- Quotation Mark -->
              <div class="mb-4">
                ${Checkbox({
                  name: "quotationMark",
                  label: "Quotation Mark",
                  value: reportConfig.quotationMark,
                  onChange: handleReportConfigChange,
                })}
              </div>

              <!-- JSON Template -->
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">
                  JSON Template
                  <span class="text-xs text-gray-500 ml-1">
                    (max ${CONFIG.MAX_JSON_TEMPLATE_BYTES} bytes)
                  </span>
                </label>
                <div class="relative">
                  <textarea
                    name="jsonTemplate"
                    value=${reportConfig.jsonTemplate}
                    onChange=${handleReportConfigChange}
                    rows="4"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter JSON template"
                  ></textarea>
                  <div class="absolute right-2 bottom-2 text-xs text-gray-500">
                    ${getStringBytes(
                      reportConfig.jsonTemplate
                    )}/${CONFIG.MAX_JSON_TEMPLATE_BYTES}
                    bytes
                  </div>
                </div>
                ${jsonTemplateError &&
                html`
                  <div class="mt-1 text-sm text-red-600">
                    ${jsonTemplateError}
                  </div>
                `}
                <div class="mt-1 text-xs text-gray-500">
                  Example format: {"device":"device1","value":"123"}
                </div>
              </div>
            `}
          </div>
        </div>
      </div>
    `;
  };

  const renderLinkageControlTab = () => {
    return html`
      <!-- Linkage Control Tab Content -->
      <div>
        <div class="flex items-center justify-between mb-8">
          <h2 class="text-xl font-semibold">
            Events
            <span class="text-sm text-gray-500 font-normal">
              (${events.length}/10 events configured)
            </span>
          </h2>
          <${Button}
            onClick=${() => setIsAddingEvent(true)}
            variant="primary"
            icon="PlusIcon"
            disabled=${isAddingEvent}
          >
            Add Event
          <//>
        </div>

        <${AddEventModal}
          isOpen=${isAddingEvent}
          onClose=${handleCancelAddEvent}
          onSubmit=${handleEventSubmit}
          newEvent=${newEvent}
          setNewEvent=${setNewEvent}
          events=${events}
          getAllNodes=${getAllNodes}
          getThresholdVisibility=${getThresholdVisibility}
          showTriggerAction=${showTriggerAction}
          handleEventInputChange=${handleEventInputChange}
        />

        <${EditEventModal}
          isOpen=${editingEventId !== null}
          onClose=${handleCancelAddEvent}
          onSubmit=${handleEventSubmit}
          editingEvent=${newEvent}
          setEditingEvent=${setNewEvent}
          getAllNodes=${getAllNodes}
          getThresholdVisibility=${getThresholdVisibility}
          showTriggerAction=${showTriggerAction}
          handleEventInputChange=${handleEventInputChange}
        />

        <!-- Events List -->
        <div class="bg-gray-50 rounded-lg">
          ${eventError &&
          html`
            <div
              class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded"
            >
              ${eventError}
            </div>
          `}
          <div class="bg-white rounded-lg shadow-md overflow-hidden">
            <table class="min-w-full divide-y divide-gray-200 table-fixed">
              <thead class="bg-gray-50">
                <tr>
                  <${Th}>Name<//>
                  <${Th}>Status<//>
                  <${Th}>Condition<//>
                  <${Th}>Trigger Point<//>
                  <${Th}>Trigger Action<//>
                  <${Th}>Execution<//>
                  <${Th}>Scan Cycle<//>
                  <${Th}>Min Trigger Time<//>
                  <${Th}>Actions<//>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                ${events.length === 0
                  ? html`
                      <tr>
                        <td
                          colspan="9"
                          class="px-6 py-4 text-sm text-gray-500 text-center"
                        >
                          No events configured yet.
                        </td>
                      </tr>
                    `
                  : events.map(
                      (event) => html`
                        <tr class="hover:bg-gray-50">
                          <td
                            class="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                          >
                            ${event.n}
                          </td>
                          <td class="px-6 py-4 whitespace-nowrap">
                            <span
                              class=${`px-2 py-1 text-xs rounded-full ${
                                event.e
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              ${event.e ? "Enabled" : "Disabled"}
                            </span>
                          </td>
                          <td
                            class="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                          >
                            ${getTriggerConditionLabel(event.c)}
                          </td>
                          <td
                            class="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                          >
                            ${event.p}
                          </td>
                          <td
                            class="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                          >
                            ${event.c === 1 || event.c === 2
                              ? "No Action"
                              : getTriggerActionLabel(event.ta)}
                          </td>
                          <td
                            class="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                          >
                            ${getTriggerExecutionLabel(event.te)}
                          </td>
                          <td
                            class="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                          >
                            ${event.sc}
                          </td>
                          <td
                            class="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                          >
                            ${event.mi}
                          </td>
                          <td
                            class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                          >
                            <div class="flex space-x-2">
                              <button
                                onClick=${(e) => {
                                  e.stopPropagation();
                                  startEditingEvent(event);
                                }}
                                class="text-blue-600 hover:text-blue-900"
                              >
                                Edit
                              </button>
                              <button
                                onClick=${(e) => {
                                  e.stopPropagation();
                                  deleteEvent(event.id);
                                }}
                                class="text-red-600 hover:text-red-900"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      `
                    )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  };

  // Update useEffect to only call fetchDeviceConfig
  useEffect(() => {
    document.title = "SBIOT-Devices";
    fetchDeviceConfig();
  }, []);

  // console.log(edgeComputingEnabled);

  // console.table(devices);
  // console.table(events);

  // console.table(reportConfig);
  // Update the tabs array to include Edge Computing
  const tabs = [
    {
      id: "edge-computing",
      label: "EDGE COMPUTING",
    },
    {
      id: "devices",
      label: "DATA ACQUISITION",
      disabled: edgeComputingEnabled === false,
    },
    {
      id: "report",
      label: "DATA QUERY AND REPORT",
      disabled: edgeComputingEnabled === false,
    },
    {
      id: "linkage-control",
      label: "LINKAGE CONTROL",
      disabled: edgeComputingEnabled === false,
    },
  ];

  if (isLoading) {
    return html`
      <div class="p-6">
        <h1 class="text-2xl font-bold mb-6">Devices Management</h1>
        <div class="flex items-center justify-center h-full">
          <${Icons.SpinnerIcon} className="h-8 w-8 text-blue-600" />
        </div>
      </div>
    `;
  }

  return html`
    <div class="p-6">
      <h1 class="text-2xl font-bold mb-6">Devices Management</h1>

      ${loadError &&
      html`
        <div
          class="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded flex items-center justify-between"
        >
          <div>${loadError}</div>
          <button
            onClick=${fetchDeviceConfig}
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
          Device configuration saved successfully! System will reboot to apply
          changes...
        </div>
      `}

      <${Tabs}
        tabs=${tabs}
        activeTab=${activeTab}
        onTabChange=${setActiveTab}
      />

      ${activeTab === "edge-computing" && renderEdgeComputingTab()}
      ${activeTab === "devices" && renderDevicesTab()}
      ${activeTab === "report" && renderReportTab()}
      ${activeTab === "linkage-control" && renderLinkageControlTab()}

      <!-- Save and Cancel Buttons -->
      <div
        class="mt-8 border-t border-gray-200 pt-6 pb-4 flex justify-end gap-4"
      >
        <${Button}
          onClick=${() => {
            if (confirm("Are you sure you want to discard all changes?")) {
              fetchDeviceConfig();
            }
          }}
          variant="secondary"
          icon="CloseIcon"
          disabled=${isSaving}
        >
          Cancel
        <//>
        <${Button}
          onClick=${saveDeviceConfig}
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

export default Devices;
