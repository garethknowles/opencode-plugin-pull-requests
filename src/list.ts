/** Refresh before opening a snapshot-based dialog; failures must not look like an empty inbox. */
export const refreshThenShow = async (
  refresh: () => Promise<void>,
  show: () => Promise<void>,
): Promise<void> => {
  await refresh();
  await show();
};
