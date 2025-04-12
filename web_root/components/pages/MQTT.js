import { h, html, useState, useEffect } from "../../bundle.js";
import {
  Button,
  Icons,
  Tabs,
  Input,
  Select,
  Checkbox,
  FileInput,
} from "../Components.js";
import { useLanguage } from "../LanguageContext.js";

function MQTT() {
  const { t } = useLanguage();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState("config");

  // MQTT Configuration state
  const [mqttConfig, setMqttConfig] = useState({});

  // Publish Configuration state
  // [...Array(8)].map((_, index) => ({ pts: `/PubTopic${index + 1}` }));
  const [publishConfig, setPublishConfig] = useState(
    [...Array(8)].map((_, index) => ({ pts: `/PubTopic${index + 1}` }))
  );

  // Subscribe Configuration state
  // [...Array(8)].map((_, index) => ({ sts: `/SubTopic${index + 1}` }))
  const [subscribeConfig, setSubscribeConfig] = useState(
    [...Array(8)].map((_, index) => ({ pts: `/PubTopic${index + 1}` }))
  );

  const CONFIG = {
    MQTT_VERSIONS: [
      [1, "MQTT-3.0"],
      [2, "MQTT-3.1.1"],
    ],
    SSL_PROTOCOLS: [
      [0, t("disable")],
      [1, "TLS1.0"],
      [2, "TLS1.2"],
    ],
    SSL_VERIFY_OPTIONS: [
      [0, t("none")],
      [1, t("verifyServerCertificate")],
      [2, t("verifyAll")],
    ],
    TRANSMISSION_MODES: {
      PUBLISH: [
        [0, t("transparent")],
        [1, t("distribution")],
      ],
      SUBSCRIBE: [
        [0, t("withoutTopic")],
        [1, t("withTopic")],
      ],
    },
    BINDING_PORTS: [
      [1, t("serial1")],
      [2, t("serial2")],
    ],
    QOS_OPTIONS: [
      [0, "QOS0"],
      [1, "QOS1"],
      [2, "QOS2"],
    ],
  };

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

      // console.log(errors);

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

      const rebootResponse = await fetch("/api/reboot/set", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!rebootResponse.ok) {
        throw new Error("Failed to reboot server");
      }

      setSuccess(true);

      // Show success message for 3 seconds
      setTimeout(() => {
        setSuccess(false);
      }, 3000);

      // Refresh page after 5 seconds
      setTimeout(() => {
        window.location.reload();
      }, 5000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (e, configType) => {
    const { name, value, type, checked } = e.target;
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

    if (type === "number" || type === "select-one") {
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

  const handleFileUpload = async (file, fileType) => {
    if (!file) return;

    // Check file size (4KB limit)
    if (file.size > 4 * 1024) {
      setError(`File size exceeds 4KB limit: ${file.name}`);
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`/api/upload/mqtt/${fileType}`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Failed to upload ${fileType}`);
      }

      // const data = await response.json();
      setMqttConfig((prev) => ({
        ...prev,
        [fileType]: file.name,
      }));
    } catch (err) {
      setError(`Failed to upload ${fileType}: ${err.message}`);
    }
  };

  const handlePublishTopicChange = (e, index) => {
    const { name, value, type, checked } = e.target;

    if (type === "checkbox") {
      const newConfig = [...publishConfig];
      newConfig[index] = {
        ...newConfig[index],
        [name]: checked,
      };
      setPublishConfig(newConfig);
      return;
    }

    if (type === "select-one") {
      const newConfig = [...publishConfig];
      newConfig[index] = {
        ...newConfig[index],
        [name]: parseInt(value),
      };
      setPublishConfig(newConfig);
      return;
    }

    const newConfig = [...publishConfig];
    newConfig[index] = {
      ...newConfig[index],
      [name]: value,
    };
    setPublishConfig(newConfig);
  };

  const handleSubscribeTopicChange = (e, index) => {
    const { name, value, type, checked } = e.target;
    let error = null;

    if (type === "checkbox") {
      const newConfig = [...subscribeConfig];
      newConfig[index] = {
        ...newConfig[index],
        [name]: checked,
      };
      setSubscribeConfig(newConfig);
      return;
    }

    if (type === "select-one") {
      const newConfig = [...subscribeConfig];
      newConfig[index] = {
        ...newConfig[index],
        [name]: parseInt(value),
      };
      setSubscribeConfig(newConfig);
      return;
    }

    const newConfig = [...subscribeConfig];
    newConfig[index] = {
      ...newConfig[index],
      [name]: value,
    };
    setSubscribeConfig(newConfig);
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  // console.log(JSON.stringify(publishConfig));
  // console.log(JSON.stringify(subscribeConfig));

  if (loading) {
    return html`
      <div class="flex items-center justify-center h-full">
        <${Icons.SpinnerIcon} className="h-8 w-8 text-blue-600" />
      </div>
    `;
  }

  const tabs = [
    { id: "config", label: t("config") },
    {
      id: "publish",
      label: t("publish"),
      disabled: !mqttConfig.enabled,
    },
    {
      id: "subscribe",
      label: t("subscribe"),
      disabled: !mqttConfig.enabled,
    },
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
        <div class="space-y-6">
          <div class="bg-white shadow rounded-lg p-6">
            ${activeTab === "config"
              ? html`
                  <div class="space-y-4">
                    <!-- Existing MQTT configuration form -->
                    <!-- Enable MQTT -->
                    ${Checkbox({
                      name: "enabled",
                      label_extra: t("enableMqtt"),
                      value: mqttConfig.enabled,
                      onChange: (e) => handleInputChange(e, "mqtt"),
                    })}
                    ${mqttConfig.enabled &&
                    html`
                      <!-- MQTT Version -->
                      ${Select({
                        name: "version",
                        label: t("mqttVersion"),
                        value: mqttConfig.version,
                        onChange: (e) => handleInputChange(e, "mqtt"),
                        options: CONFIG.MQTT_VERSIONS,
                      })}
                      <!-- Client ID -->
                      ${Input({
                        type: "text",
                        name: "clientId",
                        label: t("clientId"),
                        value: mqttConfig.clientId,
                        onChange: (e) => handleInputChange(e, "mqtt"),
                        maxlength: 32,
                        placeholder: t("enterClientId"),
                        required: true,
                      })}
                      <!-- Server Address -->
                      ${Input({
                        type: "text",
                        name: "serverAddress",
                        label: t("serverAddress"),
                        value: mqttConfig.serverAddress,
                        onChange: (e) => handleInputChange(e, "mqtt"),
                        maxlength: 64,
                        placeholder: t("enterServerAddress"),
                        required: true,
                      })}
                      <!-- Port -->
                      ${Input({
                        type: "number",
                        name: "port",
                        label: t("port"),
                        value: mqttConfig.port,
                        onChange: (e) => handleInputChange(e, "mqtt"),
                        min: 1,
                        max: 65535,
                        extra: "(1~65535)",
                        required: true,
                      })}
                      <!-- Keep Alive -->
                      ${Input({
                        type: "number",
                        name: "keepAlive",
                        label: t("keepAlive"),
                        extra: "(0~65535) seconds",
                        onChange: (e) => handleInputChange(e, "mqtt"),
                        value: mqttConfig.keepAlive,
                        min: 0,
                        max: 65535,
                        required: true,
                      })}
                      <!-- Reconnecting without Data -->
                      ${Input({
                        type: "number",
                        name: "reconnectNoData",
                        label: t("reconnectingWithoutData"),
                        onChange: (e) => handleInputChange(e, "mqtt"),
                        value: mqttConfig.reconnectNoData,
                        min: 0,
                        max: 65535,
                        extra: "(0~65535) seconds",
                        required: true,
                      })}
                      <!-- Reconnect Interval -->
                      ${Input({
                        type: "number",
                        name: "reconnectInterval",
                        label: t("reconnectInterval"),
                        onChange: (e) => handleInputChange(e, "mqtt"),
                        value: mqttConfig.reconnectInterval,
                        min: 1,
                        max: 65535,
                        extra: "(1~65535) seconds",
                        required: true,
                      })}
                      <!-- Clean Session -->
                      ${Checkbox({
                        name: "cleanSession",
                        label: t("cleanSession"),
                        value: mqttConfig.cleanSession,
                        onChange: (e) => handleInputChange(e, "mqtt"),
                      })}
                      <!-- Use Credentials -->
                      ${Checkbox({
                        name: "useCredentials",
                        label: t("useCredentials"),
                        value: mqttConfig.useCredentials,
                        onChange: (e) => handleInputChange(e, "mqtt"),
                      })}
                      ${mqttConfig.useCredentials &&
                      html`
                        <!-- Username -->
                        ${Input({
                          type: "text",
                          name: "username",
                          label: t("username"),
                          value: mqttConfig.username,
                          onChange: (e) => handleInputChange(e, "mqtt"),
                          maxlength: 32,
                          placeholder: t("enterUsername"),
                          required: mqttConfig.useCredentials,
                        })}
                        <!-- Password -->
                        ${Input({
                          type: "password",
                          name: "password",
                          label: t("password"),
                          value: mqttConfig.password,
                          onChange: (e) => handleInputChange(e, "mqtt"),
                          maxlength: 32,
                          placeholder: t("enterPassword"),
                          required: mqttConfig.useCredentials,
                        })}
                      `}
                      <!-- Enable Last Will -->
                      ${Checkbox({
                        name: "enableLastWill",
                        label: t("enableLastWill"),
                        value: mqttConfig.enableLastWill,
                        onChange: (e) => handleInputChange(e, "mqtt"),
                      })}
                      ${mqttConfig.enableLastWill &&
                      html`
                        <!-- Topic of Will -->
                        ${Input({
                          type: "text",
                          name: "lastWillTopic",
                          label: t("topicOfWill"),
                          value: mqttConfig.lastWillTopic,
                          onChange: (e) => handleInputChange(e, "mqtt"),
                          maxlength: 70,
                          placeholder: t("enterTopicOfWill"),
                          required: mqttConfig.enableLastWill,
                        })}
                        <!-- Will Message -->
                        ${Input({
                          type: "text",
                          name: "lastWillMessage",
                          label: t("willMessage"),
                          value: mqttConfig.lastWillMessage,
                          onChange: (e) => handleInputChange(e, "mqtt"),
                          maxlength: 70,
                          placeholder: t("enterWillMessage"),
                          required: mqttConfig.enableLastWill,
                        })}
                        <!-- QoS Level -->
                        ${Select({
                          name: "lastWillQos",
                          label: t("qosLevel"),
                          value: mqttConfig.lastWillQos || 0,
                          onChange: (e) => handleInputChange(e, "mqtt"),
                          options: CONFIG.QOS_OPTIONS,
                        })}
                        <!-- Retained Message -->
                        ${Checkbox({
                          name: "lastWillRetained",
                          label: t("retainedMessage"),
                          value: mqttConfig.lastWillRetained,
                          onChange: (e) => handleInputChange(e, "mqtt"),
                        })}
                      `}
                      <!-- SSL Protocol Configuration -->
                      <div class="grid grid-cols-2 gap-4">
                        ${Select({
                          name: "sslProtocol",
                          label: t("sslProtocol"),
                          value: mqttConfig.sslProtocol,
                          onChange: (e) => {
                            const value = parseInt(e.target.value);
                            handleInputChange(e, "mqtt");
                            // Reset SSL verification to None when SSL is disabled
                            if (value === 0) {
                              setMqttConfig((prev) => ({
                                ...prev,
                                sslVerify: 0,
                              }));
                            }
                          },
                          options: CONFIG.SSL_PROTOCOLS,
                        })}
                        <!-- SSL Verification -->
                        ${Select({
                          name: "sslVerify",
                          label: t("sslVerification"),
                          value: mqttConfig.sslVerify,
                          onChange: (e) => handleInputChange(e, "mqtt"),
                          options: CONFIG.SSL_VERIFY_OPTIONS,
                          disabled: mqttConfig.sslProtocol === 0,
                        })}
                      </div>
                      ${mqttConfig.sslVerify >= 1 &&
                      html`
                        <!-- Server CA Certificate -->
                        ${FileInput({
                          name: "serverCA",
                          label: t("serverCaCertificate"),
                          value: mqttConfig.serverCA,
                          note:
                            mqttConfig.serverCA ||
                            "Upload the server CA certificate",
                          onUpload: (file) =>
                            handleFileUpload(file, "serverCA"),
                          accept: ".pem,.crt,.cer",
                        })}
                      `}
                      ${mqttConfig.sslVerify >= 2 &&
                      html`
                        <!-- Client CA Certificate -->
                        ${FileInput({
                          name: "clientCertificate",
                          label: t("clientCaCertificate"),
                          value: mqttConfig.clientCertificate,
                          note:
                            mqttConfig.clientCertificate ||
                            "Upload the client CA certificate",
                          onUpload: (file) =>
                            handleFileUpload(file, "clientCertificate"),
                          accept: ".pem,.crt,.cer",
                        })}
                        <!-- Client Private Key -->
                        ${FileInput({
                          name: "clientPrivateKey",
                          label: t("clientPrivateKey"),
                          value: mqttConfig.clientPrivateKey,
                          note:
                            mqttConfig.clientPrivateKey ||
                            "Upload the client private key",
                          onUpload: (file) =>
                            handleFileUpload(file, "clientPrivateKey"),
                          accept: ".pem,.crt,.cer",
                        })}
                      `}
                    `}
                  </div>
                `
              : activeTab === "publish"
              ? html`
                  <!-- Topics List -->
                  <div>
                    <div class="space-y-4">
                      ${publishConfig.map((topic, index) => {
                        return html`
                          <div class="border rounded-lg p-4 space-y-4">
                            ${Checkbox({
                              key: `publish-topic-${index}`,
                              name: "pen",
                              label_extra: `${t("publishTopic")} ${index + 1}`,

                              value: topic.pen || false,
                              onChange: (e) =>
                                handlePublishTopicChange(e, index),
                            })}
                            ${topic.pen &&
                            html`
                              <!-- Transmission Mode -->
                              ${Select({
                                key: `publish-topic-${index}-transmission-mode`,
                                name: "ptm",
                                label: t("transmissionMode"),
                                value: topic.ptm || 0,
                                onChange: (e) =>
                                  handlePublishTopicChange(e, index),
                                options: CONFIG.TRANSMISSION_MODES.PUBLISH,
                              })}
                              <!-- Topic String -->
                              ${Input({
                                key: `publish-topic-${index}-topic-string`,
                                type: "text",
                                name: "pts",
                                label: t("topicString"),
                                value: topic.pts || "",
                                onChange: (e) =>
                                  handlePublishTopicChange(e, index),
                                maxlength: 70,
                                placeholder: t("enterTopicString"),
                                required: true,
                              })}
                              <!-- Topic Alias (for distribution mode) -->
                              ${topic.ptm === 1 &&
                              html`
                                ${Input({
                                  key: `publish-topic-${index}-topic-alias`,
                                  type: "text",
                                  name: "pta",
                                  label: t("topicAlias"),
                                  value: topic.pta || "",
                                  onChange: (e) =>
                                    handlePublishTopicChange(e, index),
                                  maxlength: 70,
                                  placeholder: t("enterTopicAlias"),
                                  required: topic.ptm === 1,
                                })}
                              `}
                              <!-- Binding Port -->
                              <div key=${`publish-topic-${index}-binding-port`}>
                                <label
                                  class="block text-sm font-medium text-gray-700 mb-2"
                                  >${t("bindingPort")}</label
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
                                        pbp: selectedValue,
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
                                        selected=${(topic.pbp & value) !== 0}
                                      >
                                        ${label}
                                      </option>
                                    `
                                  )}
                                </select>
                              </div>
                              <!-- QoS -->
                              ${Select({
                                key: `publish-topic-${index}-qos`,
                                name: "pqos",
                                label: t("qosLevel"),
                                value: topic.pqos || 0,
                                onChange: (e) =>
                                  handlePublishTopicChange(e, index),
                                options: CONFIG.QOS_OPTIONS,
                              })}
                              <!-- Retained Message -->
                              ${Checkbox({
                                key: `publish-topic-${index}-retained-message`,
                                name: "prm",
                                label: t("retainedMessage"),
                                value: topic.prm || false,
                                onChange: (e) =>
                                  handlePublishTopicChange(e, index),
                              })}
                              <!-- IO Control/Query -->
                              ${Checkbox({
                                key: `publish-topic-${index}-io-control-query`,
                                name: "pio",
                                label: t("ioControlQuery"),
                                value: topic.pio || false,
                                onChange: (e) =>
                                  handlePublishTopicChange(e, index),
                              })}
                            `}
                          </div>
                        `;
                      })}
                    </div>
                  </div>
                `
              : html`
                  <!-- Topics List -->
                  <div>
                    <div class="space-y-4">
                      ${subscribeConfig.map((topic, index) => {
                        return html`
                          <div class="border rounded-lg p-4 space-y-4">
                            <!-- Enabled subscription -->
                            ${Checkbox({
                              key: `subscribe-topic-${index}`,
                              name: "sen",
                              label_extra: `${t("subscribeTopic")} ${
                                index + 1
                              }`,
                              value: topic.sen || false,
                              onChange: (e) =>
                                handleSubscribeTopicChange(e, index),
                            })}
                            ${topic.sen &&
                            html`
                              <!-- Transmission Mode -->
                              ${Select({
                                key: `subscribe-topic-${index}-transmission-mode`,
                                name: "stm",
                                label: t("transmissionMode"),
                                value: topic.stm || 0,
                                onChange: (e) =>
                                  handleSubscribeTopicChange(e, index),
                                options: CONFIG.TRANSMISSION_MODES.SUBSCRIBE,
                              })}
                              <!-- Topic String -->
                              ${Input({
                                key: `subscribe-topic-${index}-topic-string`,
                                type: "text",
                                name: "sts",
                                label: t("topicString"),
                                value: topic.sts || "",
                                onChange: (e) =>
                                  handleSubscribeTopicChange(e, index),
                                maxlength: 70,
                                placeholder: t("enterTopicString"),
                                required: true,
                              })}
                              <!-- Delimiter -->
                              ${topic.stm === 1 &&
                              html`
                                ${Input({
                                  key: `subscribe-topic-${index}-delimiter`,
                                  type: "text",
                                  name: "sd",
                                  label: t("delimiter"),
                                  value: topic.sd || "",
                                  onChange: (e) =>
                                    handleSubscribeTopicChange(e, index),
                                  maxlength: 1,
                                  placeholder: t("enterDelimiter"),
                                  required: topic.stm === 1,
                                })}
                              `}
                              <!-- Binding Port -->
                              <div
                                key=${`subscribe-topic-${index}-binding-port`}
                              >
                                <label
                                  class="block text-sm font-medium text-gray-700 mb-2"
                                  >${t("bindingPort")}</label
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
                                        sbp: selectedValue,
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
                                        selected=${(topic.sbp & value) !== 0}
                                      >
                                        ${label}
                                      </option>
                                    `
                                  )}
                                </select>
                              </div>
                              <!-- QoS -->
                              ${Select({
                                key: `subscribe-topic-${index}-qos`,
                                name: "sqos",
                                label: t("qosLevel"),
                                value: topic.sqos || 0,
                                onChange: (e) =>
                                  handleSubscribeTopicChange(e, index),
                                options: CONFIG.QOS_OPTIONS,
                              })}
                              <!-- IO Control/Query -->
                              ${Checkbox({
                                key: `subscribe-topic-${index}-io-control-query`,
                                name: "sio",
                                label: t("ioControlQuery"),
                                value: topic.sio || false,
                                onChange: (e) =>
                                  handleSubscribeTopicChange(e, index),
                              })}
                            `}
                          </div>
                        `;
                      })}
                    </div>
                  </div>
                `}
          </div>
          <!-- Save and Cancel Buttons -->
          <div class="flex justify-end gap-4">
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
              ${t("cancel")}
            <//>
            <${Button}
              onClick=${saveConfigs}
              disabled=${saving}
              loading=${saving}
              icon="SaveIcon"
            >
              ${saving ? t("saving") : t("save")}
            <//>
          </div>
        </div>
      </div>
    </div>
  `;
}

export default MQTT;
