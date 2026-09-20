import { ipcMain, IpcMainEvent, IpcMainInvokeEvent, ipcRenderer } from 'electron'

import { IElectronIpcMainHandles } from '../types'

type IpcMainHandleParams<T> = T extends (...args: infer P) => any ? P : never
type IpcMainHandleReturn<T> = T extends (...args: any[]) => infer R ? R : never

export const ipcRendererSend = <T extends keyof IElectronIpcMainHandles>(
  channel: T,
  ...args: IpcMainHandleParams<IElectronIpcMainHandles[T]>
) => {
  return ipcRenderer.send(channel, ...args)
}

export const ipcRendererSendSync = <T extends keyof IElectronIpcMainHandles>(
  channel: T,
  ...args: IpcMainHandleParams<IElectronIpcMainHandles[T]>
) => {
  return ipcRenderer.sendSync(channel, ...args)
}

export const ipcRendererInvoke = <T extends keyof IElectronIpcMainHandles>(
  channel: T,
  ...args: IpcMainHandleParams<IElectronIpcMainHandles[T]>
) => {
  return ipcRenderer.invoke(channel, ...args)
}

export const ipcMainOn = <T extends keyof IElectronIpcMainHandles>(
  channel: T,
  listener: (event: IpcMainEvent, ...args: IpcMainHandleParams<IElectronIpcMainHandles[T]>) => void,
) => {
  // @ts-ignore
  return ipcMain.on(channel, listener)
}

export const ipcMainHandle = <T extends keyof IElectronIpcMainHandles>(
  channel: T,
  listener: (
    event: IpcMainInvokeEvent,
    ...args: IpcMainHandleParams<IElectronIpcMainHandles[T]>
  ) => IpcMainHandleReturn<IElectronIpcMainHandles[T]>,
) => {
  // @ts-ignore
  return ipcMain.handle(channel, listener)
}
