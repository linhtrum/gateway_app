"use strict";
import { h, html, useState, useEffect, useMemo } from "../../bundle.js";
import { Icons, Button, Tabs, Input, Select, Checkbox } from "../Components.js";
import { useLanguage } from "../LanguageContext.js";

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

// Add trigger condition options
const TRIGGER_CONDITIONS = [
  [1, "Forward Follow"],
  [2, "Reverse Follow"],
  [3, ">="],
  [4, "<=>"],
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

function DeviceModal({
  isOpen,
  onClose,
  onSubmit,
  device = null,
  isEditing = false,
  devices = [],
}) {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    n: "", // device name
    p: 0, // device port
    pr: 0, // device protocol
    da: 1, // device address
    pi: 1000, // polling interval
    g: false, // device group
    sa: "", // server address
    sp: 502, // server port
    em: false, // enable map
    ma: 1, // map device address
  });

  useEffect(() => {
    if (isOpen) {
      if (isEditing && device) {
        setFormData({
          n: device.n,
          p: device.p,
          pr: device.pr,
          da: device.da,
          pi: device.pi,
          g: device.g,
          sa: device.sa,
          sp: device.sp,
          em: device.em,
          ma: device.ma,
        });
      } else {
        const nextName = getNextName(0, devices);
        setFormData({
          n: nextName,
          p: 0,
          pr: 0,
          da: 1,
          pi: 1000,
          g: false,
          sa: "",
          sp: 502,
          em: false,
          ma: 1,
        });
      }
    }
  }, [isOpen, isEditing, device, devices]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === "checkbox") {
      setFormData((prev) => ({
        ...prev,
        [name]: checked,
      }));
      return;
    }
    if (type === "number") {
      setFormData((prev) => ({
        ...prev,
        [name]: parseInt(value),
      }));
      return;
    }
    if (type === "select-one") {
      setFormData((prev) => ({
        ...prev,
        [name]: parseInt(value),
      }));
      return;
    }
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  if (!isOpen) return null;

  return html`
    <div
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    >
      <div
        class="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
      >
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-medium text-gray-900">
            ${t("addNewDevice")}
            ${devices.length >= 128
              ? html`
                  <span class="text-red-500 text-sm font-normal ml-2">
                    ${t("maxDevicesReached")}
                  </span>
                `
              : html`
                  <span class="text-gray-500 text-sm font-normal ml-2">
                    (${128 - devices.length} ${t("devicesRemaining")})
                  </span>
                `}
          </h3>
          <button onClick=${onClose} class="text-gray-400 hover:text-gray-500">
            <${Icons.CloseIcon} className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit=${handleSubmit} class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            ${Input({
              type: "text",
              label: t("deviceName"),
              extra: `${formData.n.length}/20`,
              name: "n",
              value: formData.n,
              onChange: handleInputChange,
              required: true,
              disabled: formData.p > 2,
              maxLength: 20,
            })}
            ${Select({
              label: t("port"),
              name: "p",
              value: formData.p,
              onChange: handleInputChange,
              required: true,
              options: CONFIG.PORT_OPTIONS,
            })}
          </div>
          <div class="grid grid-cols-2 gap-4">
            ${Select({
              label: t("protocol"),
              name: "pr",
              value: formData.pr,
              onChange: handleInputChange,
              required: true,
              options: CONFIG.PROTOCOL_TYPES,
              disabled: formData.p > 2,
            })}
            ${Input({
              type: "number",
              label: t("slaveAddress"),
              extra: "(1-255)",
              name: "da",
              value: formData.da,
              onChange: handleInputChange,
              required: true,
              disabled: formData.p === 3,
              min: 1,
              max: 255,
            })}
          </div>
          <div class="grid grid-cols-2 gap-4">
            ${Input({
              type: "number",
              label: t("pollingInterval"),
              extra: "(100-65535)ms",
              name: "pi",
              value: formData.pi,
              onChange: handleInputChange,
              required: true,
              min: 10,
              max: 65535,
              step: 10,
            })}
            ${Checkbox({
              label: t("mergeCollection"),
              name: "g",
              value: formData.g,
              onChange: handleInputChange,
            })}
          </div>
          <div class="grid grid-cols-2 gap-4">
            ${Checkbox({
              label: t("enableAddressMapping"),
              name: "em",
              value: formData.em,
              onChange: handleInputChange,
            })}
            ${formData.em &&
            html`
              ${Input({
                type: "number",
                label: t("mappedSlaveAddress"),
                extra: "(1-255)",
                name: "ma",
                value: formData.ma,
                onChange: handleInputChange,
                required: formData.em,
                min: 1,
                max: 255,
              })}
            `}
          </div>
          <div class="grid grid-cols-2 gap-4">
            ${formData.p === 2 &&
            html`
              ${Input({
                type: "text",
                label: t("serverAddress"),
                name: "sa",
                value: formData.sa,
                onChange: handleInputChange,
                required: formData.p === 2,
                maxlength: 64,
                required: formData.p === 2,
              })}
              ${Input({
                type: "number",
                label: t("serverPort"),
                extra: "(255-65535)",
                name: "sp",
                value: formData.sp,
                onChange: handleInputChange,
                required: formData.p === 2,
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
              ${t("cancel")}
            </button>
            <button
              type="submit"
              class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              ${t("add")}
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function NodeModal({
  isOpen,
  onClose,
  onSubmit,
  node = null,
  isEditing = false,
  selectedDevice,
  devices,
  totalNodes,
  maxNodes,
}) {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
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

  useEffect(() => {
    if (isOpen) {
      if (isEditing && node) {
        setFormData({
          n: node.n,
          a: node.a,
          fc: node.fc,
          dt: node.dt,
          t: node.t,
          er: node.er,
          vr: node.vr,
          em: node.em,
          ma: node.ma,
          fo: node.fo,
        });
      } else {
        const nextName = getNextName(1, devices, selectedDevice);
        setFormData({
          n: nextName,
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
      }
    }
  }, [isOpen, isEditing, node, selectedDevice, devices]);

  const handleNodeNameChange = (e) => {
    const device = devices[selectedDevice];
    const selectedName = e.target.value;
    if (device.p === 3) {
      const selectedOption = IO_NODE_OPTIONS.find(
        (opt) => opt.name === selectedName
      );
      if (selectedOption) {
        setFormData((prev) => ({
          ...prev,
          n: selectedName,
          a: selectedOption.ra,
          fc: selectedOption.fc,
          dt: selectedOption.dt,
        }));
      }
    } else {
      setFormData((prev) => ({
        ...prev,
        n: selectedName,
      }));
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === "checkbox") {
      setFormData((prev) => ({
        ...prev,
        [name]: checked,
      }));
      return;
    }

    if (type === "select-one") {
      setFormData((prev) => ({
        ...prev,
        [name]: parseInt(value),
      }));
      return;
    }

    if (type === "number") {
      setFormData((prev) => ({
        ...prev,
        [name]: parseInt(value),
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  if (!isOpen) return null;

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
              ${t("addNewNode")}
              ${totalNodes >= maxNodes
                ? html`<span class="text-red-500 text-sm font-normal ml-2">
                    (${t("maximumNodesLimitReached")})
                  </span>`
                : html`<span class="text-gray-500 text-sm font-normal ml-2">
                    (${maxNodes - totalNodes} ${t("nodesRemaining")})
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
              ${devices[selectedDevice].p == 3
                ? html`
                    ${Select({
                      label: t("nodeName"),
                      extra: `${formData.n.length}/20`,
                      name: "n",
                      value: formData.n,
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
                      label: t("nodeName"),
                      extra: `${formData.n.length}/20`,
                      name: "n",
                      value: formData.n,
                      onChange: handleInputChange,
                      required: true,
                      maxlength: CONFIG.MAX_NAME_LENGTH,
                      placeholder: t("nodeName"),
                    })}
                  `}
              ${Select({
                label: t("functionCode"),
                name: "fc",
                value: formData.fc,
                onChange: handleInputChange,
                required: true,
                options: CONFIG.FUNCTION_CODES,
                disabled:
                  (devices[selectedDevice].p === 3 &&
                    IO_NODE_OPTIONS.some((opt) => opt.name === formData.n)) ||
                  devices[selectedDevice].p === 4,
              })}
            </div>
            <div class="grid grid-cols-2 gap-4">
              ${Input({
                type: "text",
                label: t("registerAddress"),
                extra: "(0-65535)",
                name: "a",
                value: formData.a,
                onChange: handleInputChange,
                required: true,
                placeholder: t("registerAddress"),
                disabled:
                  devices[selectedDevice].p === 3 &&
                  IO_NODE_OPTIONS.some((opt) => opt.name === formData.n),
              })}
              ${Select({
                label: t("dataType"),
                name: "dt",
                value: formData.dt,
                onChange: handleInputChange,
                required: true,
                options: CONFIG.DATA_TYPES,
                disabled:
                  devices[selectedDevice].p === 3 &&
                  IO_NODE_OPTIONS.some((opt) => opt.name === formData.n),
              })}
            </div>
            <div class="grid grid-cols-2 gap-4">
              ${Input({
                type: "number",
                label: t("timeout"),
                extra: "(100-65535)ms",
                name: "t",
                value: formData.t,
                onChange: handleInputChange,
                required: true,
                min: CONFIG.MIN_TIMEOUT,
                max: CONFIG.MAX_TIMEOUT,
                placeholder: t("timeout"),
              })}
            </div>
            <div class="grid grid-cols-2 gap-4">
              ${Checkbox({
                label: t("reportingOnChange"),
                name: "er",
                value: formData.er,
                onChange: handleInputChange,
              })}
              ${formData.er &&
              html`
                ${Input({
                  type: "number",
                  label: t("variationRange"),
                  extra: "(1-65535)",
                  name: "vr",
                  value: formData.vr,
                  onChange: handleInputChange,
                  min: 1,
                  max: 65535,
                  placeholder: t("variationRange"),
                  required: formData.er,
                })}
              `}
            </div>
            <div class="grid grid-cols-2 gap-4">
              ${Checkbox({
                label: t("enableAddressMapping"),
                name: "em",
                value: formData.em,
                onChange: handleInputChange,
              })}
              ${formData.em &&
              html`
                ${Input({
                  type: "number",
                  label: t("mappedRegisterAddress"),
                  extra: "(0-65534)",
                  name: "ma",
                  value: formData.ma,
                  onChange: handleInputChange,
                  required: formData.em,
                  min: 0,
                  max: 65534,
                  placeholder: t("mappedRegisterAddress"),
                })}
              `}
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div class="col-span-2">
                ${Input({
                  type: "text",
                  label: t("calculationFormula"),
                  name: "fo",
                  extra: `${formData.fo ? formData.fo.length : 0}/20`,
                  value: formData.fo,
                  onChange: handleInputChange,
                  maxlength: 20,
                  placeholder: t("calculationFormula"),
                  note: t("calculationFormulaNote"),
                })}
              </div>
            </div>
            <div class="flex justify-center space-x-3 mt-6">
              <button
                type="button"
                onClick=${onClose}
                class="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                ${t("cancel")}
              </button>
              <button
                type="submit"
                class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                ${t("save")}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
}

function EventModal({
  isOpen,
  onClose,
  onSubmit,
  event,
  isEditing,
  events = [],
  nodes = [],
}) {
  const { t } = useLanguage();
  const [formData, setFormData] = useState(
    event || {
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
    }
  );

  // Add function to determine which threshold fields should be shown
  const getThresholdVisibility = useMemo(() => {
    const condition = parseInt(formData.c);
    return {
      showUpper: ![1, 2, 4, 8].includes(condition),
      showLower: ![1, 2, 3, 7].includes(condition),
    };
  }, [formData.c]);

  // Add function to determine if trigger action should be shown
  const showTriggerAction = useMemo(() => {
    const condition = parseInt(formData.c);
    return ![1, 2].includes(condition);
  }, [formData.c]);

  const handleInputChange = (e) => {
    const { name, type, value, checked } = e.target;

    if (type === "checkbox") {
      setFormData((prev) => ({
        ...prev,
        [name]: checked,
      }));
      return;
    }

    if (type === "number") {
      setFormData((prev) => ({
        ...prev,
        [name]: parseInt(value),
      }));
      return;
    }

    if (type === "select-one") {
      setFormData((prev) => ({
        ...prev,
        [name]: parseInt(value),
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onSubmit(formData);
  };

  useEffect(() => {
    if (isOpen) {
      if (isEditing && event) {
        setFormData({
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
      } else {
        const nextName = getNextName(2, events);
        setFormData({
          n: nextName,
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
      }
    }
  }, [isOpen, isEditing, event, events, nodes]);

  if (!isOpen) return null;

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
              ${t("addNewEvent")}
              ${events.length >= 10
                ? html`<span class="text-red-500 text-sm font-normal ml-2">
                    (${t("maximumEventsLimitReached")})
                  </span>`
                : html`<span class="text-gray-500 text-sm font-normal ml-2">
                    (${10 - events.length} ${t("eventsRemaining")})
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
                label: t("eventName"),
                extra: `${formData.n.length}/20`,
                name: "n",
                value: formData.n,
                onChange: handleInputChange,
                required: true,
                maxlength: 20,
                placeholder: t("eventName"),
              })}
              ${Checkbox({
                label: t("enableEvent"),
                name: "e",
                value: formData.e,
                onChange: handleInputChange,
              })}
            </div>

            <div class="grid grid-cols-2 gap-4">
              ${Select({
                label: t("triggerCondition"),
                name: "c",
                value: formData.c,
                onChange: handleInputChange,
                required: true,
                options: TRIGGER_CONDITIONS,
              })}
              ${Select({
                label: t("triggerPoint"),
                name: "p",
                value: formData.p,
                onChange: (e) => {
                  setFormData((prev) => ({
                    ...prev,
                    p: e.target.value,
                  }));
                },
                required: true,
                disabled: nodes.length === 0,
                options_extra: nodes,
              })}
            </div>

            <div class="grid grid-cols-2 gap-4">
              ${Input({
                type: "number",
                label: t("scanCycle"),
                extra: "(0-10000)ms",
                name: "sc",
                value: formData.sc,
                onChange: handleInputChange,
                required: true,
                min: 0,
                max: 10000,
                step: 10,
                placeholder: t("scanCycle"),
              })}
              ${Input({
                type: "number",
                label: t("minTriggerTime"),
                extra: "(500-10000)ms",
                name: "mi",
                value: formData.mi,
                onChange: handleInputChange,
                required: true,
                min: 500,
                max: 10000,
                step: 100,
                placeholder: t("minTriggerTime"),
              })}
            </div>

            <div class="grid grid-cols-2 gap-4">
              ${Input({
                type: "number",
                label: t("upperThreshold"),
                name: "ut",
                value: formData.ut,
                onChange: handleInputChange,
                placeholder: t("upperThreshold"),
                required: [3, 5, 6, 7].includes(parseInt(formData.c)),
                disabled: !getThresholdVisibility.showUpper,
                note: t("thresholdNote"),
              })}
              ${Input({
                type: "number",
                label: t("lowerThreshold"),
                name: "lt",
                value: formData.lt,
                onChange: handleInputChange,
                required: [4, 5, 6, 8].includes(parseInt(formData.c)),
                disabled: !getThresholdVisibility.showLower,
                placeholder: t("lowerThreshold"),
                note: t("thresholdNote"),
              })}
            </div>

            <div class="grid grid-cols-2 gap-4">
              ${Select({
                label: t("triggerExecution"),
                name: "te",
                value: formData.te,
                onChange: handleInputChange,
                required: true,
                options: TRIGGER_EXECUTIONS,
              })}
              ${showTriggerAction &&
              html`
                ${Select({
                  label: t("triggerAction"),
                  name: "ta",
                  value: formData.ta,
                  onChange: handleInputChange,
                  options: TRIGGER_ACTIONS,
                })}
              `}
            </div>
            ${Input({
              type: "text",
              label: t("eventDescription"),
              extra: `${formData.d.length}/20`,
              name: "d",
              value: formData.d,
              onChange: handleInputChange,
              placeholder: t("eventDescription"),
              maxlength: 20,
              required: true,
            })}

            <div class="flex justify-center space-x-3 mt-4">
              <button
                type="button"
                onClick=${onClose}
                class="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                ${t("cancel")}
              </button>
              <button
                type="submit"
                class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                ${t("save")}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
}

// Add this function before the Devices component
function getNextName(type, devices, selectedDeviceIndex = -1) {
  if (type === 0) {
    // Device name
    const maxNum = devices.length + 1;
    for (let i = 1; i < maxNum + 1; i++) {
      let flag = 0;
      const nextDeviceName = "device" + (i < 10 ? "0" + i : i);

      // Check if name exists in any device
      for (let j = 0; j < devices.length; j++) {
        if (nextDeviceName === devices[j].n) {
          flag = 1;
          break;
        }
      }

      if (flag === 0) {
        return nextDeviceName;
      }
    }
  } else if (type === 1) {
    // Node name
    if (selectedDeviceIndex === -1 || !devices[selectedDeviceIndex]) {
      return null;
    }

    const deviceNum = selectedDeviceIndex + 1;
    const maxNum = (devices[selectedDeviceIndex].ns?.length || 0) + 1;

    for (let i = 1; i < maxNum + 1; i++) {
      let flag = 0;
      const nextNodeName =
        "node" +
        (deviceNum < 10 ? "0" + deviceNum : deviceNum) +
        (i < 10 ? "0" + i : i);

      // Check if name exists in current device's nodes
      if (devices[selectedDeviceIndex].ns) {
        for (let j = 0; j < devices[selectedDeviceIndex].ns.length; j++) {
          if (nextNodeName === devices[selectedDeviceIndex].ns[j].n) {
            flag = 1;
            break;
          }
        }
      }

      if (flag === 0) {
        return nextNodeName;
      }
    }
  } else if (type === 2) {
    // Event name
    const maxNum = devices.length + 1;
    for (let i = 1; i < maxNum + 1; i++) {
      let flag = 0;
      const nextEventName = "event" + (i < 10 ? "0" + i : i);

      // Check if name exists in any event
      for (let j = 0; j < devices.length; j++) {
        if (nextEventName === devices[j].n) {
          flag = 1;
          break;
        }
      }

      if (flag === 0) {
        return nextEventName;
      }
    }
  }

  return null; // Return null if no unique name found
}

function Devices() {
  const { t } = useLanguage();
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
  const [events, setEvents] = useState([]);
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

  // Edit states
  const [editingDeviceIndex, setEditingDeviceIndex] = useState(null);
  const [editingNodeIndex, setEditingNodeIndex] = useState(null);
  const [editingEventIndex, setEditingEventIndex] = useState(null);
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
  const [isNodeModalOpen, setIsNodeModalOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);

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
      setEdgeComputingEnabled(edgeData.enabled || false);
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

      const [edgeResponse, deviceResponse, reportResponse, eventResponse] =
        await Promise.all([
          fetch("/api/edge-computing/set", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              enabled: edgeComputingEnabled,
            }),
          }),
          fetch("/api/device/set", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(devices),
          }),
          fetch("/api/report/set", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(reportConfig),
          }),
          fetch("/api/event/set", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(events),
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

  // Add new function to check node name uniqueness across all devices
  const isNodeNameUniqueAcrossDevices = (
    name,
    excludeDeviceIndex = -1,
    excludeNodeIndex = -1
  ) => {
    return !devices.some((device, deviceIndex) => {
      // Skip the excluded device
      // if (deviceIndex === excludeDeviceIndex) return false;

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

  // Add function to check if event name is unique
  const isEventNameUnique = (name, excludeId = null) => {
    return !events.some(
      (event) =>
        event.id !== excludeId && event.n.toLowerCase() === name.toLowerCase()
    );
  };

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

    if (type === "number") {
      setReportConfig((prev) => ({
        ...prev,
        [name]: parseInt(value) || 0,
      }));
      return;
    }

    if (type === "select-one") {
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

  const startDeviceEditing = (deviceIndex) => {
    setEditingDeviceIndex(deviceIndex);
    setIsDeviceModalOpen(true);
  };

  const handleDeviceAdd = () => {
    if (devices.length >= CONFIG.MAX_DEVICES) {
      alert(
        `Maximum number of devices (${CONFIG.MAX_DEVICES}) reached. Cannot add more devices.`
      );
      return;
    }
    setEditingDeviceIndex(null);
    setIsDeviceModalOpen(true);
  };

  const handleDeviceSubmit = (formData) => {
    if (editingDeviceIndex !== null) {
      // Update existing device
      if (!isDeviceNameUnique(formData.n, editingDeviceIndex)) {
        alert(
          "A device with this name already exists. Please use a unique name."
        );
        return;
      }
      const newDevices = [...devices];
      newDevices[editingDeviceIndex] = {
        ...formData,
        ns: devices[editingDeviceIndex].ns || [],
      };
      setDevices(newDevices);
    } else {
      // Add new device
      if (!isDeviceNameUnique(formData.n)) {
        alert(
          "A device with this name already exists. Please use a unique name."
        );
        return;
      }
      setDevices((prev) => [...prev, { ...formData, ns: [] }]);
    }
    setIsDeviceModalOpen(false);
    setEditingDeviceIndex(null);
  };

  const handleDeviceDelete = (index) => {
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

  const handleNodeAdd = () => {
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

    setEditingNodeIndex(null);
    setIsNodeModalOpen(true);
  };

  const startNodeEditing = (nodeIndex) => {
    if (selectedDevice === null || !devices[selectedDevice]?.ns?.[nodeIndex]) {
      alert("Invalid node selection");
      return;
    }
    setEditingNodeIndex(nodeIndex);
    setIsNodeModalOpen(true);
  };

  const handleNodeSubmit = (formData) => {
    if (editingNodeIndex !== null) {
      // Update existing node
      if (
        !isNodeNameUniqueAcrossDevices(
          formData.n,
          selectedDevice,
          editingNodeIndex
        )
      ) {
        alert(
          "A node with this name already exists in any device. Please use a unique name."
        );
        return;
      }
      const updatedDevices = devices.map((device, index) => {
        if (index === selectedDevice) {
          const updatedNodes = [...device.ns];
          updatedNodes[editingNodeIndex] = formData;
          return { ...device, ns: updatedNodes };
        }
        return device;
      });
      setDevices(updatedDevices);
    } else {
      // Add new node
      if (!isNodeNameUniqueAcrossDevices(formData.n, selectedDevice)) {
        alert(
          "A node with this name already exists in any device. Please use a unique name."
        );
        return;
      }
      const updatedDevices = devices.map((device, index) => {
        if (index === selectedDevice) {
          return {
            ...device,
            ns: [...(device.ns || []), formData],
          };
        }
        return device;
      });
      setDevices(updatedDevices);
    }
    setIsNodeModalOpen(false);
    setEditingNodeIndex(null);
  };

  const handleNodeDelete = (nodeIndex) => {
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

  const handleEventAdd = () => {
    if (events.length >= 10) {
      alert("Maximum number of events reached. Cannot add more events.");
      return;
    }
    setEditingEventIndex(null);
    setIsEventModalOpen(true);
  };

  const startEventEditing = (eventIndex) => {
    setEditingEventIndex(eventIndex);
    setIsEventModalOpen(true);
  };

  const handleEventSubmit = (formData) => {
    if (editingEventIndex !== null) {
      // Update existing event
      if (!isEventNameUnique(formData.n, editingEventIndex)) {
        alert(
          "A event with this name already exists. Please use a unique name."
        );
        return;
      }
      const updatedEvents = [...events];
      updatedEvents[editingEventIndex] = formData;
      setEvents(updatedEvents);
    } else {
      // Add new event
      if (!isEventNameUnique(formData.n)) {
        alert(
          "A event with this name already exists. Please use a unique name."
        );
        return;
      }
      setEvents((prev) => [...prev, formData]);
    }
    setIsEventModalOpen(false);
    setEditingEventIndex(null);
  };

  const handleEventDelete = (eventIndex) => {
    const eventName = events[eventIndex].n;
    if (confirm(`Are you sure you want to delete event "${eventName}"?`)) {
      const newEvents = events.filter((_, i) => i !== eventIndex);
      setEvents(newEvents);
      if (selectedEvent === eventIndex) {
        setSelectedEvent(null);
      }
    }
  };

  const renderEdgeComputingTab = () => {
    return html`
      <div class="bg-white rounded-lg shadow-md p-6">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-semibold text-gray-800">
            ${t("edgeComputingSettings")}
          </h2>
        </div>
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                ${t("enableEdgeComputing")}
              </label>
              <p class="text-sm text-gray-500">
                ${t("edgeComputingDescription")}
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
              ${t("edgeComputingStatusUpdatedSuccessfully")}
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
            ${t("devicesConfig")}
            <span class="text-sm text-gray-500 font-normal">
              (${devices.length}/${CONFIG.MAX_DEVICES} ${t("devices")})
            </span>
          </h2>
          <${Button}
            onClick=${handleDeviceAdd}
            disabled=${devices.length >= CONFIG.MAX_DEVICES}
            variant="primary"
            icon="PlusIcon"
          >
            ${t("addDevice")}
          <//>
        </div>

        <${DeviceModal}
          isOpen=${isDeviceModalOpen}
          onClose=${() => {
            setIsDeviceModalOpen(false);
            setEditingDeviceIndex(null);
          }}
          onSubmit=${handleDeviceSubmit}
          device=${editingDeviceIndex !== null
            ? devices[editingDeviceIndex]
            : null}
          isEditing=${editingDeviceIndex !== null}
          devices=${devices}
        />

        <!-- Devices Table -->
        <div class="bg-white rounded-lg shadow-md overflow-hidden mb-8">
          <div class="max-h-[60vh] overflow-y-auto">
            <table
              class="min-w-full divide-y divide-gray-200 table-fixed table-hover"
            >
              <thead class="bg-gray-50">
                <tr>
                  <${Th}>${t("id")}<//>
                  <${Th}>${t("deviceName")}<//>
                  <${Th}>${t("port")}<//>
                  <${Th}>${t("protocol")}<//>
                  <${Th}>${t("slaveAddress")}<//>
                  <${Th}>${t("pollingInterval")}<//>
                  <${Th}>${t("addressMapping")}<//>
                  <${Th}>${t("mergeCollection")}<//>
                  <${Th}>${t("actions")}<//>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                ${devices.length === 0 &&
                html`
                  <tr>
                    <td
                      colspan="9"
                      class="px-6 py-4 text-sm text-gray-500 text-center"
                    >
                      ${t("noDevicesConfiguredYet")}
                    </td>
                  </tr>
                `}
                ${devices.map(
                  (device, index) => html`
                    <tr
                      key=${index}
                      class=${selectedDevice === index
                        ? "bg-blue-50"
                        : "hover:bg-gray-50"}
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
                        ${device.em ? `${t("yes")}` : `${t("no")}`}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        ${device.g ? `${t("yes")}` : `${t("no")}`}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap space-x-2">
                        <button
                          onClick=${(e) => {
                            e.stopPropagation();
                            startDeviceEditing(index);
                          }}
                          class="text-blue-600 hover:text-blue-900 mr-2"
                        >
                          ${t("edit")}
                        </button>
                        <button
                          onClick=${(e) => {
                            e.stopPropagation();
                            handleDeviceDelete(index);
                          }}
                          class="text-red-600 hover:text-red-900"
                        >
                          ${t("delete")}
                        </button>
                      </td>
                    </tr>
                  `
                )}
              </tbody>
            </table>
          </div>
        </div>

        ${selectedDevice !== null &&
        html`
          <div class="mt-8">
            <div class="flex justify-between items-center mb-4">
              <h2 class="text-xl font-semibold">
                ${t("nodeConfig")} ${devices[selectedDevice].n}
                <span class="text-sm text-gray-500 font-normal">
                  (${t("deviceNodes")}: ${selectedDeviceNodes.length},
                  ${t("totalNodes")}: ${totalNodes}/${CONFIG.MAX_TOTAL_NODES})
                </span>
              </h2>
              <${Button}
                onClick=${handleNodeAdd}
                disabled=${totalNodes >= CONFIG.MAX_TOTAL_NODES}
                variant="primary"
                icon="PlusIcon"
              >
                ${t("addNewNode")}
              <//>
            </div>

            <!-- Node Modal -->
            <${NodeModal}
              isOpen=${isNodeModalOpen}
              onClose=${() => {
                setIsNodeModalOpen(false);
                setEditingNodeIndex(null);
              }}
              onSubmit=${handleNodeSubmit}
              node=${editingNodeIndex !== null &&
              selectedDevice !== null &&
              devices[selectedDevice]?.ns?.[editingNodeIndex]
                ? devices[selectedDevice].ns[editingNodeIndex]
                : null}
              isEditing=${editingNodeIndex !== null}
              selectedDevice=${selectedDevice}
              devices=${devices}
              totalNodes=${totalNodes}
              maxNodes=${CONFIG.MAX_TOTAL_NODES}
            />

            <!-- Nodes Table -->
            <div class="bg-white rounded-lg shadow-md overflow-hidden">
              <div class="max-h-[60vh] overflow-y-auto">
                <table class="min-w-full divide-y divide-gray-200 table-fixed">
                  <thead class="bg-gray-50">
                    <tr>
                      <${Th}>${t("id")}<//>
                      <${Th}>${t("nodeName")}<//>
                      <${Th}>${t("registerAddress")}<//>
                      <${Th}>${t("functionCode")}<//>
                      <${Th}>${t("dataType")}<//>
                      <${Th}>${t("timeout")}<//>
                      <${Th}>${t("actions")}<//>
                    </tr>
                  </thead>
                  <tbody class="bg-white divide-y divide-gray-200">
                    ${selectedDeviceNodes.length === 0 &&
                    html`
                      <tr>
                        <td
                          colspan="7"
                          class="px-6 py-4 text-sm text-gray-500 text-center"
                        >
                          ${t("noNodesConfiguredYet")}
                        </td>
                      </tr>
                    `}
                    ${selectedDeviceNodes.map(
                      (node, nodeIndex) => html`
                        <tr key=${nodeIndex} class="hover:bg-gray-50">
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
                                onClick=${() => startNodeEditing(nodeIndex)}
                                class="text-blue-600 hover:text-blue-900"
                              >
                                ${t("edit")}
                              </button>
                              <button
                                onClick=${() => handleNodeDelete(nodeIndex)}
                                class="text-red-600 hover:text-red-900"
                              >
                                ${t("delete")}
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
                <h2 class="text-xl font-semibold mb-4">${t("dataChannel")}</h2>

                <!-- Channel Selection -->
                ${Select({
                  name: "channel",
                  label: `${t("reportChannel")}`,
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
              <h2 class="text-xl font-semibold mb-4">${t("dataQuerySet")}</h2>
              ${Checkbox({
                name: "mqttDataQuerySet",
                label: `${t("enableDataQuerySet")}`,
                value: reportConfig.mqttDataQuerySet,
                onChange: handleReportConfigChange,
              })}
              ${reportConfig.mqttDataQuerySet &&
              html`
                ${Select({
                  name: "mqttQuerySetType",
                  label: `${t("querySetType")}`,
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
                  label: `${t("querySetTopic")}`,
                  value: reportConfig.mqttQuerySetTopic,
                  onChange: handleReportConfigChange,
                  maxlength: 64,
                  placeholder: `${t("querySetTopic")}`,
                })}
                ${Select({
                  name: "mqttQuerySetQos",
                  label: `${t("querySetQos")}`,
                  value: reportConfig.mqttQuerySetQos,
                  onChange: handleReportConfigChange,
                  options: CONFIG.MQTT_QOS_OPTIONS,
                })}
                ${Input({
                  type: "text",
                  name: "mqttRespondTopic",
                  extra: `${reportConfig.mqttRespondTopic.length}/64`,
                  label: `${t("respondTopic")}`,
                  value: reportConfig.mqttRespondTopic,
                  onChange: handleReportConfigChange,
                  maxlength: 64,
                  placeholder: `${t("respondTopic")}`,
                })}
                ${Checkbox({
                  name: "mqttRetainedMessage",
                  label: `${t("retainedMessage")}`,
                  value: reportConfig.mqttRetainedMessage,
                  onChange: handleReportConfigChange,
                })}
              `}
            </div>
          </div>
          <div class="bg-white rounded-lg shadow-md p-6">
            <h2 class="text-xl font-semibold mb-4">${t("dataReport")}</h2>
            <!-- Enable/Disable -->
            <div class="mb-4">
              ${Checkbox({
                name: "enabled",
                label: `${t("enableDataReport")}`,
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
                    label: `${t("reportTopic")}`,
                    value: reportConfig.mqttTopic,
                    onChange: handleReportConfigChange,
                    maxlength: 64,
                    placeholder: `${t("reportTopic")}`,
                  })}
                  ${Select({
                    name: "mqttQos",
                    label: `${t("reportQos")}`,
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
                  label: `${t("enablePeriodicReporting")}`,
                  value: reportConfig.periodicEnabled,
                  onChange: handleReportConfigChange,
                })}
                ${reportConfig.periodicEnabled &&
                html`
                  ${Input({
                    type: "number",
                    name: "periodicInterval",
                    extra: "(1-36000)s",
                    label: `${t("reportingInterval")}`,
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
                  label: `${t("enableRegularReporting")}`,
                  value: reportConfig.regularEnabled,
                  onChange: handleReportConfigChange,
                })}
                ${reportConfig.regularEnabled &&
                html`
                  ${Select({
                    name: "regularInterval",
                    label: `${t("regularTime")}`,
                    value: reportConfig.regularInterval,
                    onChange: handleReportConfigChange,
                    options: CONFIG.REPORT_INTERVALS,
                  })}
                  ${reportConfig.regularInterval === 4 &&
                  html`
                    ${Input({
                      type: "time",
                      name: "regularFixedTime",
                      label: `${t("fixedTime")}`,
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
                  label: `${t("enableFailurePadding")}`,
                  value: reportConfig.failurePaddingEnabled,
                  onChange: handleReportConfigChange,
                })}
                ${reportConfig.failurePaddingEnabled &&
                html`
                  ${Input({
                    type: "text",
                    name: "failurePaddingContent",
                    label: `${t("contentOfFailurePadding")}`,
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
                  label: `${t("quotationMark")}`,
                  value: reportConfig.quotationMark,
                  onChange: handleReportConfigChange,
                })}
              </div>

              <!-- JSON Template -->
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">
                  ${t("jsonTemplate")}
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
                    placeholder=${t("enterJsonTemplate")}
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
                  ${t("exampleFormat")}:
                  {"temperature":"node11","humidity":"node12"}
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
            ${t("events")}
            <span class="text-sm text-gray-500 font-normal">
              (${events.length}/10 ${t("eventsConfigured")})
            </span>
          </h2>
          <${Button}
            onClick=${handleEventAdd}
            variant="primary"
            icon="PlusIcon"
          >
            ${t("addEvent")}
          <//>
        </div>

        <${EventModal}
          isOpen=${isEventModalOpen}
          onClose=${() => {
            setIsEventModalOpen(false);
            setEditingEventIndex(null);
          }}
          onSubmit=${handleEventSubmit}
          event=${editingEventIndex !== null ? events[editingEventIndex] : null}
          isEditing=${editingEventIndex !== null}
          events=${events}
          nodes=${getAllNodes}
        />

        <!-- Events List -->
        <div class="bg-gray-50 rounded-lg">
          <div class="bg-white rounded-lg shadow-md overflow-hidden">
            <div class="max-h-[60vh] overflow-y-auto">
              <table class="min-w-full divide-y divide-gray-200 table-fixed">
                <thead class="bg-gray-50">
                  <tr>
                    <${Th}>${t("eventName")}<//>
                    <${Th}>${t("status")}<//>
                    <${Th}>${t("condition")}<//>
                    <${Th}>${t("triggerPoint")}<//>
                    <${Th}>${t("triggerAction")}<//>
                    <${Th}>${t("execution")}<//>
                    <${Th}>${t("scanCycle")}<//>
                    <${Th}>${t("minTriggerTime")}<//>
                    <${Th}>${t("actions")}<//>
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
                            ${t("noEventsConfiguredYet")}
                          </td>
                        </tr>
                      `
                    : events.map(
                        (event, eventIndex) => html`
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
                                ${event.e ? t("enabled") : t("disabled")}
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
                                ? t("noAction")
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
                                    startEventEditing(eventIndex);
                                  }}
                                  class="text-blue-600 hover:text-blue-900"
                                >
                                  ${t("edit")}
                                </button>
                                <button
                                  onClick=${(e) => {
                                    e.stopPropagation();
                                    handleEventDelete(eventIndex);
                                  }}
                                  class="text-red-600 hover:text-red-900"
                                >
                                  ${t("delete")}
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
      </div>
    `;
  };

  // Reset modal states when tab changes
  useEffect(() => {
    setEditingDeviceIndex(null);
    setEditingNodeIndex(null);
    setEditingEventIndex(null);
  }, [activeTab]);

  // Update useEffect to only call fetchDeviceConfig
  useEffect(() => {
    document.title = "SBIOT-Devices";
    fetchDeviceConfig();
  }, []);

  const tabs = [
    {
      id: "edge-computing",
      label: ` ${t("edgeComputing")}`,
    },
    {
      id: "devices",
      label: `${t("dataAcquisition")}`,
      disabled: edgeComputingEnabled === false,
    },
    {
      id: "report",
      label: `${t("dataQueryAndReport")}`,
      disabled: edgeComputingEnabled === false,
    },
    {
      id: "linkage-control",
      label: `${t("linkageControl")}`,
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
          ${t("cancel")}
        <//>
        <${Button}
          onClick=${saveDeviceConfig}
          disabled=${isSaving}
          loading=${isSaving}
          icon="SaveIcon"
        >
          ${isSaving ? t("saving") : t("save")}
        <//>
      </div>
    </div>
  `;
}

export default Devices;
