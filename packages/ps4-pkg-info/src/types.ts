/** https://www.psdevwiki.com/ps4/Param.sfo */

export type Ps4PkgParamSfo = {
  APP_TYPE: Ps4PkgAppType
  APP_VER: string
  ATTRIBUTE: number
  CATEGORY: Ps4PkgCategory
  CONTENT_ID: string
  DOWNLOAD_DATA_SIZE: number
  PUBTOOLINFO: string
  PUBTOOLVER: number
  SYSTEM_VER: number
  TITLE: string
  TITLE_ID: string
  VERSION: string
  [prop: string]: string | number
}

export enum Ps4PkgAppType {
  /** Not Specified */
  UNKNOWN = 0,
  /** allows only the purchased user and users on the same activated console to play with certain number of console limitation. */
  PaidStandaloneFull,
  /** single application binary that can be upgraded from free trial to paid full application based on the purchased status of skus on PlayStation®Store or license information on Blu-ray Disc. Trial sku can be also played on Kiosk unit. */
  Upgragable,
  /** has no limitation on number of consoles to be played. Demo application is typically distributed from PlayStation®Store or Disc for free. This application can be played on Kiosk unit. This application cannot have trophies.
e.g. A non-upgradable demo application, a free full application without an AC, applications created for specific events */
  Demo,
  /** free full application that comes with paid additional contents. This application may have trophies of freemium game scope. */
  Freemium,
}

export enum Ps4PkgCategory {
  GameDigital = 'gd',
  Digital = 'gdn',
  GameApplicationPatch = 'gp',
  ApplicationPatch = 'gpn',
  AdditionalContent = 'ac',
  BluRayDisc = 'bd',
  GameContent = 'gc',
  SystemApp = 'gda',
  BigApp = 'gdc',
  BGApp = 'gdd',
  MiniApp = 'gde',
  VideoServiceWebApp = 'gdk',
  PSCloudBetaApp = 'gdl',
  PS2 = 'gdO',
  BigAppPatch = 'gpc',
  BGAppPatch = 'gpd',
  MiniAppPatch = 'gpe',
  VideoServiceWebAppPatch = 'gpk',
  PSCloudBetaAppPatch = 'gpl',
  SaveData = 'sd',
}
