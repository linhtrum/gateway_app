"use strict";
import { h, html, useState } from "../../bundle.js";
import { Icons, Button, FileInput } from "../Components.js";

// Constants and configuration
const CONFIG = {
  API_TIMEOUT: 30000, // 30 seconds
  REBOOT_DELAY: 5000, // 5 seconds
};

function Management() {
  const [isRestoring, setIsRestoring] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Handle factory reset
  const factoryReset = async () => {
    if (
      !confirm(
        "Are you sure you want to perform a factory reset? This will erase all settings."
      )
    ) {
      return;
    }

    try {
      setIsRestoring(true);
      setError(null);
      setSuccess(false);

      const response = await fetch("/api/factory/reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to perform factory reset");
      }

      setSuccess(true);
      setMessage(
        "Factory reset successful. The system will reboot in 5 seconds..."
      );
      setTimeout(() => {
        window.location.reload();
      }, CONFIG.REBOOT_DELAY);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsRestoring(false);
    }
  };

  // Handle server reboot
  const handleReboot = async () => {
    if (!confirm("Are you sure you want to reboot the device?")) {
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      setSuccess(false);

      const response = await fetch("/api/reboot/set", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to reboot device");
      }

      setSuccess(true);
      setMessage("Device is rebooting. Please wait...");
      setTimeout(() => {
        window.location.reload();
      }, CONFIG.REBOOT_DELAY);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFirmwareUpload = async (file) => {
    if (!file) return;

    // Check file size (4MB limit)
    if (file.size > 4 * 1024 * 1024) {
      setError(`Firmware file size exceeds 4MB limit: ${file.name}`);
      return;
    }

    if (
      !confirm(
        "Are you sure you want to upload new firmware? The device will reboot after the update."
      )
    ) {
      return;
    }

    try {
      setIsUploading(true);
      setError(null);
      setSuccess(false);

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/firmware/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload firmware");
      }

      setSuccess(true);
      setMessage(
        "Firmware upload successful. The device will reboot in 5 seconds..."
      );
      setTimeout(() => {
        window.location.reload();
      }, CONFIG.REBOOT_DELAY);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  // Render message component
  const renderMessage = () => {
    if (error) {
      return html`
        <div
          class="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded"
        >
          ${error}
        </div>
      `;
    }
    if (success) {
      return html`
        <div
          class="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded"
        >
          ${message || "Operation successful"}
        </div>
      `;
    }
    return null;
  };

  return html`
    <div class="p-6">
      <h1 class="text-2xl font-bold mb-6">System Management</h1>
      ${renderMessage()}
      <div class="max-w-2xl mx-auto">
        <div class="space-y-6">
          <!-- Firmware Update Section -->
          <div class="bg-white shadow rounded-lg p-6">
            <h2 class="text-lg font-medium mb-4">Firmware Update</h2>
            <p class="text-gray-600 mb-4">
              Upload a new firmware file to update the device. The device will
              automatically reboot after the update.
            </p>
            <div class="max-w-md">
              ${FileInput({
                name: "firmware",
                label: "Firmware File",
                note: "Select firmware file to upload (max 4MB)",
                onUpload: handleFirmwareUpload,
                isUploading: isUploading,
                accept: ".bin,.hex",
              })}
            </div>
          </div>

          <!-- Device Reboot Section -->
          <div class="bg-white shadow rounded-lg p-6">
            <h2 class="text-lg font-medium mb-4">Device Reboot</h2>
            <p class="text-gray-600 mb-4">
              Reboot the device to apply any pending changes or to refresh the
              system.
            </p>
            <${Button}
              onClick=${handleReboot}
              disabled=${isSaving}
              loading=${isSaving}
              variant="primary"
            >
              ${isSaving ? "Rebooting..." : "Reboot Device"}
            <//>
          </div>

          <!-- Factory Reset Section -->
          <div class="bg-white shadow rounded-lg p-6">
            <h2 class="text-lg font-medium mb-4">Factory Reset</h2>
            <p class="text-gray-600 mb-4">
              Reset all settings to factory defaults. This will erase all custom
              configurations.
            </p>
            <${Button}
              onClick=${factoryReset}
              disabled=${isRestoring}
              loading=${isRestoring}
              variant="danger"
            >
              ${isRestoring ? "Resetting..." : "Factory Reset"}
            <//>
          </div>
        </div>
      </div>
    </div>
  `;
}

export default Management;
