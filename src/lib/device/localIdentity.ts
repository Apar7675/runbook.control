export type LocalDeviceIdentity = {
  local_install_id?: string;
  machine_fingerprint?: string;
  local_computer_name?: string;
};

function text(value: unknown) {
  const trimmed = String(value ?? "").trim();
  return trimmed || undefined;
}

export function readLocalDeviceIdentity(body: Record<string, unknown> | null | undefined): LocalDeviceIdentity {
  const local_install_id = text(body?.local_install_id ?? body?.localInstallId);
  const machine_fingerprint = text(body?.machine_fingerprint ?? body?.machineFingerprint);
  const local_computer_name = text(body?.local_computer_name ?? body?.localComputerName);

  return {
    ...(local_install_id ? { local_install_id } : {}),
    ...(machine_fingerprint ? { machine_fingerprint } : {}),
    ...(local_computer_name ? { local_computer_name } : {}),
  };
}
