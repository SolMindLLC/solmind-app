import { describe, expect, it, vi } from "vitest";

import {
  APPLICATION_SETTING_READ_FAILED,
  EXPLORER_SHARED_SNAPSHOT_SENDABILITY_DAYS_KEY,
  readExplorerSharedSnapshotSendabilitySetting,
} from "../applicationSettingReader";

function fakeClient(response: { data: unknown; error: unknown }) {
  const rpc = vi.fn(() => Promise.resolve(response));
  const client = { rpc } as unknown as Parameters<
    typeof readExplorerSharedSnapshotSendabilitySetting
  >[0];
  return { client, rpc };
}

const VALID_ROW = {
  setting_key: EXPLORER_SHARED_SNAPSHOT_SENDABILITY_DAYS_KEY,
  integer_value: 7,
  minimum_integer_value: 1,
  default_integer_value: 7,
  maximum_integer_value: 100,
  version: 1,
};

describe("readExplorerSharedSnapshotSendabilitySetting", () => {
  it("calls only the fixed RPC and fixed allowlisted key", async () => {
    const { client, rpc } = fakeClient({ data: [VALID_ROW], error: null });

    const result =
      await readExplorerSharedSnapshotSendabilitySetting(client);

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith(
      "solmind_read_application_setting_integer",
      {
        p_setting_key: EXPLORER_SHARED_SNAPSHOT_SENDABILITY_DAYS_KEY,
      },
    );
    expect(result).toEqual({
      key: EXPLORER_SHARED_SNAPSHOT_SENDABILITY_DAYS_KEY,
      days: 7,
      minimumDays: 1,
      defaultDays: 7,
      maximumDays: 100,
      version: 1,
    });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it.each([1, 100])("accepts the inclusive %i-day boundary", async (days) => {
    const { client } = fakeClient({
      data: [{ ...VALID_ROW, integer_value: days }],
      error: null,
    });

    await expect(
      readExplorerSharedSnapshotSendabilitySetting(client),
    ).resolves.toMatchObject({ days });
  });

  it.each([
    [],
    [VALID_ROW, VALID_ROW],
    [{ ...VALID_ROW, setting_key: "another_key" }],
    [{ ...VALID_ROW, integer_value: 0 }],
    [{ ...VALID_ROW, integer_value: 101 }],
    [{ ...VALID_ROW, integer_value: 7.5 }],
    [{ ...VALID_ROW, minimum_integer_value: 0 }],
    [{ ...VALID_ROW, default_integer_value: 8 }],
    [{ ...VALID_ROW, maximum_integer_value: 101 }],
    [{ ...VALID_ROW, version: 0 }],
    [{ ...VALID_ROW, version: 1.5 }],
    [{ ...VALID_ROW, integer_value: "7" }],
    VALID_ROW,
  ])("fails closed for malformed data %#", async (data) => {
    const { client } = fakeClient({ data, error: null });

    await expect(
      readExplorerSharedSnapshotSendabilitySetting(client),
    ).rejects.toThrow(APPLICATION_SETTING_READ_FAILED);
  });

  it("maps an RPC error to one value-free sentinel", async () => {
    const { client } = fakeClient({
      data: null,
      error: {
        message:
          "permission denied at https://project.supabase.co using sb_service_role_secret",
      },
    });

    await expect(
      readExplorerSharedSnapshotSendabilitySetting(client),
    ).rejects.toThrow(APPLICATION_SETTING_READ_FAILED);
  });

  it("maps a rejected RPC to the same value-free sentinel", async () => {
    const rpc = vi.fn(() =>
      Promise.reject(new Error("https://secret.example.invalid")),
    );
    const client = { rpc } as unknown as Parameters<
      typeof readExplorerSharedSnapshotSendabilitySetting
    >[0];

    await expect(
      readExplorerSharedSnapshotSendabilitySetting(client),
    ).rejects.toThrow(APPLICATION_SETTING_READ_FAILED);
  });
});
