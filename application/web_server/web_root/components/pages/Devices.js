"use strict";
import { h, html, useState, useEffect, useMemo } from "../../bundle.js";
import { Icons, Button, Tabs } from "../Components.js";

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
    [2, "Socket"],
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
    [1, "SERIAL1"],
    [2, "SERIAL2"],
    [3, "ETHERNET"],
    [4, "IO"],
    [5, "VIRTUAL"],
  ],
  PROTOCOL_TYPES: [
    [0, "Modbus"],
    [1, "DL/T645"],
  ],
};

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

  // Form states
  const [newDevice, setNewDevice] = useState({
    n: "",
    da: 1,
    pi: 1000,
    g: false,
    port: 1,
    protocol: 0,
    enableMap: false,
    mapDa: 1,
  });
  const [newNode, setNewNode] = useState({
    n: "",
    a: 1,
    f: 1,
    dt: 1,
    t: 1000,
    reportOnChange: false,
    variationRange: 1,
    enableNodeMap: false,
    mapNodeAddress: 0,
    formula: "",
  });
  const [newEvent, setNewEvent] = useState({
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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch("/api/devices/set", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(devices),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(
          `Failed to save device configuration: ${response.statusText}`
        );
      }

      // Save events configuration
      const eventsController = new AbortController();
      const eventsTimeoutId = setTimeout(() => eventsController.abort(), 10000);

      const eventsResponse = await fetch("/api/event/set", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(events),
        signal: eventsController.signal,
      });

      clearTimeout(eventsTimeoutId);

      if (!eventsResponse.ok) {
        throw new Error(
          `Failed to save events configuration: ${eventsResponse.statusText}`
        );
      }

      // Save report configuration
      const reportController = new AbortController();
      const reportTimeoutId = setTimeout(() => reportController.abort(), 10000);

      const reportResponse = await fetch("/api/report/set", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatedReportConfig),
        signal: reportController.signal,
      });

      clearTimeout(reportTimeoutId);

      if (!reportResponse.ok) {
        throw new Error(
          `Failed to save report configuration: ${reportResponse.statusText}`
        );
      }

      // Call reboot API after successful save
      const rebootController = new AbortController();
      const rebootTimeoutId = setTimeout(() => rebootController.abort(), 10000);

      const rebootResponse = await fetch("/api/reboot/set", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: rebootController.signal,
      });

      clearTimeout(rebootTimeoutId);

      if (!rebootResponse.ok) {
        throw new Error("Failed to reboot server");
      }

      setSaveSuccess(true);
      setIsSaving(false);

      // Show success message for 3 seconds
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);

      // Refresh page after a delay to allow server to reboot
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

  // Form handlers
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    let error = null;

    switch (name) {
      case "n":
        error = validateDeviceName(value);
        break;
      case "da":
        error = validateSlaveAddress(value);
        break;
      case "pi":
        error = validatePollingInterval(value);
        break;
      case "mapDa":
        error = validateSlaveAddress(value);
        break;
      case "enableMap":
        setNewDevice((prev) => ({
          ...prev,
          [name]: checked,
        }));
        return;
      default:
        break;
    }

    if (error) {
      alert(error);
      return;
    }

    setNewDevice((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

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
    if (
      ["a", "f", "dt", "t", "variationRange", "mapNodeAddress"].includes(name)
    ) {
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
          name === "variationRange" &&
          (isNaN(numValue) || numValue < 1 || numValue > 65535)
        ) {
          error = "Variation range must be between 1 and 65535";
        } else if (
          name === "mapNodeAddress" &&
          (isNaN(numValue) || numValue < 0 || numValue > 65534)
        ) {
          error = "Map node address must be between 0 and 65534";
        }
      }
      setNewNode((prev) => ({
        ...prev,
        [name]: value === "" ? "" : numValue,
      }));
      return;
    }

    // Handle formula field
    if (name === "formula") {
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

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validate all fields
    const nameError = validateDeviceName(newDevice.n);
    const addressError = validateSlaveAddress(newDevice.da);
    const intervalError = validatePollingInterval(newDevice.pi);

    if (nameError || addressError || intervalError) {
      alert(nameError || addressError || intervalError);
      return;
    }

    if (devices.length >= CONFIG.MAX_DEVICES) {
      alert(
        `Maximum number of devices (${CONFIG.MAX_DEVICES}) reached. Cannot add more devices.`
      );
      return;
    }

    if (!isDeviceNameUnique(newDevice.n)) {
      alert(
        "A device with this name already exists. Please use a unique name."
      );
      return;
    }

    setDevices((prev) => [...prev, { ...newDevice, ns: [] }]);
    setNewDevice({
      n: "",
      da: 1,
      pi: 1000,
      g: false,
    });
    setIsAddingDevice(false);
  };

  const handleNodeSubmit = (e) => {
    e.preventDefault();
    if (selectedDevice === null) return;

    // Validate all fields
    const nameError = validateNodeName(newNode.n);
    const timeoutError = validateTimeout(newNode.t);

    if (nameError || timeoutError) {
      alert(nameError || timeoutError);
      return;
    }

    // Check if node name is unique across all devices
    if (!isNodeNameUniqueAcrossDevices(newNode.n)) {
      alert(
        "A node with this name already exists in any device. Please use a unique name."
      );
      return;
    }

    if (totalNodes >= CONFIG.MAX_TOTAL_NODES) {
      alert(
        `Maximum total number of nodes (${CONFIG.MAX_TOTAL_NODES}) reached across all devices. Cannot add more nodes.`
      );
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
              f: parseInt(newNode.f),
              t: parseInt(newNode.t),
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
      f: 1,
      dt: 1, // Reset to default numeric value
      t: 1000,
      reportOnChange: false,
      variationRange: 1,
      enableNodeMap: false,
      mapNodeAddress: 0,
      formula: "",
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
      port: parseInt(devices[index].port),
      protocol: parseInt(devices[index].protocol),
      enableMap: Boolean(devices[index].enableMap),
      mapDa: parseInt(devices[index].mapDa),
      ns: [...(devices[index].ns || [])],
    };
    setEditingDevice(deviceToEdit);
  };

  const saveEdit = (index) => {
    if (!editingDevice.n || !editingDevice.da || !editingDevice.pi) {
      alert("Please fill in all fields");
      return;
    }

    if (!isDeviceNameUnique(editingDevice.n, index)) {
      alert(
        "A device with this name already exists. Please use a unique name."
      );
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
      f: parseInt(devices[selectedDevice].ns[nodeIndex].f),
      dt: parseInt(devices[selectedDevice].ns[nodeIndex].dt),
      t: parseInt(devices[selectedDevice].ns[nodeIndex].t),
      reportOnChange: Boolean(
        devices[selectedDevice].ns[nodeIndex].reportOnChange
      ),
      variationRange:
        parseInt(devices[selectedDevice].ns[nodeIndex].variationRange) || 1,
      enableNodeMap: Boolean(
        devices[selectedDevice].ns[nodeIndex].enableNodeMap
      ),
      mapNodeAddress:
        parseInt(devices[selectedDevice].ns[nodeIndex].mapNodeAddress) || 0,
      formula: devices[selectedDevice].ns[nodeIndex].formula || "",
    };
    setEditingNode(nodeToEdit);
  };

  const handleEditInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    let error = null;

    // Handle checkbox inputs
    if (type === "checkbox" || type === "select-one") {
      setEditingDevice((prev) => ({
        ...prev,
        [name]: checked,
      }));
      return;
    }

    // Handle numeric inputs
    if (["da", "pi", "mapDa"].includes(name)) {
      const numValue = parseInt(value);
      if (value !== "") {
        if (
          name === "da" &&
          (isNaN(numValue) || numValue < 1 || numValue > 247)
        ) {
          error = "Slave address must be between 1 and 247";
        } else if (
          name === "pi" &&
          (isNaN(numValue) ||
            numValue < CONFIG.MIN_POLLING_INTERVAL ||
            numValue > CONFIG.MAX_POLLING_INTERVAL)
        ) {
          error = `Polling interval must be between ${CONFIG.MIN_POLLING_INTERVAL} and ${CONFIG.MAX_POLLING_INTERVAL} ms`;
        } else if (
          name === "mapDa" &&
          (isNaN(numValue) || numValue < 1 || numValue > 255)
        ) {
          error = "Map slave address must be between 1 and 255";
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
    if (
      ["a", "f", "dt", "t", "variationRange", "mapNodeAddress"].includes(name)
    ) {
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
          name === "variationRange" &&
          (isNaN(numValue) || numValue < 1 || numValue > 65535)
        ) {
          alert("Variation range must be between 1 and 65535");
          return;
        } else if (
          name === "mapNodeAddress" &&
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
    if (name === "formula") {
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

  const saveNodeEdit = (nodeIndex) => {
    if (
      !editingNode.n ||
      !editingNode.a ||
      !editingNode.f ||
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
    let newName = `${baseName}${counter}`;

    while (!isNodeNameUnique(newName, deviceIndex)) {
      counter++;
      newName = `${baseName}${counter}`;
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
      port: 1,
      protocol: 0,
      enableMap: false,
      mapDa: 1,
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
      n: uniqueName,
      a: 1,
      f: 1,
      dt: 1,
      t: 1000,
    });
    setIsAddingNode(true);
  };

  // Add new function to handle cancel add device
  const handleCancelAddDevice = () => {
    setIsAddingDevice(false);
    setNewDevice({
      n: "",
      da: 1,
      pi: 1000,
      g: false,
    });
  };

  // Add new function to handle cancel add node
  const handleCancelAddNode = () => {
    setIsAddingNode(false);
    setNewNode({
      n: "",
      a: 1,
      f: 1,
      dt: 1,
      t: 1000,
    });
  };

  // Update handleEventInputChange to handle the new key names
  const handleEventInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    const keyMap = {
      name: "n",
      enabled: "e",
      triggerCondition: "c",
      triggerPoint: "p",
      scanningCycle: "sc",
      minTriggerInterval: "mi",
      upperThreshold: "ut",
      lowerThreshold: "lt",
      triggerExecution: "te",
      triggerAction: "ta",
      description: "d",
      c: "c",
      p: "p",
      sc: "sc",
      mi: "mi",
      ut: "ut",
      lt: "lt",
      te: "te",
      ta: "ta",
      d: "d",
    };

    // Handle checkbox inputs
    if (type === "checkbox") {
      setNewEvent((prev) => ({
        ...prev,
        [keyMap[name]]: checked,
      }));
      return;
    }

    // Handle numeric fields
    if (["c", "sc", "mi", "ut", "lt", "te", "ta"].includes(keyMap[name])) {
      setNewEvent((prev) => ({
        ...prev,
        [keyMap[name]]: parseInt(value) || 0,
      }));
      return;
    }

    // Handle select and other inputs
    setNewEvent((prev) => ({
      ...prev,
      [keyMap[name]]: value,
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
    setIsAddingEvent(true);
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
      e.stopPropagation();
      onSubmit(e);
    };

    return html`
      <div
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      >
        <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4">
          <div class="px-6 py-4 border-b border-gray-200">
            <div class="flex justify-between items-center">
              <h3 class="text-lg font-semibold">
                Add New Device
                ${devices.length >= maxDevices
                  ? html`<span class="text-red-500 text-sm font-normal ml-2">
                      (Maximum devices limit reached)
                    </span>`
                  : html`<span class="text-gray-500 text-sm font-normal ml-2">
                      (${maxDevices - devices.length} devices remaining)
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
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Name
                    <span class="text-xs text-gray-500 ml-1"
                      >(max ${CONFIG.MAX_NAME_LENGTH} chars)</span
                    >
                  </label>
                  <input
                    type="text"
                    name="n"
                    value=${newDevice.n}
                    onChange=${handleInputChange}
                    maxlength=${CONFIG.MAX_NAME_LENGTH}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="Device name"
                    required
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Slave Address
                    <span class="text-xs text-gray-500 ml-1">(1-247)</span>
                  </label>
                  <input
                    type="number"
                    name="da"
                    value=${newDevice.da}
                    onChange=${handleInputChange}
                    min="1"
                    max="247"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="Enter slave address"
                    required
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Port
                  </label>
                  <select
                    name="port"
                    value=${newDevice.port}
                    onChange=${handleInputChange}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    ${CONFIG.PORT_OPTIONS.map(
                      ([value, label]) =>
                        html`<option value=${value}>${label}</option>`
                    )}
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Protocol Type
                  </label>
                  <select
                    name="protocol"
                    value=${newDevice.protocol}
                    onChange=${handleInputChange}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    ${CONFIG.PROTOCOL_TYPES.map(
                      ([value, label]) =>
                        html`<option value=${value}>${label}</option>`
                    )}
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Polling Interval
                    <span class="text-xs text-gray-500 ml-1"
                      >(${CONFIG.MIN_POLLING_INTERVAL}-${CONFIG.MAX_POLLING_INTERVAL}
                      ms)</span
                    >
                  </label>
                  <input
                    type="number"
                    name="pi"
                    value=${newDevice.pi}
                    onChange=${handleInputChange}
                    min=${CONFIG.MIN_POLLING_INTERVAL}
                    max=${CONFIG.MAX_POLLING_INTERVAL}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="Enter polling interval"
                    required
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Merge Collection
                  </label>
                  <div
                    class="w-full px-3 py-2 border border-gray-300 rounded-md flex items-center min-h-[42px]"
                  >
                    <label class="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name="g"
                        checked=${newDevice.g}
                        onChange=${handleInputChange}
                        class="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      <span class="ml-2 text-gray-700">Enable</span>
                    </label>
                  </div>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Enable Address Mapping
                  </label>
                  <div
                    class="w-full px-3 py-2 border border-gray-300 rounded-md flex items-center min-h-[42px]"
                  >
                    <label class="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name="enableMap"
                        checked=${newDevice.enableMap}
                        onChange=${handleInputChange}
                        class="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      <span class="ml-2 text-gray-700">Enable</span>
                    </label>
                  </div>
                </div>
                ${newDevice.enableMap &&
                html`
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                      Map Slave Address
                      <span class="text-xs text-gray-500 ml-1">(1-255)</span>
                    </label>
                    <input
                      type="number"
                      name="mapDa"
                      value=${newDevice.mapDa}
                      onChange=${handleInputChange}
                      min="1"
                      max="255"
                      class="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="Enter map slave address"
                      required
                    />
                  </div>
                `}
              </div>
              <div class="flex justify-end space-x-3 mt-6">
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

  const EditDeviceModal = ({
    isOpen,
    onClose,
    onSubmit,
    editingDevice,
    setEditingDevice,
    deviceIndex,
  }) => {
    if (!isOpen) return null;

    const handleSubmit = (e) => {
      e.preventDefault();
      e.stopPropagation();
      onSubmit(deviceIndex);
    };

    return html`
      <div
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      >
        <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4">
          <div class="px-6 py-4 border-b border-gray-200">
            <div class="flex justify-between items-center">
              <h3 class="text-lg font-semibold">Edit Device</h3>
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
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Name
                    <span class="text-xs text-gray-500 ml-1"
                      >(max ${CONFIG.MAX_NAME_LENGTH} chars)</span
                    >
                  </label>
                  <input
                    type="text"
                    name="n"
                    value=${editingDevice.n}
                    onChange=${handleEditInputChange}
                    maxlength=${CONFIG.MAX_NAME_LENGTH}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Slave Address
                    <span class="text-xs text-gray-500 ml-1">(1-247)</span>
                  </label>
                  <input
                    type="number"
                    name="da"
                    value=${editingDevice.da}
                    onChange=${handleEditInputChange}
                    min="1"
                    max="247"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Port
                  </label>
                  <select
                    name="port"
                    value=${editingDevice.port}
                    onChange=${handleEditInputChange}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    ${CONFIG.PORT_OPTIONS.map(
                      ([value, label]) =>
                        html`<option value=${value}>${label}</option>`
                    )}
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Protocol Type
                  </label>
                  <select
                    name="protocol"
                    value=${editingDevice.protocol}
                    onChange=${handleEditInputChange}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    ${CONFIG.PROTOCOL_TYPES.map(
                      ([value, label]) =>
                        html`<option value=${value}>${label}</option>`
                    )}
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Polling Interval
                    <span class="text-xs text-gray-500 ml-1"
                      >(${CONFIG.MIN_POLLING_INTERVAL}-${CONFIG.MAX_POLLING_INTERVAL}
                      ms)</span
                    >
                  </label>
                  <input
                    type="number"
                    name="pi"
                    value=${editingDevice.pi}
                    onChange=${handleEditInputChange}
                    min=${CONFIG.MIN_POLLING_INTERVAL}
                    max=${CONFIG.MAX_POLLING_INTERVAL}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Merge Collection
                  </label>
                  <div
                    class="w-full px-3 py-2 border border-gray-300 rounded-md flex items-center min-h-[42px]"
                  >
                    <label class="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name="g"
                        checked=${editingDevice.g}
                        onChange=${handleEditInputChange}
                        class="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      <span class="ml-2 text-gray-700">Yes</span>
                    </label>
                  </div>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Enable Address Mapping
                  </label>
                  <div
                    class="w-full px-3 py-2 border border-gray-300 rounded-md flex items-center min-h-[42px]"
                  >
                    <label class="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name="enableMap"
                        checked=${editingDevice.enableMap}
                        onChange=${handleEditInputChange}
                        class="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      <span class="ml-2 text-gray-700">Yes</span>
                    </label>
                  </div>
                </div>
                ${editingDevice.enableMap &&
                html`
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                      Map Slave Address
                      <span class="text-xs text-gray-500 ml-1">(1-255)</span>
                    </label>
                    <input
                      type="number"
                      name="mapDa"
                      value=${editingDevice.mapDa}
                      onChange=${handleEditInputChange}
                      min="1"
                      max="255"
                      class="w-full px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                  </div>
                `}
              </div>
              <div class="flex justify-end space-x-3 mt-6">
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
                  Save Changes
                </button>
              </div>
            </form>
          </div>
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
        <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4">
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
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Name
                    <span class="text-xs text-gray-500 ml-1"
                      >(max ${CONFIG.MAX_NAME_LENGTH} chars)</span
                    >
                  </label>
                  <input
                    type="text"
                    name="n"
                    value=${newNode.n}
                    onChange=${handleNodeInputChange}
                    maxlength=${CONFIG.MAX_NAME_LENGTH}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="Node name"
                    required
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Register Address
                  </label>
                  <input
                    type="text"
                    name="a"
                    value=${newNode.a}
                    onChange=${handleNodeInputChange}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="Register address"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Function code
                  </label>
                  <select
                    name="f"
                    value=${newNode.f}
                    onChange=${handleNodeInputChange}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    ${CONFIG.FUNCTION_CODES.map(
                      ([value, label]) =>
                        html`<option value=${value}>${label}</option>`
                    )}
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Data type
                  </label>
                  <select
                    name="dt"
                    value=${newNode.dt}
                    onChange=${handleNodeInputChange}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md"
                    disabled=${newNode.f === 1 || newNode.f === 2}
                  >
                    ${CONFIG.DATA_TYPES.map(
                      ([value, label]) =>
                        html`<option value=${value}>${label}</option>`
                    )}
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Timeout
                    <span class="text-xs text-gray-500 ml-1"
                      >(${CONFIG.MIN_TIMEOUT}-${CONFIG.MAX_TIMEOUT} ms)</span
                    >
                  </label>
                  <input
                    type="number"
                    name="t"
                    value=${newNode.t}
                    onChange=${handleNodeInputChange}
                    min=${CONFIG.MIN_TIMEOUT}
                    max=${CONFIG.MAX_TIMEOUT}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="Timeout"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Reporting on Change
                  </label>
                  <div
                    class="w-full px-3 py-2 border border-gray-300 rounded-md flex items-center min-h-[42px]"
                  >
                    <label class="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name="reportOnChange"
                        checked=${newNode.reportOnChange}
                        onChange=${handleNodeInputChange}
                        class="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      <span class="ml-2 text-gray-700">Enable</span>
                    </label>
                  </div>
                </div>
                ${newNode.reportOnChange &&
                html`
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                      Variation Range
                      <span class="text-xs text-gray-500 ml-1">(1-65535)</span>
                    </label>
                    <input
                      type="number"
                      name="variationRange"
                      value=${newNode.variationRange}
                      onChange=${handleNodeInputChange}
                      min="1"
                      max="65535"
                      class="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="Enter variation range"
                      required
                    />
                  </div>
                `}
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Enable Address Mapping
                  </label>
                  <div
                    class="w-full px-3 py-2 border border-gray-300 rounded-md flex items-center min-h-[42px]"
                  >
                    <label class="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name="enableNodeMap"
                        checked=${newNode.enableNodeMap}
                        onChange=${handleNodeInputChange}
                        class="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      <span class="ml-2 text-gray-700">Enable</span>
                    </label>
                  </div>
                </div>
                ${newNode.enableNodeMap &&
                html`
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                      Map Node Address
                      <span class="text-xs text-gray-500 ml-1">(0-65534)</span>
                    </label>
                    <input
                      type="number"
                      name="mapNodeAddress"
                      value=${newNode.mapNodeAddress}
                      onChange=${handleNodeInputChange}
                      min="0"
                      max="65534"
                      class="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="Enter map node address"
                      required
                    />
                  </div>
                `}
                <div class="col-span-2">
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Calculation Formula
                    <span class="text-xs text-gray-500 ml-1"
                      >(max 128 chars)</span
                    >
                  </label>
                  <div class="relative">
                    <input
                      type="text"
                      name="formula"
                      value=${newNode.formula}
                      onChange=${handleNodeInputChange}
                      maxlength="128"
                      class="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="Enter calculation formula"
                    />
                    <div class="absolute right-2 top-2 text-xs text-gray-500">
                      ${newNode.formula ? newNode.formula.length : 0}/128
                    </div>
                  </div>
                </div>
              </div>
              <div class="flex justify-end space-x-3 mt-6">
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
  }) => {
    if (!isOpen) return null;

    const handleSubmit = (e) => {
      e.preventDefault();
      e.stopPropagation();
      onSubmit(nodeIndex);
    };

    return html`
      <div
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      >
        <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4">
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
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Name
                    <span class="text-xs text-gray-500 ml-1"
                      >(max ${CONFIG.MAX_NAME_LENGTH} chars)</span
                    >
                  </label>
                  <input
                    type="text"
                    name="n"
                    value=${editingNode.n}
                    onChange=${handleEditNodeInputChange}
                    maxlength=${CONFIG.MAX_NAME_LENGTH}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Register Address
                  </label>
                  <input
                    type="text"
                    name="a"
                    value=${editingNode.a}
                    onChange=${handleEditNodeInputChange}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Function code
                  </label>
                  <select
                    name="f"
                    value=${editingNode.f}
                    onChange=${handleEditNodeInputChange}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    ${CONFIG.FUNCTION_CODES.map(
                      ([value, label]) =>
                        html`<option value=${value}>${label}</option>`
                    )}
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Data type
                  </label>
                  <select
                    name="dt"
                    value=${editingNode.dt}
                    onChange=${handleEditNodeInputChange}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md"
                    disabled=${editingNode.f === 1 || editingNode.f === 2}
                  >
                    ${CONFIG.DATA_TYPES.map(
                      ([value, label]) =>
                        html`<option value=${value}>${label}</option>`
                    )}
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Timeout
                    <span class="text-xs text-gray-500 ml-1"
                      >(${CONFIG.MIN_TIMEOUT}-${CONFIG.MAX_TIMEOUT} ms)</span
                    >
                  </label>
                  <input
                    type="number"
                    name="t"
                    value=${editingNode.t}
                    onChange=${handleEditNodeInputChange}
                    min=${CONFIG.MIN_TIMEOUT}
                    max=${CONFIG.MAX_TIMEOUT}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Reporting on Change
                  </label>
                  <div
                    class="w-full px-3 py-2 border border-gray-300 rounded-md flex items-center min-h-[42px]"
                  >
                    <label class="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name="reportOnChange"
                        checked=${editingNode.reportOnChange}
                        onChange=${handleEditNodeInputChange}
                        class="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      <span class="ml-2 text-gray-700">Enable</span>
                    </label>
                  </div>
                </div>
                ${editingNode.reportOnChange &&
                html`
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                      Variation Range
                      <span class="text-xs text-gray-500 ml-1">(1-65535)</span>
                    </label>
                    <input
                      type="number"
                      name="variationRange"
                      value=${editingNode.variationRange}
                      onChange=${handleEditNodeInputChange}
                      min="1"
                      max="65535"
                      class="w-full px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                  </div>
                `}
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Enable Address Mapping
                  </label>
                  <div
                    class="w-full px-3 py-2 border border-gray-300 rounded-md flex items-center min-h-[42px]"
                  >
                    <label class="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name="enableNodeMap"
                        checked=${editingNode.enableNodeMap}
                        onChange=${handleEditNodeInputChange}
                        class="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      <span class="ml-2 text-gray-700">Enable</span>
                    </label>
                  </div>
                </div>
                ${editingNode.enableNodeMap &&
                html`
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                      Map Node Address
                      <span class="text-xs text-gray-500 ml-1">(0-65534)</span>
                    </label>
                    <input
                      type="number"
                      name="mapNodeAddress"
                      value=${editingNode.mapNodeAddress}
                      onChange=${handleEditNodeInputChange}
                      min="0"
                      max="65534"
                      class="w-full px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                  </div>
                `}
                <div class="col-span-2">
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Calculation Formula
                    <span class="text-xs text-gray-500 ml-1"
                      >(max 128 chars)</span
                    >
                  </label>
                  <div class="relative">
                    <input
                      type="text"
                      name="formula"
                      value=${editingNode.formula}
                      onChange=${handleEditNodeInputChange}
                      maxlength="128"
                      class="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                    <div class="absolute right-2 top-2 text-xs text-gray-500">
                      ${editingNode.formula
                        ? editingNode.formula.length
                        : 0}/128
                    </div>
                  </div>
                </div>
              </div>
              <div class="flex justify-end space-x-3 mt-6">
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
                  Save Changes
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
        <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4">
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
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Event Name <span class="text-red-500">*</span>
                    <span class="text-xs text-gray-500 ml-1"
                      >(max 20 chars)</span
                    >
                  </label>
                  <div class="relative">
                    <input
                      type="text"
                      name="name"
                      value=${newEvent.n}
                      onChange=${handleEventInputChange}
                      maxlength="20"
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                    <div class="absolute right-2 top-2 text-xs text-gray-500">
                      ${newEvent.n.length}/20
                    </div>
                  </div>
                </div>
                <div class="flex items-center">
                  <label class="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      name="enabled"
                      checked=${newEvent.e}
                      onChange=${handleEventInputChange}
                      class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span class="ml-2 text-sm text-gray-700">Enable Event</span>
                  </label>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Trigger Condition
                  </label>
                  <select
                    name="triggerCondition"
                    value=${newEvent.c}
                    onChange=${handleEventInputChange}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    ${TRIGGER_CONDITIONS.map(
                      ([value, label]) =>
                        html`<option value=${value}>${label}</option>`
                    )}
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Trigger Point (Node Name)
                    <span class="text-red-500">*</span>
                  </label>
                  <select
                    name="triggerPoint"
                    value=${newEvent.p}
                    onChange=${handleEventInputChange}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled=${getAllNodes.length === 0}
                    required
                  >
                    <option value="">Select a node</option>
                    ${getAllNodes.map(
                      (node) =>
                        html`<option value=${node.value}>${node.label}</option>`
                    )}
                  </select>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Scanning Cycle (ms) <span class="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="scanningCycle"
                    value=${newEvent.sc}
                    onChange=${handleEventInputChange}
                    min="0"
                    max="10000"
                    step="100"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Min Trigger Interval (ms)
                    <span class="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="minTriggerInterval"
                    value=${newEvent.mi}
                    onChange=${handleEventInputChange}
                    min="500"
                    max="10000"
                    step="100"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div class="grid grid-cols-2 gap-4">
                ${getThresholdVisibility.showUpper &&
                html`
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                      Upper Threshold <span class="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="upperThreshold"
                      value=${newEvent.ut}
                      onChange=${handleEventInputChange}
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter upper threshold"
                      required=${[3, 5, 6, 7].includes(parseInt(newEvent.c))}
                    />
                  </div>
                `}
                ${getThresholdVisibility.showLower &&
                html`
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                      Lower Threshold <span class="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="lowerThreshold"
                      value=${newEvent.lt}
                      onChange=${handleEventInputChange}
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter lower threshold"
                      required=${[4, 5, 6, 8].includes(parseInt(newEvent.c))}
                    />
                  </div>
                `}
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Trigger Execution
                </label>
                <select
                  name="triggerExecution"
                  value=${newEvent.te}
                  onChange=${handleEventInputChange}
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  ${TRIGGER_EXECUTIONS.map(
                    ([value, label]) =>
                      html`<option value=${value}>${label}</option>`
                  )}
                </select>
              </div>

              ${showTriggerAction &&
              html`
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Trigger Action
                  </label>
                  <select
                    name="triggerAction"
                    value=${newEvent.ta}
                    onChange=${handleEventInputChange}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    ${TRIGGER_ACTIONS.map(
                      ([value, label]) =>
                        html`<option value=${value}>${label}</option>`
                    )}
                  </select>
                </div>
              `}

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Event Description
                </label>
                <textarea
                  name="description"
                  value=${newEvent.d}
                  onChange=${handleEventInputChange}
                  rows="3"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter event description"
                ></textarea>
              </div>

              <div class="flex justify-end space-x-3 mt-4">
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
        <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4">
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
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Event Name <span class="text-red-500">*</span>
                    <span class="text-xs text-gray-500 ml-1"
                      >(max 20 chars)</span
                    >
                  </label>
                  <div class="relative">
                    <input
                      type="text"
                      name="name"
                      value=${editingEvent.n}
                      onChange=${handleEventInputChange}
                      maxlength="20"
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                    <div class="absolute right-2 top-2 text-xs text-gray-500">
                      ${editingEvent.n.length}/20
                    </div>
                  </div>
                </div>
                <div class="flex items-center">
                  <label class="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      name="enabled"
                      checked=${editingEvent.e}
                      onChange=${handleEventInputChange}
                      class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span class="ml-2 text-sm text-gray-700">Enable Event</span>
                  </label>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Trigger Condition
                  </label>
                  <select
                    name="triggerCondition"
                    value=${editingEvent.c}
                    onChange=${handleEventInputChange}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    ${TRIGGER_CONDITIONS.map(
                      ([value, label]) =>
                        html`<option value=${value}>${label}</option>`
                    )}
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Trigger Point (Node Name)
                    <span class="text-red-500">*</span>
                  </label>
                  <select
                    name="triggerPoint"
                    value=${editingEvent.p}
                    onChange=${handleEventInputChange}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled=${getAllNodes.length === 0}
                    required
                  >
                    <option value="">Select a node</option>
                    ${getAllNodes.map(
                      (node) =>
                        html`<option value=${node.value}>${node.label}</option>`
                    )}
                  </select>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Scanning Cycle (ms) <span class="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="scanningCycle"
                    value=${editingEvent.sc}
                    onChange=${handleEventInputChange}
                    min="0"
                    max="10000"
                    step="100"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Min Trigger Interval (ms)
                    <span class="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="minTriggerInterval"
                    value=${editingEvent.mi}
                    onChange=${handleEventInputChange}
                    min="500"
                    max="10000"
                    step="100"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div class="grid grid-cols-2 gap-4">
                ${getThresholdVisibility.showUpper &&
                html`
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                      Upper Threshold <span class="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="upperThreshold"
                      value=${editingEvent.ut}
                      onChange=${handleEventInputChange}
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter upper threshold"
                      required=${[3, 5, 6, 7].includes(
                        parseInt(editingEvent.c)
                      )}
                    />
                  </div>
                `}
                ${getThresholdVisibility.showLower &&
                html`
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                      Lower Threshold <span class="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="lowerThreshold"
                      value=${editingEvent.lt}
                      onChange=${handleEventInputChange}
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter lower threshold"
                      required=${[4, 5, 6, 8].includes(
                        parseInt(editingEvent.c)
                      )}
                    />
                  </div>
                `}
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Trigger Execution
                </label>
                <select
                  name="triggerExecution"
                  value=${editingEvent.te}
                  onChange=${handleEventInputChange}
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  ${TRIGGER_EXECUTIONS.map(
                    ([value, label]) =>
                      html`<option value=${value}>${label}</option>`
                  )}
                </select>
              </div>

              ${showTriggerAction &&
              html`
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Trigger Action
                  </label>
                  <select
                    name="triggerAction"
                    value=${editingEvent.ta}
                    onChange=${handleEventInputChange}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    ${TRIGGER_ACTIONS.map(
                      ([value, label]) =>
                        html`<option value=${value}>${label}</option>`
                    )}
                  </select>
                </div>
              `}

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Event Description
                </label>
                <textarea
                  name="description"
                  value=${editingEvent.d}
                  onChange=${handleEventInputChange}
                  rows="3"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter event description"
                ></textarea>
              </div>

              <div class="flex justify-end space-x-3 mt-4">
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
                  Save Changes
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
                  setEdgeComputingEnabled(edgeComputingEnabled === 1 ? 0 : 1)}
                class=${`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  edgeComputingEnabled === 1 ? "bg-blue-600" : "bg-gray-200"
                }`}
                disabled=${isSaving}
              >
                <span
                  class=${`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    edgeComputingEnabled === 1
                      ? "translate-x-6"
                      : "translate-x-1"
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
                <${Th}>Slave Address<//>
                <${Th}>Polling Interval<//>
                <${Th}>Port<//>
                <${Th}>Protocol<//>
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
                    <td class="px-6 py-4 whitespace-nowrap">${device.da}</td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      ${`${device.pi} ms`}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      ${CONFIG.PORT_OPTIONS.find(
                        ([value]) => value === device.port
                      )?.[1]}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      ${CONFIG.PROTOCOL_TYPES.find(
                        ([value]) => value === device.protocol
                      )?.[1]}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      ${device.enableMap ? "Yes" : "No"}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      ${device.g ? "Yes" : "No"}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap space-x-2">
                      <button
                        onClick=${(e) => {
                          e.stopPropagation();
                          startEditing(index);
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
                onClick=${() => setIsAddingNode(true)}
                disabled=${totalNodes >= CONFIG.MAX_TOTAL_NODES}
                variant="primary"
                icon="PlusIcon"
              >
                Add Node
              <//>
            </div>

            <${AddNodeModal}
              isOpen=${isAddingNode}
              onClose=${() => setIsAddingNode(false)}
              onSubmit=${handleNodeSubmit}
              newNode=${newNode}
              setNewNode=${setNewNode}
              totalNodes=${totalNodes}
              maxNodes=${CONFIG.MAX_TOTAL_NODES}
            />

            <${EditNodeModal}
              isOpen=${editingNodeIndex !== null}
              onClose=${cancelNodeEdit}
              onSubmit=${saveNodeEdit}
              editingNode=${editingNode}
              setEditingNode=${setEditingNode}
              nodeIndex=${editingNodeIndex}
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
                            ([value]) => value === node.f
                          )?.[1]}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                          ${CONFIG.DATA_TYPES.find(
                            ([value]) => value === parseInt(node.dt)
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
        <div class="space-y-6">
          <div class="bg-white rounded-lg shadow-md p-6">
            <div class="space-y-6">
              <div>
                <h2 class="text-xl font-semibold mb-4">Data channel</h2>

                <!-- Channel Selection -->
                <div class="mb-6">
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Report Channel
                  </label>
                  <select
                    name="channel"
                    value=${reportConfig.channel}
                    onChange=${handleReportConfigChange}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    ${CONFIG.REPORT_CHANNELS.map(
                      ([value, label]) => html`
                        <option value=${value}>${label}</option>
                      `
                    )}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <!-- MQTT Configuration -->
          <div class="bg-white rounded-lg shadow-md p-6">
            <div class="mb-6 space-y-4">
              <h2 class="text-xl font-semibold mb-4">Data Query/Set</h2>
              <div>
                <div class="flex items-center space-x-4">
                  <input
                    type="checkbox"
                    name="mqttDataQuerySet"
                    checked=${reportConfig.mqttDataQuerySet}
                    onChange=${handleReportConfigChange}
                    class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span class="text-sm text-gray-700"
                    >Enable Data Query/Set</span
                  >
                </div>
              </div>

              ${reportConfig.mqttDataQuerySet &&
              html`
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Query or Set Type
                  </label>
                  <select
                    name="mqttQuerySetType"
                    value=${reportConfig.mqttQuerySetType}
                    onChange=${handleReportConfigChange}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    ${CONFIG.QUERY_SET_TYPES.map(
                      ([value, label]) => html` <option value=${value}>
                        ${label}
                      </option>`
                    )}
                  </select>
                </div>
              `}
              ${reportConfig.mqttDataQuerySet &&
              reportConfig.channel === 1 &&
              html`
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Query or Set Topic
                  </label>
                  <input
                    type="text"
                    name="mqttQuerySetTopic"
                    value=${reportConfig.mqttQuerySetTopic}
                    onChange=${handleReportConfigChange}
                    maxlength="64"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter query/set topic"
                    maxlength="64"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Query or Set QoS
                  </label>
                  <select
                    name="mqttQuerySetQos"
                    value=${reportConfig.mqttQuerySetQos}
                    onChange=${handleReportConfigChange}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="0">QOS0 - At most once</option>
                    <option value="1">QOS1 - At least once</option>
                    <option value="2">QOS2 - Exactly once</option>
                  </select>
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Respond Topic
                  </label>
                  <input
                    type="text"
                    name="mqttRespondTopic"
                    value=${reportConfig.mqttRespondTopic}
                    onChange=${handleReportConfigChange}
                    maxlength="64"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter respond topic"
                    maxlength="64"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Respond QoS
                  </label>
                  <select
                    name="mqttRespondQos"
                    value=${reportConfig.mqttRespondQos}
                    onChange=${handleReportConfigChange}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="0">QOS0 - At most once</option>
                    <option value="1">QOS1 - At least once</option>
                    <option value="2">QOS2 - Exactly once</option>
                  </select>
                </div>

                <div class="flex items-center">
                  <input
                    type="checkbox"
                    name="mqttRetainedMessage"
                    checked=${reportConfig.mqttRetainedMessage}
                    onChange=${handleReportConfigChange}
                    class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span class="ml-2 text-sm text-gray-700"
                    >Retained Message</span
                  >
                </div>
              `}
            </div>
          </div>
          <div class="bg-white rounded-lg shadow-md p-6">
            <h2 class="text-xl font-semibold mb-4">Data Report of nodes</h2>
            <!-- Enable/Disable -->
            <div class="mb-6">
              <label class="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  name="enabled"
                  checked=${reportConfig.enabled}
                  onChange=${handleReportConfigChange}
                  class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span class="ml-2 text-sm text-gray-700"
                  >Enable Data Reporting</span
                >
              </label>
            </div>

            <!-- MQTT Configuration -->
            ${reportConfig.channel === 1 &&
            html`
              <div class="mb-6 space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Report Topic
                  </label>
                  <input
                    type="text"
                    name="mqttTopic"
                    value=${reportConfig.mqttTopic}
                    onChange=${handleReportConfigChange}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled=${!reportConfig.enabled}
                    placeholder="Enter MQTT topic"
                    maxlength="64"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    QoS Level
                  </label>
                  <select
                    name="mqttQos"
                    value=${reportConfig.mqttQos}
                    onChange=${handleReportConfigChange}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled=${!reportConfig.enabled}
                  >
                    ${CONFIG.MQTT_QOS_OPTIONS.map(
                      ([value, label]) => html`
                        <option value=${value}>${label}</option>
                      `
                    )}
                  </select>
                </div>
              </div>
            `}

            <!-- Periodic Reporting -->
            <div class="mb-6">
              <label class="flex items-center cursor-pointer mb-2">
                <input
                  type="checkbox"
                  name="periodicEnabled"
                  checked=${reportConfig.periodicEnabled}
                  onChange=${handleReportConfigChange}
                  class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  disabled=${!reportConfig.enabled}
                />
                <span class="ml-2 text-sm text-gray-700"
                  >Enable Periodic Reporting</span
                >
              </label>
              ${reportConfig.periodicEnabled &&
              html`
                <div class="ml-6">
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Reporting Interval (1-36000 seconds)
                  </label>
                  <input
                    type="number"
                    name="periodicInterval"
                    value=${reportConfig.periodicInterval}
                    onChange=${handleReportConfigChange}
                    min="1"
                    max="36000"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled=${!reportConfig.enabled}
                  />
                </div>
              `}
            </div>

            <!-- Regular Reporting -->
            <div class="mb-6">
              <label class="flex items-center cursor-pointer mb-2">
                <input
                  type="checkbox"
                  name="regularEnabled"
                  checked=${reportConfig.regularEnabled}
                  onChange=${handleReportConfigChange}
                  class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  disabled=${!reportConfig.enabled}
                />
                <span class="ml-2 text-sm text-gray-700"
                  >Enable Regular Reporting</span
                >
              </label>
              ${reportConfig.regularEnabled &&
              html`
                <div class="ml-6 space-y-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                      Regular Time
                    </label>
                    <select
                      name="regularInterval"
                      value=${reportConfig.regularInterval}
                      onChange=${handleReportConfigChange}
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled=${!reportConfig.enabled}
                    >
                      ${CONFIG.REPORT_INTERVALS.map(
                        ([value, label]) => html`
                          <option value=${value}>${label}</option>
                        `
                      )}
                    </select>
                  </div>
                  ${reportConfig.regularInterval === 4 &&
                  html`
                    <div>
                      <label
                        class="block text-sm font-medium text-gray-700 mb-2"
                      >
                        Fixed Time (24-hour format)
                      </label>
                      <input
                        type="time"
                        name="regularFixedTime"
                        value=${reportConfig.regularFixedTime}
                        onChange=${handleTimeChange}
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled=${!reportConfig.enabled}
                      />
                    </div>
                  `}
                </div>
              `}
            </div>

            <!-- Failure Padding -->
            <div class="mb-6">
              <label class="flex items-center cursor-pointer mb-2">
                <input
                  type="checkbox"
                  name="failurePaddingEnabled"
                  checked=${reportConfig.failurePaddingEnabled}
                  onChange=${handleReportConfigChange}
                  class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  disabled=${!reportConfig.enabled}
                />
                <span class="ml-2 text-sm text-gray-700"
                  >Enable Failure Padding</span
                >
              </label>
              ${reportConfig.failurePaddingEnabled &&
              html`
                <div class="ml-6">
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Content of Padding
                  </label>
                  <input
                    type="text"
                    name="failurePaddingContent"
                    value=${reportConfig.failurePaddingContent}
                    onChange=${handleReportConfigChange}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled=${!reportConfig.enabled}
                    placeholder="Enter padding content"
                    maxlength="16"
                  />
                </div>
              `}
            </div>

            <!-- Quotation Mark -->
            <div class="mb-6">
              <label class="flex items-center cursor-pointer mb-2">
                <input
                  type="checkbox"
                  name="quotationMark"
                  checked=${reportConfig.quotationMark}
                  onChange=${handleReportConfigChange}
                  class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  disabled=${!reportConfig.enabled}
                />
                <span class="ml-2 text-sm text-gray-700">Quotation Mark</span>
              </label>
            </div>

            <!-- JSON Template -->
            <div class="mb-6">
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
                  disabled=${!reportConfig.enabled}
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
                Example format: {"device": "device1", "value": "123"}
              </div>
            </div>
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
        <div class="bg-gray-50 p-4 rounded-lg">
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
                                onClick=${() => startEditingEvent(event)}
                                class="text-blue-600 hover:text-blue-900"
                              >
                                Edit
                              </button>
                              <button
                                onClick=${() => deleteEvent(event.id)}
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
      disabled: edgeComputingEnabled === 0,
    },
    {
      id: "report",
      label: "DATA QUERY AND REPORT",
      disabled: edgeComputingEnabled === 0,
    },
    {
      id: "linkage-control",
      label: "LINKAGE CONTROL",
      disabled: edgeComputingEnabled === 0,
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
