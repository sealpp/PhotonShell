import createCoreModule from './libssh2-core.js'

// The checked-in upstream WASM exposes the base rename entry point. These
// pointer-compatible helpers keep the application API stable while CI builds
// the native overwrite extension from patches/rename-ex.patch.
export default async function createPhotonShellLibssh2(options = {}) {
  const module = await createCoreModule(options)
  if (!module.ssh2_sftp_rename_ex) {
    module.ssh2_sftp_rename_ex = (sftp, source, _sourceLength, dest, _destLength, _flags) => module.ssh2_sftp_rename(sftp, source, dest)
  }
  if (!module.ssh2_sftp_posix_rename_ex) {
    module.ssh2_sftp_posix_rename_ex = (sftp, source, _sourceLength, dest, _destLength) => module.ssh2_sftp_rename(sftp, source, dest)
  }
  return module
}
