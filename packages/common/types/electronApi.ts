import { ElectronConfigStore } from './configStore';

export interface DiscoveredCPIService {
  port: number;
  version?: string;
  systemVersion?: string;
}

export interface DiscoveredPS4 {
  id: string;
  name: string;
  address: string;
  status: 'awake' | 'standby';
  ports: number[];
  services?: DiscoveredCPIService[];
}

export interface PS4DiscoveryResult {
  hosts: DiscoveredPS4[];
  errorMessage?: string;
}

export interface IElectronIpcMainHandles {
  configStore: {
    get: ElectronConfigStore['get'];
    set: ElectronConfigStore['set'];
    has: ElectronConfigStore['has'];
    delete: ElectronConfigStore['delete'];
    clear: ElectronConfigStore['clear'];
  };
  getPath: (path: Parameters<Electron.App['getPath']>[0]) => Promise<string>;
  chnageWindowStatus: (status: 'minimize' | 'maximize' | 'close') => void;
  getAppInfo: () => Promise<{
    version: string;
    name: string;
    path: string;
  }>;
  openDirectoryDialog: () => Promise<string | undefined>;
  createStaticFileServer: (params: { directoryPath: string; port: number; preferredInterface?: string }) => Promise<
    | {
        url?: string;
        errorMessage?: string;
      }
    | undefined
  >;
  getAvailableInterfaces: () => Promise<{ ipv4: string }[] | { errorMessage?: string } | null>;
  discoverPS4Hosts: () => Promise<PS4DiscoveryResult>;
  openDevTools: () => void;
  openAppLog: () => void;
  checkUpdate: () => void;
}

export interface IElectronAPI extends IElectronIpcMainHandles {
  platform: NodeJS.Platform;
  openExternal: (url: string) => void;
}
