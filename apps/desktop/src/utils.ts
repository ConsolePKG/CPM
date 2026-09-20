import { networkInterfaces } from 'os'

export const getIp = () => {
  return Object.values(networkInterfaces())
    .flat()
    .find((i) => i?.family == 'IPv4' && !i?.internal)?.address
}

export const getAvailableInterfaces = () => {
  return Object.values(networkInterfaces())
    .flat()
    .filter((i) => i?.family == 'IPv4' && !i?.internal && i.address != '')
}
