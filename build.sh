#!/usr/bin/env bash

PLATFORM=$1
ARCH=$2
DOCKER_VERSION=$3

DOWNLOAD_FOLDER=".tmp/download"

rm -rf "${DOWNLOAD_FOLDER}"
mkdir -pv "${DOWNLOAD_FOLDER}"

if [ "${PLATFORM}" == 'win' ]; then
  curl -o "${DOWNLOAD_FOLDER}/docker-binaries.zip" "https://download.docker.com/${PLATFORM}/static/stable/${ARCH}/docker-${DOCKER_VERSION}.zip"
  unzip "${DOWNLOAD_FOLDER}/docker-binaries.zip" -d "${DOWNLOAD_FOLDER}"
  mv "${DOWNLOAD_FOLDER}/docker/docker.exe" third/
else
  curl -o "${DOWNLOAD_FOLDER}/docker-binaries.tgz" "https://download.docker.com/${PLATFORM}/static/stable/${ARCH}/docker-${DOCKER_VERSION}.tgz"
  tar -xf "${DOWNLOAD_FOLDER}/docker-binaries.tgz" -C "${DOWNLOAD_FOLDER}"
  mv "${DOWNLOAD_FOLDER}/docker/docker" third/
fi

export PATH=$PATH:/dk-server/third

exit 0