import { SftpCapabilityError, type SftpBackend } from './types'

export function createUnavailableSftpBackend(): SftpBackend {
  const fail = async (): Promise<never> => {
    throw new SftpCapabilityError()
  }
  return {
    connect: fail,
    disconnect: async () => undefined,
    list: fail,
    stat: fail,
    read: fail,
    write: fail,
    mkdir: fail,
    remove: fail,
    rename: fail,
  }
}
