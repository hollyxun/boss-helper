interface Window {
  _PAGE: {
    isGeekChat: boolean
    // zp_token: string; 7.18 寄！
    userId: number
    identity: number
    encryptUserId: string
    name: string
    showName: string
    tinyAvatar: string
    largeAvatar: string
    token: string
    isHunter: boolean
    clientIP: string
    email: any
    phone: any
    brandName: any
    doubleIdentity: boolean
    recruit: boolean
    agentRecruit: boolean
    industryCostTag: number
    gender: number
    trueMan: boolean
    studentFlag: boolean
    completeDayStatus: boolean
    complete: boolean
    multiExpect: boolean
    uid: number
  }
  Cookie: {
    get: (key: string) => string
  }
  [key: string]: any
}

declare module '*.svg?raw' {
  const content: string
  export default content
}

declare const __APP_VERSION__: string
declare const __BUILD_TIME__: string
