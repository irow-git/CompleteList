// Errors thrown in the main process reach the renderer as "Error invoking remote method 'sync:run': Error: <message>".
// This keeps just the message, for showing to the user
export const ipcErrorMessage = (error: unknown) =>
  (error instanceof Error ? error.message : String(error)).replace(/^Error invoking remote method '[^']+': (?:\w*Error: )?/, "");
