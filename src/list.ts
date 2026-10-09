/** Open cached results immediately while a refresh updates the reactive dialog. */
export const refreshAndShow = async (
  refresh: () => Promise<void>,
  show: () => Promise<void>,
): Promise<void> => {
  void refresh();
  await show();
};
