FROM emscripten/emsdk:4.0.10
WORKDIR /src
COPY patches/rename-ex.patch /src/patches/rename-ex.patch
COPY build-metadata.json /src/build-metadata.json
# CI supplies the pinned libssh2/OpenSSL/zlib sources and applies the wrapper patch.
