set -ex

ARCH=${1:-x64}

if [ "$ARCH" = "x64" ]; then
    DOCKER_PLATFORM=linux/amd64
elif [ "$ARCH" = "arm64" ]; then
    DOCKER_PLATFORM=linux/arm64
else
    echo "Unsupported architecture: $ARCH"
    exit 1
fi

DOCKER_IMAGE=appimage-builder-$ARCH
docker build --platform "$DOCKER_PLATFORM" -t "$DOCKER_IMAGE" .
docker run --rm -v "$PWD/dist:/workspace/dist" -e "GH_TOKEN=$GH_TOKEN" "$DOCKER_IMAGE" \
	npm run release -- --linux AppImage "--$ARCH"
