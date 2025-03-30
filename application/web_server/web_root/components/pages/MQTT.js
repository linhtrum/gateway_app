import { h, html, useState, useEffect } from "../../bundle.js";
import { Button, Icons, Tabs } from "../Components.js";

const CONFIG = {
  MQTT_VERSIONS: [
    [1, "MQTT-3.0"],
    [2, "MQTT-3.1.1"],
  ],
  SSL_PROTOCOLS: [
    [0, "Disable"],
    [1, "TLS1.0"],
    [2, "TLS1.2"],
  ],
  SSL_VERIFY_OPTIONS: [
    [0, "None"],
    [1, "Verify Server Certificate"],
    [2, "Verify all"],
  ],
  TRANSMISSION_MODES: {
    PUBLISH: [
      [0, "Transparent"],
      [1, "Distribution"],
    ],
    SUBSCRIBE: [
      [0, "Without Topic"],
      [1, "With Topic"],
    ],
  },
  BINDING_PORTS: [
    [1, "Serial 1"],
    [2, "Serial 2"],
  ],
  QOS_OPTIONS: [
    [0, "QOS0 - At most once"],
    [1, "QOS1 - At least once"],
    [2, "QOS2 - Exactly once"],
  ],
};

function MQTT() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState("config");

  // MQTT Configuration state
  const [mqttConfig, setMqttConfig] = useState({});

  // Publish Configuration state
  const [publishConfig, setPublishConfig] = useState([]);

  // Subscribe Configuration state
  const [subscribeConfig, setSubscribeConfig] = useState([]);

  const validateClientId = (id) => {
    if (!id) return "Client ID is required";
    if (id.length > 32) return "Client ID must not exceed 32 characters";
    return null;
  };

  const validateServerAddress = (address) => {
    if (!address) return "Server address is required";
    if (address.length > 64)
      return "Server address must not exceed 64 characters";
    return null;
  };

  const validatePort = (port) => {
    const portNum = parseInt(port);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      return "Port must be between 1 and 65535";
    }
    return null;
  };

  const validateKeepAlive = (keepAlive) => {
    const value = parseInt(keepAlive);
    if (isNaN(value) || value < 0 || value > 65535) {
      return "Keep Alive must be between 0 and 65535 seconds";
    }
    return null;
  };

  const validateReconnectNoData = (value) => {
    const num = parseInt(value);
    if (isNaN(num) || num < 0 || num > 65535) {
      return "Reconnecting without Data must be between 0 and 65535 seconds";
    }
    return null;
  };

  const validateReconnectInterval = (interval) => {
    const value = parseInt(interval);
    if (isNaN(value) || value < 1 || value > 65535) {
      return "Reconnect interval must be between 1 and 65535 seconds";
    }
    return null;
  };

  const validateUsername = (username) => {
    if (username && username.length > 32) {
      return "Username must not exceed 32 characters";
    }
    return null;
  };

  const validatePassword = (password) => {
    if (password && password.length > 32) {
      return "Password must not exceed 32 characters";
    }
    return null;
  };

  const fetchConfigs = async () => {
    try {
      setLoading(true);
      setError(null);

      const [mqttResponse, publishResponse, subscribeResponse] =
        await Promise.all([
          fetch("/api/mqtt/get", {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          }),
          fetch("/api/publish/get", {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          }),
          fetch("/api/subscribe/get", {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          }),
        ]);

      if (!mqttResponse.ok || !publishResponse.ok || !subscribeResponse.ok) {
        throw new Error("Failed to fetch configurations");
      }

      const [mqttData, publishData, subscribeData] = await Promise.all([
        mqttResponse.json(),
        publishResponse.json(),
        subscribeResponse.json(),
      ]);

      setMqttConfig(mqttData || {});
      setPublishConfig(publishData || []);
      setSubscribeConfig(subscribeData || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveConfigs = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      // Validate MQTT configuration
      const errors = {
        clientId: validateClientId(mqttConfig.clientId),
        serverAddress: validateServerAddress(mqttConfig.serverAddress),
        port: validatePort(mqttConfig.port),
        keepAlive: validateKeepAlive(mqttConfig.keepAlive),
        reconnectNoData: validateReconnectNoData(mqttConfig.reconnectNoData),
        reconnectInterval: validateReconnectInterval(
          mqttConfig.reconnectInterval
        ),
        username: validateUsername(mqttConfig.username),
        password: validatePassword(mqttConfig.password),
      };

      const hasErrors = Object.values(errors).some((error) => error !== null);
      if (hasErrors) {
        setError("Please fix the validation errors before saving");
        return;
      }

      const [mqttResponse, publishResponse, subscribeResponse] =
        await Promise.all([
          fetch("/api/mqtt/set", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(mqttConfig),
          }),
          fetch("/api/publish/set", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(publishConfig),
          }),
          fetch("/api/subscribe/set", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(subscribeConfig),
          }),
        ]);

      if (!mqttResponse.ok || !publishResponse.ok || !subscribeResponse.ok) {
        throw new Error("Failed to save configurations");
      }

      setSuccess(true);
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (e, configType) => {
    const { name, value, type, checked } = e.target;
    const config =
      configType === "mqtt"
        ? mqttConfig
        : configType === "publish"
        ? publishConfig
        : subscribeConfig;
    const setConfig =
      configType === "mqtt"
        ? setMqttConfig
        : configType === "publish"
        ? setPublishConfig
        : setSubscribeConfig;

    if (type === "checkbox") {
      setConfig((prev) => ({
        ...prev,
        [name]: checked,
      }));
      return;
    }

    if (type === "number") {
      setConfig((prev) => ({
        ...prev,
        [name]: parseInt(value) || 0,
      }));
      return;
    }

    setConfig((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileUpload = async (e, fileType) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", fileType);

      const response = await fetch(`/api/mqtt/upload/${fileType}`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Failed to upload ${fileType}`);
      }

      const data = await response.json();
      setMqttConfig((prev) => ({
        ...prev,
        [fileType]: data.filename,
      }));
    } catch (err) {
      setError(`Failed to upload ${fileType}: ${err.message}`);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  if (loading) {
    return html`
      <div class="flex items-center justify-center h-full">
        <${Icons.SpinnerIcon} className="h-8 w-8 text-blue-600" />
      </div>
    `;
  }

  const tabs = [
    { id: "config", label: "CONFIG" },
    { id: "publish", label: "PUBLISH" },
    { id: "subscribe", label: "SUBSCRIBE" },
  ];

  const validateTopicString = (topic) => {
    if (!topic) return "Topic string is required";
    if (topic.length > 70) return "Topic string must not exceed 70 characters";
    return null;
  };

  const validateTopicAlias = (alias) => {
    if (alias && alias.length > 70)
      return "Topic alias must not exceed 70 characters";
    return null;
  };

  return html`
    <div class="p-6">
      <h1 class="text-2xl font-bold mb-6">MQTT Configuration</h1>

      ${error &&
      html`
        <div
          class="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded flex items-center justify-between"
        >
          <div>${error}</div>
          <button
            onClick=${fetchConfigs}
            class="px-3 py-1 bg-red-200 hover:bg-red-300 rounded-md text-red-800 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            Retry
          </button>
        </div>
      `}
      ${success &&
      html`
        <div
          class="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded"
        >
          Configuration saved successfully! System will reload to apply
          changes...
        </div>
      `}

      <${Tabs}
        tabs=${tabs}
        activeTab=${activeTab}
        onTabChange=${setActiveTab}
      />

      <div class="max-w-[60%] mx-auto">
        <div class="bg-white shadow rounded-lg p-6">
          ${activeTab === "config"
            ? html`
                <div class="space-y-6">
                  <!-- Existing MQTT configuration form -->
                  <div class="flex items-center">
                    <input
                      type="checkbox"
                      name="enabled"
                      checked=${mqttConfig.enabled}
                      onChange=${(e) => handleInputChange(e, "mqtt")}
                      class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label class="ml-2 block text-sm text-gray-900"
                      >Enable MQTT</label
                    >
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2"
                      >MQTT Version</label
                    >
                    <select
                      name="version"
                      value=${mqttConfig.version}
                      onChange=${(e) => handleInputChange(e, "mqtt")}
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled=${!mqttConfig.enabled}
                    >
                      ${CONFIG.MQTT_VERSIONS.map(
                        ([value, label]) => html`
                          <option value=${value}>${label}</option>
                        `
                      )}
                    </select>
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2"
                      >Client ID</label
                    >
                    <input
                      type="text"
                      name="clientId"
                      value=${mqttConfig.clientId}
                      onChange=${(e) => handleInputChange(e, "mqtt")}
                      maxlength="32"
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled=${!mqttConfig.enabled}
                    />
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2"
                      >Server Address</label
                    >
                    <input
                      type="text"
                      name="serverAddress"
                      value=${mqttConfig.serverAddress}
                      onChange=${(e) => handleInputChange(e, "mqtt")}
                      maxlength="64"
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled=${!mqttConfig.enabled}
                    />
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2"
                      >Port</label
                    >
                    <input
                      type="number"
                      name="port"
                      value=${mqttConfig.port}
                      onChange=${(e) => handleInputChange(e, "mqtt")}
                      min="1"
                      max="65535"
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled=${!mqttConfig.enabled}
                    />
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2"
                      >Keep Alive (seconds)</label
                    >
                    <input
                      type="number"
                      name="keepAlive"
                      value=${mqttConfig.keepAlive}
                      onChange=${(e) => handleInputChange(e, "mqtt")}
                      min="0"
                      max="65535"
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled=${!mqttConfig.enabled}
                    />
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2"
                      >Reconnecting without Data (seconds)</label
                    >
                    <input
                      type="number"
                      name="reconnectNoData"
                      value=${mqttConfig.reconnectNoData}
                      onChange=${(e) => handleInputChange(e, "mqtt")}
                      min="0"
                      max="65535"
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled=${!mqttConfig.enabled}
                    />
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2"
                      >Reconnect Interval (seconds)</label
                    >
                    <input
                      type="number"
                      name="reconnectInterval"
                      value=${mqttConfig.reconnectInterval}
                      onChange=${(e) => handleInputChange(e, "mqtt")}
                      min="1"
                      max="65535"
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled=${!mqttConfig.enabled}
                    />
                  </div>

                  <div class="flex items-center">
                    <input
                      type="checkbox"
                      name="cleanSession"
                      checked=${mqttConfig.cleanSession}
                      onChange=${(e) => handleInputChange(e, "mqtt")}
                      class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      disabled=${!mqttConfig.enabled}
                    />
                    <label class="ml-2 text-sm text-gray-700"
                      >Clean Session</label
                    >
                  </div>

                  <div class="flex items-center">
                    <input
                      type="checkbox"
                      name="useCredentials"
                      checked=${mqttConfig.useCredentials}
                      onChange=${(e) => handleInputChange(e, "mqtt")}
                      class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      disabled=${!mqttConfig.enabled}
                    />
                    <label class="ml-2 text-sm text-gray-700"
                      >User Credentials</label
                    >
                  </div>

                  ${mqttConfig.useCredentials &&
                  html`
                    <div>
                      <label
                        class="block text-sm font-medium text-gray-700 mb-2"
                        >Username</label
                      >
                      <input
                        type="text"
                        name="username"
                        value=${mqttConfig.username}
                        onChange=${(e) => handleInputChange(e, "mqtt")}
                        maxlength="32"
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled=${!mqttConfig.enabled}
                      />
                    </div>

                    <div>
                      <label
                        class="block text-sm font-medium text-gray-700 mb-2"
                        >Password</label
                      >
                      <input
                        type="password"
                        name="password"
                        value=${mqttConfig.password}
                        onChange=${(e) => handleInputChange(e, "mqtt")}
                        maxlength="32"
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled=${!mqttConfig.enabled}
                      />
                    </div>
                  `}

                  <div class="flex items-center">
                    <input
                      type="checkbox"
                      name="enableLastWill"
                      checked=${mqttConfig.enableLastWill}
                      onChange=${(e) => handleInputChange(e, "mqtt")}
                      class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      disabled=${!mqttConfig.enabled}
                    />
                    <label class="ml-2 text-sm text-gray-700"
                      >Enable Last Will</label
                    >
                  </div>

                  ${mqttConfig.enableLastWill &&
                  html`
                    <div>
                      <label
                        class="block text-sm font-medium text-gray-700 mb-2"
                        >Topic of Will</label
                      >
                      <input
                        type="text"
                        name="lastWillTopic"
                        value=${mqttConfig.lastWillTopic || ""}
                        onChange=${(e) => handleInputChange(e, "mqtt")}
                        maxlength="70"
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled=${!mqttConfig.enabled}
                        placeholder="Enter will topic"
                      />
                    </div>

                    <div>
                      <label
                        class="block text-sm font-medium text-gray-700 mb-2"
                        >Will Message</label
                      >
                      <input
                        type="text"
                        name="lastWillMessage"
                        value=${mqttConfig.lastWillMessage || ""}
                        onChange=${(e) => handleInputChange(e, "mqtt")}
                        maxlength="70"
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled=${!mqttConfig.enabled}
                        placeholder="Enter will message"
                      />
                    </div>

                    <div>
                      <label
                        class="block text-sm font-medium text-gray-700 mb-2"
                        >QoS Level</label
                      >
                      <select
                        name="lastWillQos"
                        value=${mqttConfig.lastWillQos || 0}
                        onChange=${(e) => {
                          const value = parseInt(e.target.value);
                          handleInputChange(
                            {
                              target: {
                                name: "lastWillQos",
                                value: value,
                                type: "number",
                              },
                            },
                            "mqtt"
                          );
                        }}
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled=${!mqttConfig.enabled}
                      >
                        ${CONFIG.QOS_OPTIONS.map(
                          ([value, label]) => html`
                            <option value=${value}>${label}</option>
                          `
                        )}
                      </select>
                    </div>

                    <div class="flex items-center">
                      <input
                        type="checkbox"
                        name="lastWillRetained"
                        checked=${mqttConfig.lastWillRetained}
                        onChange=${(e) => handleInputChange(e, "mqtt")}
                        class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        disabled=${!mqttConfig.enabled}
                      />
                      <label class="ml-2 text-sm text-gray-700"
                        >Retained Message</label
                      >
                    </div>
                  `}

                  <!-- SSL Protocol Configuration -->
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2"
                      >SSL Protocol</label
                    >
                    <select
                      name="sslProtocol"
                      value=${mqttConfig.sslProtocol}
                      onChange=${(e) => {
                        const value = parseInt(e.target.value);
                        handleInputChange(e, "mqtt");
                        // Reset SSL verification to None when SSL is disabled
                        if (value === 0) {
                          setMqttConfig((prev) => ({
                            ...prev,
                            sslVerify: 0,
                          }));
                        }
                      }}
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled=${!mqttConfig.enabled}
                    >
                      ${CONFIG.SSL_PROTOCOLS.map(
                        ([value, label]) => html`
                          <option value=${value}>${label}</option>
                        `
                      )}
                    </select>
                  </div>

                  ${mqttConfig.sslProtocol !== 0 &&
                  html`
                    <div>
                      <label
                        class="block text-sm font-medium text-gray-700 mb-2"
                        >SSL Verification</label
                      >
                      <select
                        name="sslVerify"
                        value=${mqttConfig.sslVerify}
                        onChange=${(e) => handleInputChange(e, "mqtt")}
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled=${!mqttConfig.enabled ||
                        mqttConfig.sslProtocol === 0}
                      >
                        ${CONFIG.SSL_VERIFY_OPTIONS.map(
                          ([value, label]) => html`
                            <option value=${value}>${label}</option>
                          `
                        )}
                      </select>
                    </div>

                    ${mqttConfig.sslVerify >= 1 &&
                    html`
                      <div>
                        <label
                          class="block text-sm font-medium text-gray-700 mb-2"
                          >Server CA Certificate</label
                        >
                        <div class="flex items-center space-x-4">
                          <input
                            type="file"
                            accept=".pem,.crt"
                            onChange=${(e) => handleFileUpload(e, "serverCA")}
                            class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            disabled=${!mqttConfig.enabled}
                          />
                          ${mqttConfig.serverCA &&
                          html`
                            <span class="text-sm text-gray-500">
                              ${mqttConfig.serverCA}
                            </span>
                          `}
                        </div>
                      </div>

                      ${mqttConfig.sslVerify >= 2 &&
                      html`
                        <div>
                          <label
                            class="block text-sm font-medium text-gray-700 mb-2"
                            >Client CA Certificate</label
                          >
                          <div class="flex items-center space-x-4">
                            <input
                              type="file"
                              accept=".pem,.crt"
                              onChange=${(e) =>
                                handleFileUpload(e, "clientCertificate")}
                              class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              disabled=${!mqttConfig.enabled}
                            />
                            ${mqttConfig.clientCertificate &&
                            html`
                              <span class="text-sm text-gray-500">
                                ${mqttConfig.clientCertificate}
                              </span>
                            `}
                          </div>
                        </div>

                        <div>
                          <label
                            class="block text-sm font-medium text-gray-700 mb-2"
                            >Client Private Key</label
                          >
                          <div class="flex items-center space-x-4">
                            <input
                              type="file"
                              accept=".pem,.key"
                              onChange=${(e) =>
                                handleFileUpload(e, "clientPrivateKey")}
                              class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              disabled=${!mqttConfig.enabled}
                            />
                            ${mqttConfig.clientPrivateKey &&
                            html`
                              <span class="text-sm text-gray-500">
                                ${mqttConfig.clientPrivateKey}
                              </span>
                            `}
                          </div>
                        </div>
                      `}
                    `}
                  `}
                </div>
              `
            : activeTab === "publish"
            ? html`
                <div class="space-y-6">
                  <!-- Topics List -->
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2"
                      >Publish Topics</label
                    >
                    <div class="space-y-4">
                      ${publishConfig.map((topic, index) => {
                        return html`
                          <div class="border rounded-lg p-4 space-y-4">
                            <div class="flex justify-between items-center">
                              <div class="flex items-center">
                                <input
                                  type="checkbox"
                                  checked=${topic.enabled}
                                  onChange=${(e) => {
                                    const newConfig = [...publishConfig];
                                    newConfig[index] = {
                                      ...newConfig[index],
                                      enabled: e.target.checked,
                                    };
                                    setPublishConfig(newConfig);
                                  }}
                                  class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <h3
                                  class="ml-2 text-sm font-medium text-gray-700"
                                >
                                  Topic ${index + 1}
                                </h3>
                              </div>
                            </div>

                            ${topic.enabled &&
                            html`
                              <!-- Transmission Mode -->
                              <div>
                                <label
                                  class="block text-sm font-medium text-gray-700 mb-2"
                                  >Transmission Mode</label
                                >
                                <select
                                  value=${topic.transmissionMode}
                                  onChange=${(e) => {
                                    const newConfig = [...publishConfig];
                                    newConfig[index] = {
                                      ...newConfig[index],
                                      transmissionMode: parseInt(
                                        e.target.value
                                      ),
                                    };
                                    setPublishConfig(newConfig);
                                  }}
                                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  ${CONFIG.TRANSMISSION_MODES.PUBLISH.map(
                                    ([value, label]) => html`
                                      <option value=${value}>${label}</option>
                                    `
                                  )}
                                </select>
                              </div>

                              <!-- Topic String -->
                              <div>
                                <label
                                  class="block text-sm font-medium text-gray-700 mb-2"
                                  >Topic String</label
                                >
                                <input
                                  type="text"
                                  value=${topic.topicString}
                                  onChange=${(e) => {
                                    const newConfig = [...publishConfig];
                                    newConfig[index] = {
                                      ...newConfig[index],
                                      topicString: e.target.value,
                                    };
                                    setPublishConfig(newConfig);
                                  }}
                                  maxlength="70"
                                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  placeholder="Enter topic string"
                                />
                              </div>

                              <!-- Topic Alias (for distribution mode) -->
                              ${topic.transmissionMode === 1 &&
                              html`
                                <div>
                                  <label
                                    class="block text-sm font-medium text-gray-700 mb-2"
                                    >Topic Alias</label
                                  >
                                  <input
                                    type="text"
                                    value=${topic.topicAlias}
                                    onChange=${(e) => {
                                      const newConfig = [...publishConfig];
                                      newConfig[index] = {
                                        ...newConfig[index],
                                        topicAlias: e.target.value,
                                      };
                                      setPublishConfig(newConfig);
                                    }}
                                    maxlength="70"
                                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Enter topic alias"
                                  />
                                </div>
                              `}

                              <!-- Binding Port -->
                              <div>
                                <label
                                  class="block text-sm font-medium text-gray-700 mb-2"
                                  >Binding Port</label
                                >
                                <select
                                  multiple
                                  onChange=${(e) => {
                                    const select = e.target;
                                    let selectedValue = 0;
                                    for (
                                      let i = 0;
                                      i < select.options.length;
                                      i++
                                    ) {
                                      if (select.options[i].selected) {
                                        selectedValue |= 1 << i;
                                      }
                                    }
                                    setPublishConfig((prev) => {
                                      const newConfig = [...prev];
                                      newConfig[index] = {
                                        ...newConfig[index],
                                        bindingPorts: selectedValue,
                                      };
                                      return newConfig;
                                    });
                                  }}
                                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  ${CONFIG.BINDING_PORTS.map(
                                    ([value, label]) => html`
                                      <option
                                        value=${value}
                                        selected=${(topic.bindingPorts &
                                          value) !==
                                        0}
                                      >
                                        ${label}
                                      </option>
                                    `
                                  )}
                                </select>
                              </div>

                              <!-- QoS -->
                              <div>
                                <label
                                  class="block text-sm font-medium text-gray-700 mb-2"
                                  >QoS Level</label
                                >
                                <select
                                  value=${topic.qos}
                                  onChange=${(e) => {
                                    const newConfig = [...publishConfig];
                                    newConfig[index] = {
                                      ...newConfig[index],
                                      qos: parseInt(e.target.value),
                                    };
                                    setPublishConfig(newConfig);
                                  }}
                                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  ${CONFIG.QOS_OPTIONS.map(
                                    ([value, label]) => html`
                                      <option value=${value}>${label}</option>
                                    `
                                  )}
                                </select>
                              </div>

                              <!-- Retained Message -->
                              <div class="flex items-center">
                                <input
                                  type="checkbox"
                                  checked=${topic.retainedMessage}
                                  onChange=${(e) => {
                                    const newConfig = [...publishConfig];
                                    newConfig[index] = {
                                      ...newConfig[index],
                                      retainedMessage: e.target.checked,
                                    };
                                    setPublishConfig(newConfig);
                                  }}
                                  class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <label class="ml-2 text-sm text-gray-700"
                                  >Retained Message</label
                                >
                              </div>

                              <!-- IO Control/Query -->
                              <div class="flex items-center">
                                <input
                                  type="checkbox"
                                  checked=${topic.ioControlQuery}
                                  onChange=${(e) => {
                                    const newConfig = [...publishConfig];
                                    newConfig[index] = {
                                      ...newConfig[index],
                                      ioControlQuery: e.target.checked,
                                    };
                                    setPublishConfig(newConfig);
                                  }}
                                  class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <label class="ml-2 text-sm text-gray-700"
                                  >IO Control/Query</label
                                >
                              </div>
                            `}
                          </div>
                        `;
                      })}
                    </div>
                  </div>
                </div>
              `
            : html`
                <div class="space-y-6">
                  <!-- Topics List -->
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2"
                      >Subscribe Topics</label
                    >
                    <div class="space-y-4">
                      ${subscribeConfig.map((topic, index) => {
                        return html`
                          <div class="border rounded-lg p-4 space-y-4">
                            <div class="flex justify-between items-center">
                              <div class="flex items-center">
                                <input
                                  type="checkbox"
                                  checked=${topic.enabled}
                                  onChange=${(e) => {
                                    const newConfig = [...subscribeConfig];
                                    newConfig[index] = {
                                      ...newConfig[index],
                                      enabled: e.target.checked,
                                    };
                                    setSubscribeConfig(newConfig);
                                  }}
                                  class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <h3
                                  class="ml-2 text-sm font-medium text-gray-700"
                                >
                                  Topic ${index + 1}
                                </h3>
                              </div>
                            </div>

                            ${topic.enabled &&
                            html`
                              <!-- Transmission Mode -->
                              <div>
                                <label
                                  class="block text-sm font-medium text-gray-700 mb-2"
                                  >Transmission Mode</label
                                >
                                <select
                                  value=${topic.transmissionMode}
                                  onChange=${(e) => {
                                    const newConfig = [...subscribeConfig];
                                    newConfig[index] = {
                                      ...newConfig[index],
                                      transmissionMode: parseInt(
                                        e.target.value
                                      ),
                                    };
                                    setSubscribeConfig(newConfig);
                                  }}
                                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  ${CONFIG.TRANSMISSION_MODES.SUBSCRIBE.map(
                                    ([value, label]) => html`
                                      <option value=${value}>${label}</option>
                                    `
                                  )}
                                </select>
                              </div>

                              <!-- Topic String -->
                              <div>
                                <label
                                  class="block text-sm font-medium text-gray-700 mb-2"
                                  >Topic String</label
                                >
                                <input
                                  type="text"
                                  value=${topic.topicString}
                                  onChange=${(e) => {
                                    const newConfig = [...subscribeConfig];
                                    newConfig[index] = {
                                      ...newConfig[index],
                                      topicString: e.target.value,
                                    };
                                    setSubscribeConfig(newConfig);
                                  }}
                                  maxlength="70"
                                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  placeholder="Enter topic string"
                                />
                              </div>

                              <!-- Delimiter -->
                              ${topic.transmissionMode === 1 &&
                              html`
                                <div>
                                  <label
                                    class="block text-sm font-medium text-gray-700 mb-2"
                                    >Delimiter</label
                                  >
                                  <input
                                    type="text"
                                    value=${topic.delimiter}
                                    onChange=${(e) => {
                                      const newConfig = [...subscribeConfig];
                                      newConfig[index] = {
                                        ...newConfig[index],
                                        delimiter: e.target.value,
                                      };
                                      setSubscribeConfig(newConfig);
                                    }}
                                    maxlength="1"
                                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Enter delimiter"
                                  />
                                </div>
                              `}

                              <!-- Binding Port -->
                              <div>
                                <label
                                  class="block text-sm font-medium text-gray-700 mb-2"
                                  >Binding Port</label
                                >
                                <select
                                  multiple
                                  onChange=${(e) => {
                                    const select = e.target;
                                    let selectedValue = 0;
                                    for (
                                      let i = 0;
                                      i < select.options.length;
                                      i++
                                    ) {
                                      if (select.options[i].selected) {
                                        selectedValue |= 1 << i;
                                      }
                                    }
                                    setSubscribeConfig((prev) => {
                                      const newConfig = [...prev];
                                      newConfig[index] = {
                                        ...newConfig[index],
                                        bindingPorts: selectedValue,
                                      };
                                      return newConfig;
                                    });
                                  }}
                                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  ${CONFIG.BINDING_PORTS.map(
                                    ([value, label]) => html`
                                      <option
                                        value=${value}
                                        selected=${(topic.bindingPorts &
                                          value) !==
                                        0}
                                      >
                                        ${label}
                                      </option>
                                    `
                                  )}
                                </select>
                              </div>

                              <!-- QoS -->
                              <div>
                                <label
                                  class="block text-sm font-medium text-gray-700 mb-2"
                                  >QoS Level</label
                                >
                                <select
                                  value=${topic.qos}
                                  onChange=${(e) => {
                                    const newConfig = [...subscribeConfig];
                                    newConfig[index] = {
                                      ...newConfig[index],
                                      qos: parseInt(e.target.value),
                                    };
                                    setSubscribeConfig(newConfig);
                                  }}
                                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  ${CONFIG.QOS_OPTIONS.map(
                                    ([value, label]) => html`
                                      <option value=${value}>${label}</option>
                                    `
                                  )}
                                </select>
                              </div>

                              <!-- IO Control/Query -->
                              <div class="flex items-center">
                                <input
                                  type="checkbox"
                                  checked=${topic.ioControlQuery}
                                  onChange=${(e) => {
                                    const newConfig = [...subscribeConfig];
                                    newConfig[index] = {
                                      ...newConfig[index],
                                      ioControlQuery: e.target.checked,
                                    };
                                    setSubscribeConfig(newConfig);
                                  }}
                                  class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <label class="ml-2 text-sm text-gray-700"
                                  >IO Control/Query</label
                                >
                              </div>
                            `}
                          </div>
                        `;
                      })}
                    </div>
                  </div>
                </div>
              `}
        </div>
      </div>

      <!-- Save and Cancel Buttons -->
      <div
        class="mt-8 border-t border-gray-200 pt-6 pb-4 flex justify-center gap-4 w-full"
      >
        <${Button}
          onClick=${() => {
            if (confirm("Are you sure you want to discard all changes?")) {
              fetchConfigs();
            }
          }}
          variant="secondary"
          icon="CloseIcon"
          disabled=${saving}
        >
          Cancel
        <//>
        <${Button}
          onClick=${saveConfigs}
          disabled=${saving}
          loading=${saving}
          icon="SaveIcon"
        >
          ${saving ? "Saving..." : "Save"}
        <//>
      </div>
    </div>
  `;
}

export default MQTT;
